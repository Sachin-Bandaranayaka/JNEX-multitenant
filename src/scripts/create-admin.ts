const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const password = await hash('admin123', 12);
  
  // First, create or find the default tenant
  const tenant = await prisma.tenant.upsert({
    where: { name: 'Default Tenant' },
    update: {},
    create: {
      name: 'Default Tenant',
      businessName: 'JNEX Default Business',
      isActive: true,
    },
  });

  // Then create the super admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jnex.com' },
    update: {},
    create: {
      email: 'admin@jnex.com',
      name: 'Super Admin',
      password,
      role: 'SUPER_ADMIN',
      permissions: ['*'],
      tenantId: tenant.id,
    },
  });

  console.log({ tenant, admin });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
