// src/lib/auth.ts

import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import { compare } from 'bcryptjs';
import { getServerSession } from 'next-auth/next';
import { Role } from '@prisma/client';
import { validateImpersonationSession } from './impersonation';

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
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // If the user object exists (on sign-in), add its properties to the token
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
        token.tenantId = user.tenantId;
        token.permissions = user.permissions; // Pass permissions to the token
        token.actorId = user.id;
        token.actorRole = user.role as Role;
        token.actorTenantId = user.tenantId;
        token.actorPermissions = user.permissions;
        token.actorName = user.name;
        token.actorEmail = user.email;
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
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getSession() {
  return await getServerSession(authOptions);
}
