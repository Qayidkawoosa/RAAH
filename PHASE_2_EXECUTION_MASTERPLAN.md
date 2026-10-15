# RAASTA KASHMIR — PHASE 2 SPRINT PLAYBOOK & EXECUTION MASTERPLAN
**Target Window:** 1 to 2 Weeks (14-Day Sprint with 7-Day Fast Track)  
**Author / Team Lead:** Project Lead & Core Development Team  
**Objective:** Transition Raasta Kashmir from a single-device simulation to a live multi-device fleet tracking and driver monitoring platform powered by a central backend server and PostgreSQL database.

---

## 1. What is the Core Mission of Phase 2?
In Phase 1, our app was a self-contained simulation running on one screen.  
In **Phase 2**, we build the **central nervous system** of Raasta Kashmir.

When a school bus driver starts driving in Nishat:
1. Their Android phone sends live GPS coordinates every 1 second ($1\text{ Hz}$) to our central cloud server.
2. The server instantly broadcasts this position to **40 parent smartphones** and the **school principal’s web portal** in under $500\text{ ms}$.
3. If the driver closes their eyes (microsleep) or uses a phone, the event is immediately saved in a **PostgreSQL database** with an audit timestamp and confidence score.

---

## 2. Phase 2 Concrete Deliverables (What Gets Built)

### Deliverable A: Central Backend Server (`/backend`)
* **Runtime:** Node.js (TypeScript) + Express / Fastify.
* **WebSocket Engine:** `Socket.io` with dynamic vehicle rooms (`socket.join("bus_104")`).
* **Containerization:** Production `Dockerfile` and `docker-compose.yml`.

### Deliverable B: Relational Production Database
* **Database:** PostgreSQL 15+ managed via Prisma ORM.
* **Core Schemas:** `users`, `schools`, `buses`, `routes`, `stops`, `trips`, `students`, and `dms_incidents`.

### Deliverable C: Secure REST APIs & Authentication
* JWT-based role authentication (`driver`, `parent`, `school_admin`, `rto`).
* Fleet management & student roster CRUD.
* Incident review queue query endpoints.

### Deliverable D: Client-to-Server App Integration
* Driver app (`D:\RAAH`) sending live phone GPS over WebSockets.
* Parent app listening to live bus rooms and dynamically updating ETAs.
* Automated incident reporting uploading DMS violation events from on-device AI.

### Deliverable E: Company Server Deployment
* Ubuntu Linux deployment with Nginx reverse proxy, HTTPS / WSS SSL encryption, and PM2 process management.

---

## 3. What Will You SEE When Phase 2 is Done? (The Acceptance Test)

You will test Phase 2 by holding **two separate devices in your hands**:

| Screen / Device | What is Happening |
| :--- | :--- |
| **Device 1 (Driver Phone in Hand)** | Driver taps "Start Trip" and walks down the road. The phone acquires real satellite GPS. The camera watches the driver's face. |
| **Device 2 (Parent Phone or Laptop)** | Logged in as a parent at home. **Without refreshing**, the bus marker moves on the map in real-time ($<500\text{ ms}$ delay) following the driver's footsteps. |
| **The Trigger Test** | Driver closes eyes for 2 seconds. Device 1 chimes. Device 2 instantly pops up: *"Safety Alert: Drowsiness detected on Bus 104"*. |
| **The School Dashboard** | The school admin opens their browser and sees the completed trip, average speed, route compliance, and the drowsiness incident logged permanently in the database. |

---

## 4. Two-Person Team Division of Labor

To ensure you and your teammate move fast without stepping on each other's toes, divide responsibilities cleanly:

```
┌──────────────────────────────────────────────┐
│                  TEAM LEAD                   │
│          (Person 1: You - Lead)              │
├──────────────────────────────────────────────┤
│ • PostgreSQL Schema & Prisma Migrations      │
│ • Socket.io Telemetry Server (GPS pub/sub)   │
│ • Client Integration in D:\RAAH (App)        │
│ • Server Deployment on Company Linux Server   │
└──────────────────────┬───────────────────────┘
                       │ Daily Sync
┌──────────────────────┴───────────────────────┐
│               CORE DEVELOPER                 │
│          (Person 2: Teammate)                │
├──────────────────────────────────────────────┤
│ • REST API Endpoints (Auth, Trips, Fleet)    │
│ • DMS Incident Ingestion & Photo Storage     │
│ • Database Seeding (Srinagar routes & stops) │
│ • Admin Incident Review Dashboard API wiring │
└──────────────────────────────────────────────┘
```

