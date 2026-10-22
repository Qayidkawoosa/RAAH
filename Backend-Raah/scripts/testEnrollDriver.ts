import app from '../src/server';
import http from 'http';
import { prisma } from '../src/config/db';

async function runEnrollDriverTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING DRIVER ENROLLMENT & ROUTE BINDING TESTS');
  console.log('========================================================\n');

  const server = http.createServer(app);
  const PORT = 4005;
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  const baseUrl = `http://localhost:${PORT}/api`;

  let total = 0;
  let passed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [TEST ${total}] PASS: ${name}`);
    } else {
      console.error(`❌ [TEST ${total}] FAIL: ${name} ${detail ? `(${detail})` : ''}`);
    }
  }

  try {
    // 1. Test GET /api/fleet/routes
    console.log('--- 1. Testing GET /api/fleet/routes ---');
    const routesRes = await fetch(`${baseUrl}/fleet/routes`);
    const routesData = await routesRes.json();
    assert(routesRes.status === 200, 'GET /api/fleet/routes returns 200 OK');
    assert(Array.isArray(routesData.routes) && routesData.routes.length > 0, 'Routes list returned with stops');
    const selectedRoute = routesData.routes[0];
    console.log(`   Found ${routesData.routes.length} routes. Using route "${selectedRoute.name}" (ID: ${selectedRoute.id})`);

    // 2. Test POST /api/fleet/enroll-driver
    console.log('\n--- 2. Testing POST /api/fleet/enroll-driver ---');
    const testBusNo = 'JK-01-AB-9876';
    const testDriverName = 'Tariq Ahmad Dar';
    const testPassword = 'Password@123';
    const testPhone = '9419012345';

    const enrollRes = await fetch(`${baseUrl}/fleet/enroll-driver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverName: testDriverName,
        phone: testPhone,
        busNo: testBusNo,
        routeId: selectedRoute.id,
        password: testPassword,
      }),
    });

    const enrollData = await enrollRes.json();
    assert(enrollRes.status === 201, 'POST /api/fleet/enroll-driver returns 201 Created');
    assert(enrollData.status === 'success', 'Response status is "success"');
    assert(typeof enrollData.driverEmail === 'string' && enrollData.driverEmail.endsWith('@kashmirschool.edu'), 'driverEmail generated correctly');
    assert(enrollData.busNo === testBusNo, 'busNo returned correctly');
    assert(enrollData.routeId === selectedRoute.id, 'routeId bound correctly');
    console.log(`   Driver Enrolled: Email=${enrollData.driverEmail}, Bus=${enrollData.busNo}, RouteId=${enrollData.routeId}`);

    // 3. Verify in PostgreSQL database
    console.log('\n--- 3. Verifying PostgreSQL Transaction ---');
    const dbBus = await prisma.bus.findUnique({
      where: { busNo: testBusNo },
      include: { route: true },
    });
    assert(dbBus !== null, 'Bus record exists in PostgreSQL');
    assert(dbBus?.routeId === selectedRoute.id, 'Bus record has assigned routeId');

    const dbUser = await prisma.user.findUnique({
      where: { email: enrollData.driverEmail },
    });
    assert(dbUser !== null, 'Driver user record exists in PostgreSQL');
    assert(dbUser?.role === 'DRIVER', 'User has role DRIVER');
    assert(dbUser?.assignedBusNo === testBusNo, 'User has assignedBusNo linked');

    // 4. Test driver login with generated email & password
    console.log('\n--- 4. Testing Driver Login with Enrolled Credentials ---');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: enrollData.driverEmail,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'Driver login succeeds with generated credentials');
    assert(loginData.token !== undefined, 'JWT token returned on login');
    assert(loginData.user?.assignedBus === testBusNo, 'Logged in driver has assignedBus');

    // 5. Test GET /api/fleet/driver-route
    console.log('\n--- 5. Testing GET /api/fleet/driver-route ---');
    const driverRouteRes = await fetch(`${baseUrl}/fleet/driver-route?busNo=${testBusNo}`);
    const driverRouteData = await driverRouteRes.json();
    assert(driverRouteRes.status === 200, 'GET /api/fleet/driver-route returns 200');
    assert(driverRouteData.routeId === selectedRoute.id, 'driver-route returns assigned routeId');
    assert(driverRouteData.route?.name === selectedRoute.name, 'driver-route returns assigned route name');
    assert(Array.isArray(driverRouteData.path), 'driver-route returns path coordinates array');

    console.log(`\n========================================================`);
    console.log(`📊 TEST RESULTS: ${passed}/${total} PASSED`);
    console.log(`========================================================\n`);
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    server.close();
    await prisma.$disconnect();
    process.exit(passed === total ? 0 : 1);
  }
}

runEnrollDriverTests();
