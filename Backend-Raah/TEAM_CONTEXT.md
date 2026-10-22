# 🚀 PROJECT CONTEXT & AGENT DIRECTIVE: RAASTA KASHMIR (PHASE 2)

> ⚠️ **MANDATORY INSTRUCTION FOR ANTIGRAVITY AI AGENTS:**  
> This repository is being actively developed by **TWO ENGINEERS IN PARALLEL** on separate Git branches.  
> You must identify whether you are assisting **Person 1 (Team Lead)** or **Person 2 (Teammate)** and **STRICTLY RESTRICT YOUR ACTIONS** to that person's assigned branch and files.  
> **DO NOT modify, overwrite, or delete files owned by the other person.**

---

## 1. Project High-Level Mission & State
* **Project Name:** Safe School Bus Kashmir (Raasta Kashmir)
* **Goal:** Real-time school bus fleet tracking and on-device AI Driver Monitoring System (DMS).
* **Current Phase:** **Phase 2 — Central Backend Architecture, PostgreSQL Database & Real-Time Telemetry**.
* **Stack:**
  * **Frontend:** React Native / Expo (`D:\RAAH/src`)
  * **Backend Workspace:** Node.js, Express (TypeScript), Socket.io, Prisma ORM, PostgreSQL (`D:\RAAH/Backend-Raah`)
  * **Production Server:** Ubuntu Linux (`103.14.120.52`), Docker containerized, Port `4000`.

---

## 2. Active Git Branching Strategy
* **Person 1 (Team Lead):** Working on branch 👉 **`feat/telemetry-db`**
* **Person 2 (Teammate):** Working on branch 👉 **`feat/auth-apis`**
* **Merge Rule:** All code merges into `main` via GitHub Pull Requests (PRs). **Never push directly to `main`!**

---

## 3. Clear Division of Labor & File Ownership

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PERSON 1: YOU (TEAM LEAD)                         │
│                    Git Branch: `feat/telemetry-db`                     │
├────────────────────────────────────────────────────────────────────────┤
│ EXCLUSIVE FILES OWNED:                                                 │
│ • Backend-Raah/prisma/schema.prisma  (Database Models & Migrations)    │
│ • Backend-Raah/src/sockets/          (Socket.io Telemetry & Rooms)     │
│ • D:\RAAH/src/services/api/          (Client App Live Socket Wiring)   │
│ • Backend-Raah/Dockerfile            (Production Containerization)     │
│ • Backend-Raah/docker-compose.yml    (PostgreSQL Database Service)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ SHARED API CONTRACTS & TYPES
                                    │
┌───────────────────────────────────┴────────────────────────────────────┐
│                  PERSON 2: TEAMMATE (CORE DEVELOPER)                   │
│                     Git Branch: `feat/auth-apis`                       │
├────────────────────────────────────────────────────────────────────────┤
│ EXCLUSIVE FILES OWNED:                                                 │
│ • Backend-Raah/src/server.ts         (Express Server Entry & Mounting) │
│ • Backend-Raah/src/utils/password.ts (Bcrypt Password Hashing)         │
│ • Backend-Raah/src/utils/jwt.ts      (JWT Token Generation & Verify)   │
│ • Backend-Raah/src/middleware/auth.ts(JWT Auth Guard & Role Checking)  │
│ • Backend-Raah/src/controllers/      (Auth, Trips, Fleet, DMS Handlers)│
│ • Backend-Raah/src/routes/           (REST Express API Routes)         │
│ • Backend-Raah/prisma/seed.ts        (Kashmir Valley School Mock Data) │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 🤖 SPECIAL INSTRUCTIONS FOR PERSON 2'S ANTIGRAVITY AGENT

If you are running in **Person 2's session** (working on branch **`feat/auth-apis`**), here are your non-negotiable operating rules:

### 🛑 Boundary Constraints (DO NOT TOUCH):
1. **DO NOT edit `Backend-Raah/prisma/schema.prisma`:**  
   Person 1 (Team Lead) is authoring the schema and running migrations on `feat/telemetry-db`. You will consume the generated `@prisma/client`.
2. **DO NOT edit or create files in `Backend-Raah/src/sockets/`:**  
   Real-time WebSocket telemetry and room fan-out are handled exclusively by Person 1.
3. **DO NOT touch client frontend files in `D:\RAAH/src`:**  
   Focus 100% on the backend server inside `D:\RAAH/Backend-Raah`.

---

### 📋 Person 2 Immediate Step-by-Step Task Checklist:

#### Task 2.1 — Express Server Setup (`src/server.ts`)
* Initialize Express app with `cors()`, `express.json()`, and `dotenv.config()`.
* Add basic health route: `GET /api/health` $\to$ `{ status: "ok", uptime: process.uptime(), timestamp: Date.now() }`.
* Set up port listening on `process.env.PORT || 4000`.
* Add `"dev": "ts-node src/server.ts"` to `package.json` scripts.

#### Task 2.2 — Security Utilities (`src/utils/`)
* **`src/utils/password.ts`**:
  * `hashPassword(plainText: string): Promise<string>` using `bcryptjs` (salt rounds: 10).
  * `comparePassword(plainText: string, hashed: string): Promise<boolean>`.
* **`src/utils/jwt.ts`**:
  * `generateToken(payload: { userId: string, role: string, email: string }): string` (expires in `7d`).
  * `verifyToken(token: string): JwtPayload | null`.

#### Task 2.3 — Authentication Middleware (`src/middleware/auth.ts`)
* `authenticateToken(req, res, next)`:
  * Reads `Authorization: Bearer <token>` from HTTP headers.
  * Verifies token with `verifyToken()`.
  * Attaches user object to `req.user`. Returns `401 Unauthorized` if token is missing or invalid.
* `requireRoles(...allowedRoles: string[])`:
  * Middleware factory ensuring `req.user.role` matches (e.g. `requireRoles('driver', 'admin')`). Returns `403 Forbidden` if unauthorized.

#### Task 2.4 — Authentication Controller & Routes
* **`src/controllers/authController.ts`**:
  * `register(req, res)`: Hashes password and prepares user creation.
  * `login(req, res)`: Verifies email/password and returns `{ token, user }`.
* **`src/routes/authRoutes.ts`**:
  * `POST /api/auth/register`
  * `POST /api/auth/login`
  * `GET /api/auth/me` (Protected by `authenticateToken`).

#### Task 2.5 — Trips & Safety Incident Ingestion
* **`src/controllers/tripController.ts` & `src/routes/tripRoutes.ts`**:
  * `POST /api/trips/start` (Protected, driver only).
  * `POST /api/trips/end` (Protected, driver only).
  * `GET /api/fleet/buses` (Protected).
* **`src/controllers/dmsController.ts` & `src/routes/dmsRoutes.ts`**:
  * `POST /api/dms/incident` (Accepts violation telemetry: `tripId`, `violationType`, `severity`, `confidence`, `timestamp` and saves record).

---

## 5. Person 2 Antigravity Kickoff Prompt

When Person 2 opens Antigravity on their computer, they can give this exact prompt:

```text
Please read TEAM_CONTEXT.md. I am Person 2 working on branch 'feat/auth-apis'. 
Follow the task checklist in Section 4. 
Let's begin with Task 2.1: setting up `src/server.ts` and Task 2.2: security helpers in `src/utils/`.
```
