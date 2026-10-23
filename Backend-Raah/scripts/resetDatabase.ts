import { PrismaClient, UserRole } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Cleaning Raasta Kashmir database for fresh, real-world data...');

  // 1. Delete dependent tables in order to respect foreign key constraints
  console.log('🗑️  Deleting all DMS incidents...');
  await prisma.dmsIncident.deleteMany({});

  console.log('🗑️  Deleting all trips...');
  await prisma.trip.deleteMany({});

  console.log('🗑️  Deleting all students...');
  await prisma.student.deleteMany({});

  console.log('🗑️  Deleting all existing users (drivers, parents, test admins)...');
  await prisma.user.deleteMany({});

  console.log('🗑️  Deleting all buses...');
  await prisma.bus.deleteMany({});

  // 2. Ensure Kashmir Valley School exists as tenant root
  console.log('🏫 Ensuring Kashmir Valley School tenant exists...');
  const school = await prisma.school.upsert({
    where: { name: 'Kashmir Valley School' },
    update: {},
    create: {
      name: 'Kashmir Valley School',
      address: 'Hazratbal, Srinagar, Jammu & Kashmir 190006',
      contactEmail: 'admin@kashmirvalleyschool.edu',
      contactPhone: '+91 194 242 1234',
    },
  });

  // 3. Ensure Default Planned Routes exist with stops
  console.log('🛣️  Verifying school bus routes...');
  const existingRoutes = await prisma.route.findMany({ where: { schoolId: school.id } });
  if (existingRoutes.length === 0) {
    console.log('📍 Seeding standard Srinagar routes...');
    await prisma.route.create({
      data: {
        name: 'Lal Chowk ➔ Kashmir Valley School',
        description: 'Main City Center to Hazratbal Campus via Khanyar and Hawal',
        schoolId: school.id,
        stops: {
          create: [
            { name: 'Lal Chowk (Ghanta Ghar)', latitude: 34.0725, longitude: 74.8105, stopOrder: 1 },
            { name: 'Khanyar Chowk', latitude: 34.0882, longitude: 74.8214, stopOrder: 2 },
            { name: 'Hawal', latitude: 34.1025, longitude: 74.8198, stopOrder: 3 },
            { name: 'Hazratbal Dargah', latitude: 34.1278, longitude: 74.8432, stopOrder: 4 },
            { name: 'Kashmir Valley School Campus', latitude: 34.1295, longitude: 74.8458, stopOrder: 5 },
          ],
        },
      },
    });

    await prisma.route.create({
      data: {
        name: 'Rajbagh ➔ Kashmir Valley School',
        description: 'Civil Lines & Boulevard corridor to Hazratbal',
        schoolId: school.id,
        stops: {
          create: [
            { name: 'Rajbagh Silk Factory', latitude: 34.0621, longitude: 74.8214, stopOrder: 1 },
            { name: 'TRC Crossing', latitude: 34.0712, longitude: 74.8298, stopOrder: 2 },
            { name: 'Dalgate Bus Stop', latitude: 34.0815, longitude: 74.8365, stopOrder: 3 },
            { name: 'Nishat Garden Link', latitude: 34.1198, longitude: 74.8789, stopOrder: 4 },
            { name: 'Kashmir Valley School Campus', latitude: 34.1295, longitude: 74.8458, stopOrder: 5 },
          ],
        },
      },
    });
  }

  console.log('\n======================================================');
  console.log('✨ DATABASE CLEANSE COMPLETE!');
  console.log('======================================================');
  console.log('1. All test drivers, admins, parents, buses, and trips removed.');
  console.log('2. Kashmir Valley School and 2 Srinagar routes are ready.');
  console.log('3. Organization Secret Key for School Admin signup:');
  console.log('   👉 RAASTA_ADMIN_SECRET_2026');
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Database cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
