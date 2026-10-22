import app from '../src/server';
import http from 'http';

async function runAuthTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING TASK 2.4 AUTH CONTROLLER & ROUTE TESTS');
  console.log('========================================================\n');

  // Start test server on port 4002 to avoid conflicts
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(4002, resolve));
  const baseUrl = 'http://localhost:4002/api/auth';

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
    // ------------------------------------------------------------------------
    // 1. REGISTER TESTS
    // ------------------------------------------------------------------------
    console.log('--- Register Endpoint (POST /api/auth/register) ---');

    // Test 1: Missing fields
    {
      const res = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@kashmir.edu' }),
      });
      assert(res.status === 400, 'Register fails with 400 if fields are missing');
    }

    // Test 2: Invalid email format
    {
      const res = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'notanemail', password: 'password123', name: 'User' }),
      });
      assert(res.status === 400, 'Register fails with 400 on invalid email format');
    }

    // Test 3: Short password
    {
      const res = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@kashmir.edu', password: '123', name: 'User' }),
      });
      assert(res.status === 400, 'Register fails with 400 if password < 6 characters');
    }

    // Test 4: Successful registration
    const testEmail = `newdriver_${Date.now()}@kashmirschool.edu`;
    let issuedToken = '';

    {
      const res = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'SecretPass2026!',
          name: 'Tariq Butt',
          role: 'driver',
          phone: '+91-9906011223',
        }),
      });
      const data = await res.json();
      issuedToken = data.token;
      const noPasswordLeak = data.user && !('passwordHash' in data.user);
      assert(
        res.status === 201 && !!data.token && data.user.email === testEmail && noPasswordLeak,
        'Register successfully creates account, returns 201 + JWT, and protects passwordHash'
      );
    }

    // Test 5: Duplicate registration prevention
    {
      const res = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'SecretPass2026!',
          name: 'Duplicate Tariq',
        }),
      });
      assert(res.status === 409, 'Register fails with 409 Conflict if email is already taken');
    }

    // ------------------------------------------------------------------------
    // 2. LOGIN TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- Login Endpoint (POST /api/auth/login) ---');

    // Test 6: Missing credentials
    {
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      assert(res.status === 400, 'Login fails with 400 if password is omitted');
    }

    // Test 7: Incorrect password
    {
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: 'WrongPassword!' }),
      });
      assert(res.status === 401, 'Login fails with 401 on incorrect password');
    }

    // Test 8: Non-existent user
    {
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ghost@kashmir.edu', password: 'password123' }),
      });
      assert(res.status === 401, 'Login fails with 401 on non-existent account');
    }

    // Test 9: Successful login with newly created user
    {
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: 'SecretPass2026!' }),
      });
      const data = await res.json();
      assert(
        res.status === 200 && !!data.token && data.user.email === testEmail,
        'Login succeeds with 200 and issues valid JWT'
      );
    }

    // Test 10: Successful login with pre-seeded Kashmir Valley demo account
    {
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'driver1@kashmirschool.edu', password: 'KashmirSafe2026!' }),
      });
      const data = await res.json();
      assert(
        res.status === 200 && data.user.role === 'driver',
        'Login succeeds with pre-seeded Kashmir School demo account (driver1@kashmirschool.edu)'
      );
    }

    // ------------------------------------------------------------------------
    // 3. GET /ME PROFILE TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- Protected Profile Endpoint (GET /api/auth/me) ---');

    // Test 11: Access without token
    {
      const res = await fetch(`${baseUrl}/me`);
      assert(res.status === 401, 'GET /api/auth/me fails with 401 Unauthorized without Bearer token');
    }

    // Test 12: Access with valid JWT
    {
      const res = await fetch(`${baseUrl}/me`, {
        headers: { Authorization: `Bearer ${issuedToken}` },
      });
      const data = await res.json();
      assert(
        res.status === 200 && data.user.email === testEmail && data.user.role === 'driver',
        'GET /api/auth/me returns authenticated profile when valid JWT is provided'
      );
    }

    console.log('\n========================================================');
    console.log(`📊 RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
    console.log('========================================================\n');
  } finally {
    server.close();
  }
}

runAuthTests().catch(console.error);