---

## 5. Day-by-Day Sprint Roadmap (14 Days Max / 7 Days Fast Track)

### 📅 Phase 2A: The Foundation (Days 1 to 4)
* **Day 1 — Backend Repository & PostgreSQL Initialization:**
  * Initialize the backend project inside `backend/` (`npm init`, TypeScript, Express, Prisma).
  * Configure local PostgreSQL database container via Docker.
* **Day 2 — Database Schema Definition:**
  * Write Prisma schema for `User`, `Bus`, `Trip`, `Student`, `Route`, and `DmsIncident`.
  * Run migrations (`npx prisma migrate dev`) and write a `seed.ts` script populating Kashmir Valley School data.
* **Day 3 — Authentication & Role-Based Access Control:**
  * Implement `/api/auth/login` and `/api/auth/me`.
  * Return JWT tokens encoding user role (`driver`, `parent`, `admin`).
* **Day 4 — Core Fleet & Trip REST Endpoints:**
  * Implement `POST /api/trips/start` and `POST /api/trips/end`.
  * Implement `GET /api/fleet/buses` and `GET /api/students/by-parent`.

---

### 📅 Phase 2B: Real-Time Telemetry & WebSocket Engine (Days 5 to 8)
* **Day 5 — Socket.io Server Architecture:**
  * Set up `Socket.io` attached to the Express HTTP server.
  * Implement vehicle channels:
    * `socket.on("driver:location_update", ({ busId, lat, lng, speed, heading }))`
    * `io.to("bus_" + busId).emit("bus:telemetry", data)`
* **Day 6 — Client Socket Connection in `D:\RAAH`:**
  * Install `socket.io-client` in the mobile app.
  * Create `src/services/api/socketClient.ts`.
  * Replace the local simulation in `TripContext.tsx` with live socket emissions during active trips.
* **Day 7 — Cross-Device Telemetry Testing:**
  * Test device-to-device: Open Driver on phone (or window 1), open Parent on laptop (window 2).
  * Confirm that updating coordinates on Window 1 instantly moves the bus on Window 2.
* **Day 8 — Automated Incident Ingestion:**
  * Build `POST /api/dms/incident` to receive microsleep and phone distraction events.
  * Emit high-priority safety socket alerts: `io.to("school_" + schoolId).emit("dms:violation", payload)`.

---

### 📅 Phase 2C: Integration & Field Deployment (Days 9 to 14)
* **Day 9 — Parent App Real-Time Hookup:**
  * Wire `useBusTracking.ts` to listen to live server WebSockets instead of local simulation.
  * Verify dynamic ETA calculations based on real vehicle speed.
* **Day 10 — School Admin Portal Real-Time Queue:**
  * Connect `SchoolIncidentReviewScreen.tsx` to `/api/dms/incidents`.
  * Display live incident cards with timestamp, driver name, violation type, and severity.
* **Day 11 — Company Linux Server Setup:**
  * SSH into the server provided by your supervisor.
  * Install Docker, Docker Compose, Node.js, and Nginx.
* **Day 12 — Domain & SSL Configuration:**
  * Configure Nginx reverse proxy to forward traffic:
    * HTTP/REST $\to$ Port 4000
    * WebSockets $\to$ `wss://api.raasta...`
  * Install free Let's Encrypt SSL certificate (`certbot`).
* **Day 13 — Field End-to-End Test (The Walking Test):**
  * One team member walks outside with the driver app running on 4G mobile data.
  * The second team member sits in the office watching the live tracking on the dashboard.
* **Day 14 — Hardening & Supervisor Demo:**
  * Verify auto-reconnection on cellular network drops.
  * Prepare live 2-device demonstration for your supervisor.

---

## 6. Immediate Action Items for Today (Day 1 Kickoff)

1. **Create the Backend Workspace:**
   ```powershell
   cd D:\RAAH
   mkdir backend
   cd backend
   npm init -y
   npm install express socket.io cors dotenv jsonwebtoken bcryptjs @prisma/client
   npm install -D typescript ts-node @types/node @types/express @types/cors @types/jsonwebtoken prisma
   npx tsc --init
   npx prisma init
   ```
2. **Assign the Work:**
   * **You:** Initialize the server entry point (`src/server.ts`) and Prisma schema (`prisma/schema.prisma`).
   * **Teammate:** Setup the auth controller (`src/controllers/authController.ts`) and mock seed data.
