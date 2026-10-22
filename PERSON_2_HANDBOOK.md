# 🚀 Raasta Kashmir (Phase 2) — Person 2 Handbook & Progress Report

**Project:** Safe School Bus Kashmir (Raasta Kashmir)  
**Role:** Person 2 (Core Developer / Backend)  
**Assigned Git Branch:** `feat/auth-apis`  
**Teammate:** Person 1 (Team Lead on branch `feat/telemetry-db`)  
**Workspace:** `Backend-Raah/` (Express, TypeScript, Prisma, PostgreSQL)  
**Status Date:** October 15, 2026  

---

## 1. Division of Labor & Team Boundaries

To ensure zero merge conflicts and smooth parallel development, file ownership is strictly divided:

| Area / File | Owner | Branch | Description |
| :--- | :--- | :--- | :--- |
| `Backend-Raah/prisma/schema.prisma` | **Person 1** | `feat/telemetry-db` | Database Models & Migrations (DO NOT EDIT) |
| `Backend-Raah/src/sockets/` | **Person 1** | `feat/telemetry-db` | Real-time WebSocket Telemetry & Rooms |
| `src/` (Expo App) | **Person 1** | `feat/telemetry-db` | Client App Live Socket Integration |
| `Backend-Raah/src/server.ts` | **Person 2 (You)** | `feat/auth-apis` | Express entry point, middleware, routes mounting |
| `Backend-Raah/src/utils/` | **Person 2 (You)** | `feat/auth-apis` | Security helpers (`password.ts`, `jwt.ts`) |
| `Backend-Raah/src/middleware/` | **Person 2 (You)** | `feat/auth-apis` | Auth guards & role-based access control |
| `Backend-Raah/src/controllers/` | **Person 2 (You)** | `feat/auth-apis` | Auth, Trips, Fleet, and DMS API handlers |
| `Backend-Raah/src/routes/` | **Person 2 (You)** | `feat/auth-apis` | REST endpoints definition |
| `Backend-Raah/prisma/seed.ts` | **Person 2 (You)** | `feat/auth-apis` | Mock school data generation |

---

## 2. Completed Work (Tasks 2.1 & 2.2)

### ✅ Task 2.1 — Express Server Setup
- **File:** `Backend-Raah/src/server.ts`
- **Features Implemented:**
  - Express application initialization with `cors()` and `express.json()`.
  - Environment variable loading via `dotenv.config()`.
  - Welcome endpoint: `GET /` returning system metadata.
  - Health check endpoint: `GET /api/health` (with fallback aliases `/health` and `/api/helth`).
  - Active listener configured on `process.env.PORT || 4000`.

### ✅ Task 2.2 — Security & Cryptographic Utilities
- **`Backend-Raah/src/utils/password.ts`**:
  - `hashPassword(plainText: string): Promise<string>`: Salts and hashes passwords via `bcryptjs` (salt rounds: 10).
  - `comparePassword(plainText: string, hashed: string): Promise<boolean>`: Validates candidates against stored hashes.
- **`Backend-Raah/src/utils/jwt.ts`**:
  - `generateToken(payload: TokenPayload): string`: Signs JWT tokens valid for 7 days (`7d`).
  - `verifyToken(token: string): JwtPayload | TokenPayload | null`: Decodes and validates tokens safely, returning `null` on tamper/expiration.

### ✅ Task 2.3 — Authentication & RBAC Middleware
- **File:** `Backend-Raah/src/middleware/auth.ts`
- **Features Implemented:**
  - `authenticateToken(req, res, next)`: Extracts `Authorization: Bearer <token>`, verifies signature via `verifyToken`, attaches decoded payload to `req.user`, and returns `401 Unauthorized` on missing/invalid/expired tokens.
  - `requireRoles(...allowedRoles)`: Role-based access control factory verifying `req.user.role` against authorized list, returning `403 Forbidden` if unauthorized.
  - Extended Express `Request` type interface with `user?: TokenPayload` for strict type safety.

### ✅ Task 2.4 — Authentication Controller & REST Routes
- **Files:**
  - `Backend-Raah/src/controllers/authController.ts`
  - `Backend-Raah/src/routes/authRoutes.ts`
- **Features Implemented:**
  - `POST /api/auth/register`: Validates email, password strength (>= 6 chars), name, and role. Checks for duplicates, hashes password with `bcryptjs`, issues 7-day JWT, and creates account. Never exposes password hash in response.
  - `POST /api/auth/login`: Validates credentials, compares hashes via `comparePassword()`, issues JWT, and returns sanitized user profile.
  - `GET /api/auth/me`: Protected by `authenticateToken`, returns profile of the logged-in user.
  - Seeded in-memory demo accounts for Srinagar bus drivers, parents, and school managers.

