# RAASTA KASHMIR: Comprehensive 4-Phase Product Roadmap & Technical Blueprint
**Project:** Raasta Kashmir (Safe School Bus Transportation & Intelligent Driver Monitoring System)  
**Target Architecture:**
- 📱 **Mobile Application (Android/iOS):** Driver Console (with On-Device AI DMS) & Parent Live Tracking.
- 💻 **Web Application (React/Next.js):** School Fleet Operations & Regional Transport Office (RTO) Monitoring.
- ☁️ **Cloud Backend:** Real-time Socket Streaming Server, REST APIs, and Relational Database.

---

## Executive Overview: The Target Product Ecosystem

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    RAASTA ECOSYSTEM                                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                             │
         ┌───────────────────────────────────┼───────────────────────────────────┐
         ▼                                   ▼                                   ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
│      DRIVER MOBILE APP       │ │      PARENT MOBILE APP       │ │   ADMIN & RTO WEB PORTAL     │
│   (React Native on Android)  │ │   (React Native / Expo)      │ │   (Desktop Browser Portal)   │
│                              │ │                              │ │                              │
│ • External USB/OTG Cam Feed  │ │ • Real-time Child Bus Map    │ │ • Fleet Map (Multi-Bus GPS)  │
│ • On-Device MediaPipe DMS    │ │ • Stop Arrival ETA Countdown │ │ • DMS Incident Audit Queue   │
│ • Student Boarding Checklist │ │ • Speed & Detour Alerts      │ │ • Route & Driver Scheduling  │
│ • Route Navigation & Detours │ │ • Direct School SOS Channel  │ │ • Driver Compliance Scoring  │
└──────────────┬───────────────┘ └──────────────▲───────────────┘ └──────────────▲───────────────┘
               │ (GPS + Violations / 2-3s)      │ (Subscribed Bus Telemetry)     │ (Fleet Telemetry)
               ▼                                │                                │
