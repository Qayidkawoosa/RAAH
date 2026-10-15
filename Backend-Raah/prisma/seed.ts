import { prisma } from '../src/config/db';
import { hashPassword } from '../src/utils/password';

export async function seedDatabase() {
  console.log('========================================================');
  console.log('🏔️  SEEDING RAASTA KASHMIR VALLEY SCHOOL DATABASE');
  console.log('========================================================\n');

  const defaultPassword = 'KashmirSafe2026!';
  const hashedPassword = await hashPassword(defaultPassword);

  // -------------------------------------------------------------
  // 1. SEED SCHOOLS
  // -------------------------------------------------------------
  console.log('🏫 Seeding Kashmir Valley Schools...');

  const dpsSchool = await prisma.school.upsert({
    where: { name: 'Delhi Public School Srinagar' },
    update: {},
    create: {
      name: 'Delhi Public School Srinagar',
      address: 'Athwajan, National Highway 1A, Srinagar, J&K 190004',
      contactEmail: 'transport@dpskashmir.edu',
      contactPhone: '+91-194-2467286',
    },
  });

  const burnHallSchool = await prisma.school.upsert({
    where: { name: 'Burn Hall Higher Secondary School' },
    update: {},
    create: {
      name: 'Burn Hall Higher Secondary School',
      address: 'Sonwar Bagh, Srinagar, J&K 190001',
      contactEmail: 'contact@burnhall.edu',
      contactPhone: '+91-194-2452078',
    },
  });

  const mallinsonSchool = await prisma.school.upsert({
    where: { name: 'Mallinson & Tyndale Biscoe School' },
    update: {},
    create: {
      name: 'Mallinson & Tyndale Biscoe School',
      address: 'Sheikh Bagh, Lal Chowk, Srinagar, J&K 190001',
      contactEmail: 'admin@tbms.edu',
      contactPhone: '+91-194-2452295',
    },
  });

  console.log(`✅ Seeded 3 Schools: ${dpsSchool.name}, ${burnHallSchool.name}, ${mallinsonSchool.name}`);

  // -------------------------------------------------------------
  // 2. SEED ROUTES & STOPS (Srinagar City Geography)
  // -------------------------------------------------------------
  console.log('\n🗺️  Seeding Srinagar Bus Routes and Waypoint Stops...');

  const dpsRoute = await prisma.route.create({
    data: {
      name: 'Route 04: Lal Chowk to Athwajan via Pantha Chowk',
      description: 'Morning pickup from City Center through Sonwar to Athwajan Campus',
      schoolId: dpsSchool.id,
      stops: {
        create: [
          { name: 'Lal Chowk Clock Tower', latitude: 34.0725, longitude: 74.8105, stopOrder: 1 },
          { name: 'Rajbagh Bridge', latitude: 34.0674, longitude: 74.8198, stopOrder: 2 },
          { name: 'Sonwar Headquarters', latitude: 34.0631, longitude: 74.8389, stopOrder: 3 },
          { name: 'Pantha Chowk Junction', latitude: 34.0381, longitude: 74.8682, stopOrder: 4 },
          { name: 'DPS Athwajan Campus Gate', latitude: 34.0298, longitude: 74.8821, stopOrder: 5 },
        ],
      },
    },
  });

  const burnHallRoute = await prisma.route.create({
    data: {
      name: 'Route 07: Hazratbal to Sonwar via Boulevard Road',
      description: 'Scenic Dal Lake corridor route serving North Srinagar students',
      schoolId: burnHallSchool.id,
      stops: {
        create: [
          { name: 'Hazratbal Shrine Gate', latitude: 34.1293, longitude: 74.8415, stopOrder: 1 },
          { name: 'Nishat Garden Stop', latitude: 34.1251, longitude: 74.8789, stopOrder: 2 },
          { name: 'Boulevard Ghat 1', latitude: 34.0841, longitude: 74.8462, stopOrder: 3 },
          { name: 'Burn Hall School Sonwar', latitude: 34.0628, longitude: 74.8402, stopOrder: 4 },
        ],
      },
    },
  });

  console.log(`✅ Seeded 2 Routes with 9 GPS Stops.`);

  // -------------------------------------------------------------
  // 3. SEED FLEET BUSES
  // -------------------------------------------------------------
  console.log('\n🚌 Seeding School Bus Fleet...');

  const bus04 = await prisma.bus.upsert({
    where: { busNo: 'BUS-04' },
    update: {},
    create: {
      busNo: 'BUS-04',
      capacity: 34,
      registrationStatus: 'Compliant',
      schoolId: dpsSchool.id,
      routeId: dpsRoute.id,
    },
  });

  const bus07 = await prisma.bus.upsert({
    where: { busNo: 'BUS-07' },
    update: {},
    create: {
      busNo: 'BUS-07',
      capacity: 40,
      registrationStatus: 'Compliant',
      schoolId: burnHallSchool.id,
      routeId: burnHallRoute.id,
    },
  });

  const bus12 = await prisma.bus.upsert({
    where: { busNo: 'BUS-12' },
    update: {},
    create: {
      busNo: 'BUS-12',
      capacity: 30,
      registrationStatus: 'Compliant',
      schoolId: mallinsonSchool.id,
    },
  });

  console.log(`✅ Seeded 3 Buses: ${bus04.busNo}, ${bus07.busNo}, ${bus12.busNo}`);

  // -------------------------------------------------------------
  // 4. SEED USERS & ROLES
  // -------------------------------------------------------------
  console.log('\n👥 Seeding User Accounts (Drivers, Parents, Admins, RTO)...');

  // Driver: Bashir Ahmad (DPS Srinagar)
  const driver1 = await prisma.user.upsert({
    where: { email: 'driver1@kashmirschool.edu' },
    update: {},
    create: {
      email: 'driver1@kashmirschool.edu',
      passwordHash: hashedPassword,
      name: 'Bashir Ahmad Dar',
      phone: '+91-9419012345',
      role: 'DRIVER',
      schoolId: dpsSchool.id,
      assignedBusNo: bus04.busNo,
    },
  });

  // Driver: Ghulam Rasool (Burn Hall)
  const driver2 = await prisma.user.upsert({
    where: { email: 'driver2@kashmirschool.edu' },
    update: {},
    create: {
      email: 'driver2@kashmirschool.edu',
      passwordHash: hashedPassword,
      name: 'Ghulam Rasool Mir',
      phone: '+91-9419023456',
      role: 'DRIVER',
      schoolId: burnHallSchool.id,
      assignedBusNo: bus07.busNo,
    },
  });

  // Parent: Zahoor Wani
  const parent1 = await prisma.user.upsert({
    where: { email: 'parent1@kashmirschool.edu' },
    update: {},
    create: {
      email: 'parent1@kashmirschool.edu',
      passwordHash: hashedPassword,
      name: 'Zahoor Ahmad Wani',
      phone: '+91-9419054321',
      role: 'PARENT',
      schoolId: dpsSchool.id,
    },
  });

  // School Admin: DPS Srinagar
  const adminDps = await prisma.user.upsert({
    where: { email: 'admin@dpskashmir.edu' },
    update: {},
    create: {
      email: 'admin@dpskashmir.edu',
      passwordHash: hashedPassword,
      name: 'DPS Srinagar Transport Office',
      phone: '+91-9419099999',
      role: 'SCHOOL_ADMIN',
      schoolId: dpsSchool.id,
    },
  });

  // RTO Kashmir Officer
  const rtoUser = await prisma.user.upsert({
    where: { email: 'rto@kashmir.gov.in' },
    update: {},
    create: {
      email: 'rto@kashmir.gov.in',
      passwordHash: hashedPassword,
      name: 'Srinagar RTO Inspection Cell',
      phone: '+91-194-2450001',
      role: 'RTO',
    },
  });

  console.log(`✅ Seeded 5 Users (2 Drivers, 1 Parent, 1 School Admin, 1 RTO)`);
  console.log(`   Default Password for all test users: "${defaultPassword}"`);

  // -------------------------------------------------------------
  // 5. SEED STUDENTS
  // -------------------------------------------------------------
  console.log('\n🎒 Seeding Student Profiles...');

  const student1 = await prisma.student.upsert({
    where: { inviteCode: 'DPS-STU-01' },
    update: {},
    create: {
      name: 'Arman Zahoor Wani',
      className: 'Class 5-B',
      inviteCode: 'DPS-STU-01',
      parentId: parent1.id,
      busId: bus04.id,
      status: 'at_home',
    },
  });

  const student2 = await prisma.student.upsert({
    where: { inviteCode: 'DPS-STU-02' },
    update: {},
    create: {
      name: 'Zoya Zahoor Wani',
      className: 'Class 2-A',
      inviteCode: 'DPS-STU-02',
      parentId: parent1.id,
      busId: bus04.id,
      status: 'at_home',
    },
  });

  console.log(`✅ Seeded 2 Students linked to Parent ${parent1.name}`);

  console.log('\n========================================================');
  console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
  console.log('========================================================\n');
}

// Standalone execution check
if (require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error('Seeding error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
