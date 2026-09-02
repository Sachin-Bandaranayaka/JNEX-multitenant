// src/lib/auth.ts

import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import { compare } from 'bcryptjs';
import { getServerSession } from 'next-auth/next';
import { AuthCodePurpose, Role } from '@prisma/client';
import { validateImpersonationSession } from './impersonation';
import { consumeAuthCode, describeConsumeFailure, findUserForAuthCode } from './auth-codes';
import { SESSION_IDLE_TIMEOUT_SECONDS } from './session-policy';
import { canUseSession, getFreshUserAccess } from './user-access';
import { sanitizePermissions } from './permissions';

function clearImpersonationClaims(token: any) {
  token.id = token.actorId;
  token.role = token.actorRole;
  token.tenantId = token.actorTenantId;
  token.permissions = token.actorPermissions || [];
  token.name = token.actorName;
  token.email = token.actorEmail;
  delete token.impersonationSessionId;
  delete token.impersonationExpiresAt;
  delete token.impersonationTenantName;
  return token;
}

// Keep the opaque actor id so a later callback can observe reactivation, but
// remove every claim that middleware or a route could use to authorize the
// revoked session. The session-status poll will then clear the cookie in the
// browser; direct API clients are denied even if they ignore that poll.
function revokeAccessClaims(token: any) {
  token.id = '';
  token.role = Role.TEAM_MEMBER;
  token.tenantId = '';
  token.permissions = [];
  token.actorRole = Role.TEAM_MEMBER;
  token.actorTenantId = '';
  token.actorPermissions = [];
  token.accessRevoked = true;
  delete token.impersonationSessionId;
  delete token.impersonationExpiresAt;
  delete token.impersonationTenantName;
  return token;
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) { return null; }
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { tenant: true }
        });

        if (!user || !user.isActive) { return null; }

        if (user.role !== 'SUPER_ADMIN' && !user.tenant.isActive) {
          throw new Error('Your account has been deactivated.');
        }

        const isPasswordValid = await compare(credentials.password, user.password);
        if (!isPasswordValid) { return null; }

        // --- THE FIX ---
        // Ensure the full user object, including permissions, is returned
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          permissions: user.permissions, // This line is critical
        };
      }
    }),
    // Passwordless sign-in: the user proves control of their inbox with a
    // six-digit code instead of typing a password. The code itself is issued
    // and rate limited by /api/auth/code/request; all that happens here is
    // redeeming it, exactly once.
    CredentialsProvider({
      id: 'email-code',
      name: 'Email code',
      credentials: {
        email: { label: 'Email', type: 'email' },
        code: { label: 'Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.code) { return null; }

        const user = await findUserForAuthCode(credentials.email);

        // An address with no account gets the same answer as a wrong code, so
        // this screen cannot be used to find out who our customers are.
        if (!user || !user.isActive) {
          throw new Error(describeConsumeFailure('INVALID'));
        }

        if (user.role !== 'SUPER_ADMIN' && !user.tenant.isActive) {
          throw new Error('Your account has been deactivated.');
        }

        const redeemed = await consumeAuthCode(user.email, AuthCodePurpose.LOGIN, credentials.code);
        if (!redeemed.ok) {
          throw new Error(describeConsumeFailure(redeemed.reason));
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          permissions: user.permissions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // If the user object exists (on sign-in), add its properties to the token
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
        token.tenantId = user.tenantId;
        token.permissions = sanitizePermissions(user.permissions); // Pass permissions to the token
        token.actorId = user.id;
        token.actorRole = user.role as Role;
        token.actorTenantId = user.tenantId;
        token.actorPermissions = token.permissions;
        token.actorName = user.name;
        token.actorEmail = user.email;
        // When these credentials were actually presented. Refreshing the
        // session extends its expiry but must not move this, because it is
        // what a password reset is compared against.
        token.authenticatedAt = Date.now();
      }

      // Backfill immutable actor claims for sessions created before this feature.
      token.actorId ||= token.id;
      if (!token.actorRole && token.role) token.actorRole = token.role;
      token.actorTenantId ||= token.tenantId;
      token.actorPermissions ||= token.permissions || [];
      token.actorName ||= token.name;
      if (!token.actorEmail && typeof token.email === 'string') token.actorEmail = token.email;

      if (trigger === 'update') {
        const requestedId = (session as { impersonationSessionId?: unknown } | undefined)?.impersonationSessionId;
        if (requestedId === null || requestedId === '') {
          return clearImpersonationClaims(token);
        }
        // The only client-controlled value accepted is an opaque database id.
        if (typeof requestedId === 'string' && token.actorRole === 'SUPER_ADMIN') {
          token.impersonationSessionId = requestedId;
        }
      }

      // Re-read the actor's own role and permissions. The claims minted at
      // sign-in are a snapshot; without this an admin's change to a staff
      // member's access -- including revoking it -- has no effect until that
      // person signs out. `getFreshUserAccess` is cached per process for a few
      // seconds, so this is not a database round trip per request.
      if (token.actorId) {
        const access = await getFreshUserAccess(token.actorId as string);
        const authenticatedAt =
          typeof token.authenticatedAt === 'number' ? token.authenticatedAt : null;
        const accountCanSignIn = canUseSession(access, authenticatedAt);

        if (!accountCanSignIn) {
          return revokeAccessClaims(token);
        }

        if (access) {
          delete token.accessRevoked;
          token.actorRole = access.role;
          token.actorPermissions = access.permissions;
          token.actorTenantId = access.tenantId;
          // While impersonating, `token.role`/`token.permissions` describe the
          // target user and are refreshed by the impersonation branch below.
          if (!token.impersonationSessionId) {
            token.role = access.role;
            token.permissions = access.permissions;
            token.tenantId = access.tenantId;
          }
        }
      }

      if (token.impersonationSessionId && token.actorId && token.actorRole === 'SUPER_ADMIN') {
        const access = await validateImpersonationSession(
          token.impersonationSessionId as string,
          token.actorId as string,
        );
        if (!access) return clearImpersonationClaims(token);

        token.id = access.targetUserId;
        token.role = 'ADMIN';
        token.tenantId = access.tenantId;
        token.permissions = access.targetPermissions;
        token.name = access.targetUserName;
        token.email = access.targetUserEmail;
        token.impersonationExpiresAt = access.expiresAt.toISOString();
        token.impersonationTenantName = access.tenantName;
      }
      return token;
    },
    async session({ session, token }) {
      // Add the properties from the token to the final session object
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.tenantId = token.tenantId as string;
        session.user.permissions = token.permissions as string[]; // Pass permissions to the session
        session.user.originalRole = token.actorRole as Role;
        session.user.authenticatedAt =
          typeof token.authenticatedAt === 'number' ? token.authenticatedAt : null;
        session.user.actor = {
          id: token.actorId as string,
          name: (token.actorName as string | null | undefined) ?? null,
          email: token.actorEmail as string,
        };
        if (token.impersonationSessionId) {
          const access = await validateImpersonationSession(
            token.impersonationSessionId as string,
            token.actorId as string,
          );
          if (access) {
            session.user.impersonation = {
              sessionId: access.id,
              tenantId: access.tenantId,
              tenantName: access.tenantName,
              reason: access.reason,
              mode: 'READ_ONLY',
              startedAt: access.startedAt.toISOString(),
              expiresAt: access.expiresAt.toISOString(),
            };
          }
        }
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Ensure redirects stay within your domain
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
  // Idle expiry, banking-app style. The JWT is minted with a two-hour life and
  // is re-minted whenever the session is refreshed, which the client only does
  // in response to real interaction (see IdleTimeoutGuard). Two hours of an
  // untouched tab and the cookie is simply no longer valid -- there is no
  // server-side state to forget to clean up, and no way for an idle client to
  // keep itself alive by polling.
  session: {
    strategy: 'jwt',
    maxAge: SESSION_IDLE_TIMEOUT_SECONDS,
  },
  jwt: {
    maxAge: SESSION_IDLE_TIMEOUT_SECONDS,
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getSession() {
  return await getServerSession(authOptions);
}
