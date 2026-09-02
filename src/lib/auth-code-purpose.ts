// src/lib/auth-code-purpose.ts
//
// The purpose values as a plain union, so client components can name one
// without importing the Prisma client. Kept in step with the AuthCodePurpose
// enum in prisma/schema.prisma.

export type AuthCodePurpose = 'LOGIN' | 'PASSWORD_RESET';
