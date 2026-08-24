// src/types/next-auth.d.ts

import { Role } from "@prisma/client"
import NextAuth from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email: string
      role: Role
      tenantId: string
      permissions: string[] // <-- ADD THIS LINE
      originalRole: Role
      actor: { id: string; name?: string | null; email: string }
      impersonation?: {
        sessionId: string
        tenantId: string
        tenantName: string
        reason: string
        mode: 'READ_ONLY'
        startedAt: string
        expiresAt: string
      }
    }
  }

  interface User {
    id: string
    name?: string | null
    email: string
    role: Role
    tenantId: string
    permissions: string[] // <-- ADD THIS LINE
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: Role
    tenantId: string
    permissions: string[] // <-- ADD THIS LINE
    actorId: string
    actorRole: Role
    actorTenantId: string
    actorPermissions: string[]
    actorName?: string | null
    actorEmail: string
    impersonationSessionId?: string
    impersonationExpiresAt?: string
    impersonationTenantName?: string
  }
}