### ✅ Task 2.5 — Trips & DMS Safety Incident Ingestion
- **Files:**
  - `Backend-Raah/src/controllers/tripController.ts` & `Backend-Raah/src/routes/tripRoutes.ts`
  - `Backend-Raah/src/controllers/dmsController.ts` & `Backend-Raah/src/routes/dmsRoutes.ts`
  - `Backend-Raah/src/routes/fleetRoutes.ts`
- **Features Implemented:**
  - `POST /api/trips/start`: Driver starts route trip, updates bus fleet status to `active`, prevents duplicate trip conflicts (`409`).
  - `POST /api/trips/end`: Driver concludes trip, logs distance, avg/max speed, duration, and resets bus status to `idle`.
  - `GET /api/fleet/buses`: Returns live fleet of Valley school buses (DPS, Burn Hall, Mallinson) with active route and driver info.
  - `POST /api/dms/incident`: Ingests AI safety violations (e.g. `MICROSLEEP_DETECTED`, `DRIVER_DISTRACTION`, `PHONE_USE`), computes dynamic safety penalties, and logs telemetry.
  - `GET /api/dms/incidents/:tripId`: Retrieves all safety incidents for a given trip.

### ✅ Task 2.6 — Kashmir Valley Schools Database Seed Script
- **File:** `Backend-Raah/prisma/seed.ts`
- **Features Implemented:**
  - Automated database seeder designed for Prisma ORM (`npm run seed` / `npx prisma db seed`).
  - Populates 3 Valley Schools: *Delhi Public School Srinagar*, *Burn Hall School*, *Mallinson & Tyndale Biscoe*.
  - Populates realistic Srinagar routes with GPS coordinates: Lal Chowk, Pantha Chowk, Athwajan, Boulevard, Nishat, Sonwar, etc.
  - Populates school buses: `BUS-04`, `BUS-07`, `BUS-12`.
  - Populates pre-hashed accounts (`KashmirSafe2026!`): Drivers (Bashir Ahmad, Ghulam Rasool), Parents (Zahoor Wani), School Admins, and RTO Inspection Cell.
  - Populates students linked to parents and route pickup stops.

### ✅ Infrastructure & Environment
- **`Backend-Raah/package.json`**:
  - Full automated test and build commands:
    - `"dev": "ts-node src/server.ts"`
    - `"build": "tsc"`
    - `"start": "node dist/server.js"`
    - `"seed": "ts-node prisma/seed.ts"`
    - `"test:auth": "ts-node scripts/testMiddleware.ts"`
    - `"test:api": "ts-node scripts/testAuthEndpoints.ts"`
    - `"test:trips": "ts-node scripts/testTripsAndDms.ts"`
    - `"test": "npm run test:auth && npm run test:api && npm run test:trips"`
- **`Backend-Raah/tsconfig.json`**:
  - Configured for Node16 module resolution with ES2022 output and strict type safety (`0 errors`).
- **`Backend-Raah/.gitignore` & `.env.example`**:
  - Excluded sensitive `.env` files and `node_modules` from Git tracking.
- **Port Conflict Resolution**:
  - Cleared a legacy background process occupying port 4000. Verified live responses on `http://localhost:4000/api/health`.

---

## 3. Verified Endpoints & Test Results (32/32 Tests Passing - 100%)

### 1. Test Suite Summary
- **Task 2.3 Middleware (`npm run test:auth`)**: **7/7 PASS ✅**
- **Task 2.4 Auth Endpoints (`npm run test:api`)**: **12/12 PASS ✅**
- **Task 2.5 Trips & DMS (`npm run test:trips`)**: **13/13 PASS ✅**
- **Full Suite (`npm test`)**: **32/32 PASS ✅ (100%)**
- **Production Build (`npm run build`)**: **Clean compile (0 errors) ✅**

---

## 4. Person 2 Roadmap Status: 100% COMPLETED 🎉

```
┌─────────────────────────────────────────────────────────────┐
│              PERSON 2 SCOPE OF WORK COMPLETE                │
├─────────────────────────────────────────────────────────────┤
│ ✅ Task 2.1 — Express Server Setup                          │
│ ✅ Task 2.2 — Security & JWT Utilities                      │
│ ✅ Task 2.3 — Authentication & RBAC Middleware              │
│ ✅ Task 2.4 — Auth Controller & REST Routes                 │
│ ✅ Task 2.5 — Trips & DMS Safety Telemetry Ingestion        │
│ ✅ Task 2.6 — Valley Schools Database Seed Script           │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Daily Development Cheatsheet

### Running the Backend Server
```bash
cd Backend-Raah
npm run dev
```

### Type Checking & Build
```bash
cd Backend-Raah
npm run build      # Compiles TypeScript to dist/
npx tsc --noEmit   # Dry-run type checker
```

### Git Workflow for Person 2
```bash
# Verify you are on your feature branch
git branch
# * feat/auth-apis

# Stage and commit your changes
git add Backend-Raah/
git commit -m "feat(auth): set up express server, health check, and security utilities"

# Push to your remote branch (NEVER push to main)
git push origin feat/auth-apis
```