┌────────────────────────────────────────────────────────────────────────────────┴──────────────┐
│                                    CENTRAL CLOUD BACKEND                                      │
│                                (Node.js / Express or NestJS)                                  │
│                                                                                               │
│ • WebSocket Server (Socket.io) ── Real-time low-latency GPS position broadcasting             │
│ • RESTful API Engine ──────────── Authentication, Trips, Routes, Rosters, Incident Ingestion   │
│ • Relational Database (Postgres)  Normalized schemas for Trips, Drivers, Buses, Students, Logs │
│ • Object Storage (AWS S3 / GCS) ── Storing compressed violation evidence snapshots            │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed 4-Phase Implementation Breakdown

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1 (Current Milestone): Frontend Prototyping, Local AI Validation & Concept Verification  │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2 (Weeks 1 to 3): Central Cloud Backend, Real-Time Database & Telemetry Sync            │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3 (Weeks 4 to 6): Application Specialization (Dedicated Mobile Apps vs. Web Portal)     │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4 (Weeks 7 to 8): Physical Bus Hardware Setup, OTG Camera Tuning & Real-World Pilot      │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Frontend Prototyping, Local AI Validation & Concept Verification
* **Timeline:** Current Milestone (Deliverable for Tomorrow's Demonstration)
* **Goal:** Prove the end-to-end user journeys, safety event logic, and computer vision reliability to key stakeholders **without introducing cloud infrastructure dependencies**.

### 1.1 Scope & Architecture
- **In-Memory State & Local Services:** Use the existing simulation services (`simulatorService.ts`, `tripService.ts`, `dmsEngine.ts`) to manage trips, student drop-offs, and driver violations locally on the client.
- **Deterministic GPS Simulation:** Use `demoRoute.ts` with real Srinagar road coordinates (e.g., Dal Lake Boulevard, Nishat, Dalgate). The bus coordinates advance on a timer loop, updating ETA, student pickup progress, and triggering speed/detour alerts.
- **On-Device Vision Pipeline:** Execute the ported DMS core (`src/services/dms/core/`) inside the AI Vision Cockpit (`LiveDriverCockpit.tsx`). Run face mesh, head pose, and phone detection via client-side MediaPipe inference.

### 1.2 Exact Deliverables to Demonstrate
1. **Multi-Role Authentication & Navigation:**
   - Seamlessly switch between **Driver** (`driver@raasta.com`), **School Admin** (`admin@raasta.com`), and **Parent** (`parent@raasta.com`) to demonstrate role-based permissions.
2. **Active Driver Trip Execution:**
   - Driver taps **"Start Trip"** ➔ GPS bus marker moves in real time across the map ➔ ETA counts down.
   - Driver taps **"Simulate Detour"** ➔ Route deviation algorithm detects the detour and triggers an on-screen warning.
3. **Live AI Safety Violation Ingestion:**
   - Open **`AI Cockpit`** with webcam active.
   - **Test Case A (Microsleep):** Close eyes for >1.5 seconds ➔ PERCLOS spikes into the red zone ➔ Audible alert sounds ➔ `CRITICAL: Microsleep Warning` event is logged.
   - **Test Case B (Phone Distraction):** Hold smartphone to ear ➔ Object detector frames phone in amber ➔ Confirms `CALLING (AT EAR)` violation.
4. **Administrative Audit Queue:**
   - Switch to the School Admin account ➔ Open **Incident Review Queue** (`SchoolIncidentReviewScreen.tsx`).
   - The exact violations triggered by the driver appear instantly with timestamps, AI confidence scores, and action buttons (`Confirm Incident` / `Dismiss`).

### 1.3 Transition Criteria to Phase 2
- Stakeholder/Sir approval of the user experience and core safety features.
- Formal sign-off to provision backend server resources.

---

## Phase 2: Central Cloud Backend, Real-Time Database & Telemetry Sync
* **Timeline:** Weeks 1 to 3
* **Goal:** Replace in-memory mock data with a production-grade cloud backend, relational database, and real-time WebSocket communication layer.

### 2.1 Backend Architecture & Technology Stack
- **Runtime:** Node.js (v20 LTS) using **Express** or **NestJS** (TypeScript).
- **Database:** **PostgreSQL 15+** (Relational data integrity is mandatory for student rosters and trip logs).
- **ORM:** **Prisma** or **TypeORM** for type-safe database queries and migrations.
- **Real-Time Communication:** **Socket.io** server with Redis adapter for sub-second GPS streaming.
- **Authentication:** JWT (JSON Web Tokens) with refresh-token rotation and role-based access control (RBAC).

### 2.2 Relational Database Schema Design
```sql
-- Core Database Entities
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'DRIVER', 'PARENT', 'SCHOOL_ADMIN', 'RTO'
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    contact_email VARCHAR(255)
);

CREATE TABLE buses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_number VARCHAR(50) UNIQUE NOT NULL,
    school_id UUID REFERENCES schools(id),
    capacity INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'IDLE' -- 'ACTIVE', 'IDLE', 'MAINTENANCE'
);

CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    name VARCHAR(255) NOT NULL,
    path_coordinates JSONB NOT NULL, -- Array of [lat, lng]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    sequence_order INTEGER NOT NULL
);

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    parent_id UUID REFERENCES users(id),
    bus_id UUID REFERENCES buses(id),
    assigned_stop_id UUID REFERENCES route_stops(id),
    name VARCHAR(255) NOT NULL,
    grade VARCHAR(20),
    current_status VARCHAR(50) DEFAULT 'HOME' -- 'HOME', 'ON_BUS', 'AT_SCHOOL'
);

CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_id UUID REFERENCES buses(id),
    driver_id UUID REFERENCES users(id),
    route_id UUID REFERENCES routes(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS' -- 'IN_PROGRESS', 'COMPLETED', 'ABORTED'
);

CREATE TABLE dms_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id),
    bus_id UUID REFERENCES buses(id),
    driver_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL, -- 'MICROSLEEP', 'PHONE_CALL', 'TEXTING', 'DISTRACTION', 'UNBUCKLED'
    severity VARCHAR(20) NOT NULL,    -- 'INFO', 'WARNING', 'CRITICAL'
    confidence_score DOUBLE PRECISION NOT NULL,
    snapshot_url TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    reviewed_by_admin BOOLEAN DEFAULT FALSE,
    dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2.3 Real-Time GPS Pipeline (Socket.io)
1. **Driver Ingestion Channel (`driver:location:update`):**
   - The driver’s mobile app sends `{ tripId, busId, lat, lng, speed, heading, timestamp }` every **2 seconds**.
   - Server writes latest coordinates to a fast in-memory Redis cache (`geoadd fleet:locations`).
2. **Parent & School Broadcast Channel (`bus:telemetry:<busId>`):**
   - The server pushes sanitized location payloads to rooms subscribed to that specific `busId`.
   - Parents receive live updates with low latency (<500ms).

### 2.4 Cloud Server Provisioning Plan
- **When to Ask Your Sir:** Immediately following the Phase 1 demonstration.
- **Infrastructure Requirements:**
  - **Virtual Server:** Ubuntu 22.04 LTS (AWS EC2 `t3.medium`, DigitalOcean 4GB Droplet, or Hetzner CX31).
  - **Database:** Managed PostgreSQL (AWS RDS db.t4g.micro or DigitalOcean Managed DB).
  - **Object Storage:** AWS S3 or Cloudflare R2 bucket for DMS violation snapshot images.
- **Estimated Budget:** \$25 – \$45 / month for full development & testing infrastructure.

---

## Phase 3: Application Specialization (Dedicated Mobile Apps vs. Web Portal)
* **Timeline:** Weeks 4 to 6
* **Goal:** Split the unified codebase into specialized, platform-optimized applications for each user role.

```
┌───────────────────────────────────────────────┐  ┌───────────────────────────────────────────────┐
│            RAASTA DRIVER & PARENT             │  │            RAASTA SCHOOL ADMIN & RTO          │
│               MOBILE APPS                     │  │                 WEB PORTAL                    │
│          (React Native / Expo APK)            │  │          (React / Next.js Desktop)            │
├───────────────────────────────────────────────┤  ├───────────────────────────────────────────────┤
│ • Native Hardware Camera Access (USB / OTG)   │  │ • Multi-Monitor Wide Screen Dashboard         │
│ • Android Foreground Service (Continuous DMS) │  │ • Full Map Overview (Dozens of Buses)         │
│ • Offline Fallback Queues for Mountain Passes │  │ • Incident Review Audit Queue with Snapshots  │
│ • Push Notifications (Parent Stop Approaching)│  │ • Student Enrollment & Bus Allocation Table   │
└───────────────────────────────────────────────┘  └───────────────────────────────────────────────┘
```

### 3.1 Mobile App Specialization (React Native / Android APK)
1. **Driver Mode Enhancements:**
   - **Continuous Foreground Service:** Integrate an Android Foreground Service notification (*"Raasta Safety Monitor Active"*) so GPS and DMS continue running if the driver switches to Google Maps or minimizes the app.
   - **Offline Event Queue (MMKV / SQLite):** If the bus enters a network dead zone in Kashmir's valleys, store GPS locations and DMS violation timestamps locally. Automatically sync them in batches upon signal recovery.
2. **Parent Mode Enhancements:**
   - Clean, lightweight UI displaying exclusively their child's bus, arrival countdown, and direct emergency buttons.
   - **Geofence Push Notifications:** Trigger alerts when the bus is 1 km / 5 minutes away from the child's pickup point.

### 3.2 School Admin & RTO Web Portal Specialization
1. **Desktop-Optimized Fleet Map:**
   - Replace mobile list views with a full-screen interactive desktop map monitoring all school buses concurrently.
   - Color-coded vehicle markers indicating status (`Green: Normal`, `Amber: Detoured/Delayed`, `Red: Active DMS Critical Violation`).
2. **Incident Management Command Center:**
   - View high-resolution evidence snapshots uploaded by the DMS.
   - Print or export compliance reports for RTO safety inspections.

---

## Phase 4: Physical Bus Hardware Setup, OTG Camera Tuning & Real-World Pilot
* **Timeline:** Weeks 7 to 8
* **Goal:** Mount physical devices inside an operational school bus, test external USB-OTG camera video streaming, tune AI thresholds, and validate reliability under real road conditions.

### 4.1 Bus Cab Hardware Setup
1. **Driver Device:** Android smartphone (minimum 4GB RAM, Android 11+) mounted on a vibration-dampened dashboard cradle.
2. **External Camera:** Wide-angle ($110^\circ - 130^\circ$ FOV) USB camera equipped with automatic **Infrared (IR) LEDs** for night/dawn visibility.
3. **Connectivity & Power:**
   - Heavy-duty USB-C OTG cable with **simultaneous power delivery (Power Passthrough)** to keep the phone continuously charged from the bus 12V/24V accessory socket.

### 4.2 Native Camera Driver & Hardware Ingestion
- Ensure the native Android module (`UsbCameraDmsModule.kt` / `device_filter.xml`) claims the UVC USB endpoint cleanly upon bus ignition.
- Ingest camera stream at **640x480 resolution capped at 15 FPS**.
  - *Technical rationale:* 15 FPS provides sub-100ms reaction times for microsleep and phone distraction while keeping phone processor temperatures low, preventing thermal shutdowns during hot weather.

### 4.3 Environmental Calibration for Kashmir Terrain
1. **Vibration & Bump Rejection:**
   - Kashmir roads present significant potholes and rough patches. Ensure vertical pitch shocks do not falsely register as driver nodding/microsleep by verifying eye aspect ratio (EAR) along with pitch acceleration.
2. **Lighting Adaptation:**
   - Calibrate the quality evaluation engine (`qualityEvaluator.js`) to handle sharp mountain tunnel entries and harsh morning sun glares without false distraction triggers.
3. **Pilot Route Validation:**
   - Execute a 2-week live pilot on 1–2 test routes in Srinagar.
   - Measure real battery drain, memory stability over 2+ hour continuous sessions, and adjust event sensitivity to maintain driver trust.

---

## Milestone Execution Matrix

| Phase | Milestone Deliverable | Infrastructure Required | Timeline |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **V1 Local Demo** (Multi-Role, GPS Simulation, Live AI Vision Cockpit, Admin Queue) | Local Machine / Physical Device | **Immediate (Tomorrow)** |
| **Phase 2** | **Central Cloud Backend** (Node.js API, PostgreSQL DB, Socket.io Real-Time Fleet Streaming) | Cloud Server (AWS / DigitalOcean) + Managed DB | **Weeks 1 – 3** |
| **Phase 3** | **Platform Specialization** (Standalone Driver/Parent Mobile APK + Desktop School/RTO Web Portal) | CI/CD Pipeline (EAS Build / Cloudflare Pages) | **Weeks 4 – 6** |
| **Phase 4** | **Hardware Deployment & Pilot** (USB-OTG Dashboard Setup, Native Ingestion, Field Road Testing) | Physical School Bus + USB IR Camera + OTG Cable | **Weeks 7 – 8** |
