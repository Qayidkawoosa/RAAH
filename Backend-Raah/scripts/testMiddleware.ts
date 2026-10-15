import { authenticateToken, requireRoles } from '../src/middleware/auth';
import { generateToken } from '../src/utils/jwt';
import { Request, Response } from 'express';

function createMock(headers: Record<string, string> = {}, user?: any) {
  const req = {
    headers,
    user,
  } as unknown as Request;

  let statusCode = 200;
  let responseData: any = null;

  const res = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      responseData = data;
      return res;
    },
  } as unknown as Response;

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING TASK 2.3 AUTHENTICATION MIDDLEWARE TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [TEST ${total}] PASS: ${name}`);
    } else {
      console.error(`❌ [TEST ${total}] FAIL: ${name} ${detail ? `(${detail})` : ''}`);
    }
  }

  // 1. authenticateToken: Missing Authorization Header
  {
    const { req, res, getStatus, getData } = createMock();
    let nextCalled = false;
    authenticateToken(req, res, () => { nextCalled = true; });
    assert(getStatus() === 401 && !nextCalled, 'Missing Authorization header returns 401 Unauthorized', JSON.stringify(getData()));
  }

  // 2. authenticateToken: Invalid header format (e.g. Basic instead of Bearer)
  {
    const { req, res, getStatus, getData } = createMock({ authorization: 'Basic randomString123' });
    let nextCalled = false;
    authenticateToken(req, res, () => { nextCalled = true; });
    assert(getStatus() === 401 && !nextCalled, 'Malformed Authorization header returns 401 Unauthorized', JSON.stringify(getData()));
  }

  // 3. authenticateToken: Forged / corrupted token
  {
    const { req, res, getStatus, getData } = createMock({ authorization: 'Bearer invalid.tampered.token' });
    let nextCalled = false;
    authenticateToken(req, res, () => { nextCalled = true; });
    assert(getStatus() === 401 && !nextCalled, 'Invalid / expired JWT token returns 401 Unauthorized', JSON.stringify(getData()));
  }

  // 4. authenticateToken: Valid driver token
  const validToken = generateToken({
    userId: 'driver_srinagar_01',
    role: 'driver',
    email: 'driver1@kashmirschool.edu',
  });

  {
    const { req, res, getStatus } = createMock({ authorization: `Bearer ${validToken}` });
    let nextCalled = false;
    authenticateToken(req, res, () => { nextCalled = true; });
    const userAttached = req.user?.userId === 'driver_srinagar_01' && req.user?.role === 'driver';
    assert(nextCalled && userAttached && getStatus() === 200, 'Valid JWT attaches decoded user to req.user and calls next()');
  }

  // 5. requireRoles: Role matches
  {
    const guard = requireRoles('driver', 'admin');
    const { req, res, getStatus } = createMock({}, { userId: 'driver_01', role: 'driver' });
    let nextCalled = false;
    guard(req, res, () => { nextCalled = true; });
    assert(nextCalled && getStatus() === 200, "User with role 'driver' accesses route allowing ['driver', 'admin']");
  }

  // 6. requireRoles: Role forbidden
  {
    const guard = requireRoles('admin');
    const { req, res, getStatus, getData } = createMock({}, { userId: 'driver_01', role: 'driver' });
    let nextCalled = false;
    guard(req, res, () => { nextCalled = true; });
    assert(!nextCalled && getStatus() === 403, "User with role 'driver' denied 403 Forbidden on ['admin'] route", JSON.stringify(getData()));
  }

  // 7. requireRoles: Multiple roles check (parent accessing parent or school route)
  {
    const guard = requireRoles('parent', 'school');
    const { req, res } = createMock({}, { userId: 'parent_01', role: 'parent' });
    let nextCalled = false;
    guard(req, res, () => { nextCalled = true; });
    assert(nextCalled, "User with role 'parent' accesses route allowing ['parent', 'school']");
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================\n');
}

runTests().catch(console.error);
