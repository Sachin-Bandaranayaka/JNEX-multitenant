// src/lib/auth.ts

import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import { compare } from 'bcryptjs';
import { getServerSession } from 'next-auth/next';
import { Role } from '@prisma/client';

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

        if (!user) { return null; }

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
    async jwt({ token, user }) {
      // If the user object exists (on sign-in), add its properties to the token
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
        token.tenantId = user.tenantId;
        token.permissions = user.permissions; // Pass permissions to the token
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