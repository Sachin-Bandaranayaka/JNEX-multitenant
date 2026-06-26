// prisma/seed.ts

import { PrismaClient, Role } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 1. Create the first master tenant for the whole system
  const tenant = await prisma.tenant.upsert({
    where: { name: 'J-nex Holdings Master' },
    update: {},
    create: {
      name: 'J-nex Holdings Master',
      isActive: true,
    },
  })

  // 2. Create the Super Admin user.
  // Credentials are read from the environment so production seeds never use a
  // hardcoded, repository-known password. The fallbacks exist only for local
  // development; set SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD before
  // seeding anything that is internet-reachable.
  const superAdminEmail = process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@jnex.com'
  const superAdminPasswordPlain = process.env.SEED_SUPERADMIN_PASSWORD

  if (!superAdminPasswordPlain) {
    console.warn(
      '⚠️  SEED_SUPERADMIN_PASSWORD is not set — falling back to an insecure ' +
      'development default. Do NOT use this in production.'
    )
  }

  const superAdminPassword = await hash(superAdminPasswordPlain || 'superadmin123', 12)

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      name: 'Super Admin',
      password: superAdminPassword,
      role: Role.SUPER_ADMIN, // Use the SUPER_ADMIN role
      permissions: ['all'],
      // Link the user to the master tenant created above
      tenantId: tenant.id,
    },
  })

  console.log('Database seeded successfully!')
  console.log({
    tenant,
    superAdmin,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })