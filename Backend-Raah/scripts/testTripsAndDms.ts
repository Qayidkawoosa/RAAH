import app from '../src/server';
import http from 'http';
import { generateToken } from '../src/utils/jwt';

async function runTripsAndDmsTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING TASK 2.5 TRIPS & DMS SAFETY INGESTION TESTS');
  console.log('========================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(4003, resolve));
  const baseUrl = 'http://localhost:4003/api';

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

  const driverToken = generateToken({
    userId: 'driver_srinagar_01',
    role: 'driver',
    email: 'driver1@kashmirschool.edu',
  });

  const parentToken = generateToken({
    userId: 'parent_rajbagh_02',
    role: 'parent',
    email: 'parent1@kashmirschool.edu',
  });

  try {
    // ------------------------------------------------------------------------
    // 1. FLEET BUSES TESTS
    // ------------------------------------------------------------------------
    console.log('--- Fleet Buses (GET /api/fleet/buses) ---');

    // Test 1: Unauthorized access
    {
      const res = await fetch(`${baseUrl}/fleet/buses`);
      assert(res.status === 401, 'GET /api/fleet/buses requires authentication (returns 401 without token)');
    }

    // Test 2: Authorized query
    {
      const res = await fetch(`${baseUrl}/fleet/buses`, {
        headers: { Authorization: `Bearer ${parentToken}` },
      });
      const data = await res.json();
      assert(
        res.status === 200 && Array.isArray(data.buses) && data.buses.length >= 3,
        'GET /api/fleet/buses returns registered Kashmir School bus fleet'
      );
    }

    // ------------------------------------------------------------------------
    // 2. TRIP START TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- Start Trip (POST /api/trips/start) ---');

    // Test 3: Parent role blocked from starting trip
    {
      const res = await fetch(`${baseUrl}/trips/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${parentToken}`,
        },
        body: JSON.stringify({ busNo: 'BUS-04', routeName: 'Route 1' }),
      });
      assert(res.status === 403, 'Parent role rejected with 403 Forbidden on starting a trip');
    }

    // Test 4: Missing fields
    {
      const res = await fetch(`${baseUrl}/trips/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({ busNo: 'BUS-04' }),
      });
      assert(res.status === 400, 'POST /api/trips/start fails with 400 when routeName is omitted');
    }

    // Test 5: Unknown bus
    {
      const res = await fetch(`${baseUrl}/trips/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({ busNo: 'BUS-999', routeName: 'Unknown Route' }),
      });
      assert(res.status === 404, 'POST /api/trips/start returns 404 for unlisted bus number');
    }

    // Test 6: Successfully start trip
    let activeTripId = '';
    {
      const res = await fetch(`${baseUrl}/trips/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({
          busNo: 'BUS-04',
          routeName: 'Lal Chowk to Athwajan via Pantha Chowk',
        }),
      });
      const data = await res.json();
      activeTripId = data.trip?.id;
      assert(
        res.status === 201 && data.trip?.status === 'active' && data.trip?.busNo === 'BUS-04',
        'POST /api/trips/start creates active trip for driver and returns 201'
      );
    }

    // Test 7: Conflict starting trip on already active bus
    {
      const res = await fetch(`${baseUrl}/trips/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({
          busNo: 'BUS-04',
          routeName: 'Duplicate Route Attempt',
        }),
      });
      assert(res.status === 409, 'POST /api/trips/start returns 409 Conflict if bus is already on an active trip');
    }

    // ------------------------------------------------------------------------
    // 3. DMS SAFETY INCIDENT INGESTION TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- DMS Incident Ingestion (POST /api/dms/incident) ---');

    // Test 8: Missing incident fields
    {
      const res = await fetch(`${baseUrl}/dms/incident`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({ tripId: activeTripId }),
      });
      assert(res.status === 400, 'POST /api/dms/incident fails with 400 if violationType is missing');
    }

    // Test 9: Successfully ingest critical incident (microsleep)
    let incidentId = '';
    {
      const res = await fetch(`${baseUrl}/dms/incident`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({
          tripId: activeTripId,
          violationType: 'MICROSLEEP_DETECTED',
          severity: 'CRITICAL',
          confidence: 0.94,
          timestamp: Date.now(),
          metadata: { eyeClosureDurationMs: 2300, perclosScore: 0.88 },
        }),
      });
      const data = await res.json();
      incidentId = data.incident?.id;
      assert(
        res.status === 201 && data.incident?.severity === 'CRITICAL' && data.currentTripSafetyScore === 85,
        'POST /api/dms/incident ingests critical incident and deducts safety score (100 -> 85)'
      );
    }

    // Test 10: Ingest warning incident (phone distraction)
    {
      const res = await fetch(`${baseUrl}/dms/incident`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({
          tripId: activeTripId,
          violationType: 'DRIVER_DISTRACTION',
          severity: 'WARNING',
          confidence: 0.89,
          timestamp: Date.now(),
          metadata: { cue: 'PHONE_DETECTED', headPoseYaw: 38.5 },
        }),
      });
      const data = await res.json();
      assert(
        res.status === 201 && data.currentTripSafetyScore === 80,
        'POST /api/dms/incident ingests warning incident and updates safety score (85 -> 80)'
      );
    }

    // Test 11: Query incidents for trip
    {
      const res = await fetch(`${baseUrl}/dms/incidents/${activeTripId}`, {
        headers: { Authorization: `Bearer ${driverToken}` },
      });
      const data = await res.json();
      assert(
        res.status === 200 && Array.isArray(data.incidents) && data.incidents.length === 2,
        'GET /api/dms/incidents/:tripId retrieves all logged events for active trip'
      );
    }

    // ------------------------------------------------------------------------
    // 4. TRIP END TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- End Trip (POST /api/trips/end) ---');

    // Test 12: End trip successfully
    {
      const res = await fetch(`${baseUrl}/trips/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({
          tripId: activeTripId,
          distanceKm: 14.8,
          avgSpeedKmh: 28.5,
          maxSpeedKmh: 46.0,
        }),
      });
      const data = await res.json();
      assert(
        res.status === 200 && data.trip?.status === 'completed' && typeof data.summary?.durationSeconds === 'number',
        'POST /api/trips/end completes trip, records stats, and returns summary'
      );
    }

    // Test 13: Bus reset check
    {
      const res = await fetch(`${baseUrl}/fleet/buses`, {
        headers: { Authorization: `Bearer ${driverToken}` },
      });
      const data = await res.json();
      const bus04 = data.buses.find((b: any) => b.busNo === 'BUS-04');
      assert(bus04 && bus04.status === 'idle', 'Fleet bus status resets to "idle" upon trip conclusion');
    }

    console.log('\n========================================================');
    console.log(`📊 RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
    console.log('========================================================\n');
  } finally {
    server.close();
  }
}

runTripsAndDmsTests().catch(console.error);
