import { prisma } from './config/db';

async function main() {
  console.log('⚡ Connecting to Neon Cloud PostgreSQL database...');

  // 1. Create or ensure Kashmir Valley School exists
  const school = await prisma.school.upsert({
    where: { name: 'Kashmir Valley School' },
    update: {},
    create: {
      name: 'Kashmir Valley School',
      address: 'Hazratbal, Srinagar',
      contactEmail: 'admin@kvs.edu.in',
      contactPhone: '+91-194-240001',
    },
  });

  console.log('✅ Successfully connected and verified write access!');
  console.log('🏫 School Record:', school);

  // 2. Query total count
  const count = await prisma.school.count();
  console.log(`📊 Total Schools in Database: ${count}`);

  console.log('🎉 Live PostgreSQL Database is 100% OPERATIONAL!');
}

main()
  .catch((e) => {
    console.error('❌ Database connection failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
