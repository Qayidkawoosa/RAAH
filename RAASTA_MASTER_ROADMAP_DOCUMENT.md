# RAASTA KASHMIR: Complete Master Product Blueprint & 4-Phase Roadmap
**Project Title:** Safe School Bus Kashmir (Raasta Kashmir)  
**Author / Presenter:** Engineering Lead & DMS Integration Team  
**Audience:** Project Director, Engineering Mentors & Core Development Team  
**Document Version:** 2.0 (Post-Inspection & Server Deployment Blueprint)  

---

## Executive Summary: What is Raasta Kashmir?

**Raasta Kashmir** is an integrated, safety-critical school transportation and driver monitoring platform designed specifically for the unique terrain and operational challenges of the Kashmir valley.

The system solves three critical real-world problems:
1. **Parent Anxiety & Student Safety:** Parents have real-time visibility into their child’s school bus location, stop arrival countdowns, and instant drop-off confirmations.
2. **Preventative Driver Safety (On-Device AI DMS):** Instead of relying on passive GPS trackers, Raasta actively monitors driver attentiveness in the cabin using computer vision AI—detecting microsleep, fatigue, mobile phone distractions, and seatbelt compliance in real time to prevent accidents before they occur.
3. **School Administrative Governance & RTO Compliance:** School authorities and traffic regulators receive automated incident audit trails, speed violation logs, and route-detour alerts on a centralized dashboard.

### The Final 3-Tier Product Architecture
* 📱 **Driver Mobile Console (Android APK):** Dashboard-mounted smartphone running offline on-device MediaPipe AI vision (via an external wide-angle/IR USB-OTG camera) and background GPS tracking.
* 📱 **Parent Mobile App (Android/iOS):** Clean, real-time tracking interface showing only their child's bus, live ETA countdown, and safety alerts.
* 💻 **School Admin & RTO Web Portal (Desktop Browser):** High-density fleet overview monitoring dozens of buses simultaneously, with an incident review audit queue for flagged driver violations.
* ☁️ **Central Company Cloud Server:** Ubuntu Linux server running Node.js/Express, a Socket.io WebSocket engine for sub-second GPS broadcasting, and a persistent PostgreSQL database.

---

## The Master Architectural Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PHYSICAL SCHOOL BUS CABIN                                     │
│                                                                                                 │
│   [ External USB-OTG Camera ] ──(Wide-angle / IR Night Vision)                                  │
│                 │                                                                               │
│                 ▼                                                                               │
│   [ Driver Dashboard Android Phone ]                                                            │
│     • Native Android UVC Driver (15 FPS @ 640x480 - Zero Overheating)                           │
│     • On-Device MediaPipe Tasks (Face, Pose, Hands, Phone Object Detection)                     │
│     • Raasta DMS Core (PERCLOS, Gaze Distraction, Seatbelt Fusion, Calling vs Texting)          │
│     • Audio Chime & In-Cab Warning Banners                                                      │
│     • Native GPS Sensor (expo-location)                                                         │
└─────────────────┬───────────────────────────────────────────────────────────────────────────────┘
                  │
                  │ Encrypted Cellular 4G/5G (HTTPS & WSS)
                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CENTRAL COMPANY CLOUD SERVER                                    │
│                              (Ubuntu Linux 22.04 LTS · Static IP)                               │
│                                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │ Nginx Reverse Proxy (SSL / TLS Termination · Port 80/443 -> Port 5000/5001)             │   │
│   └────────────────────────────┬────────────────────────────────────────────┬───────────────┘   │
│                                │                                            │                   │
│                                ▼                                            ▼                   │
│   ┌──────────────────────────────────────────────┐ ┌────────────────────────────────────────┐   │
│   │ Node.js / Express REST API Engine (Port 5000)│ │ Socket.io WebSocket Server (Port 5001) │   │
│   │ • Auth & Role-Based Access Control (RBAC)    │ │ • Room-based Channel Broadcasting      │   │
│   │ • Trip Lifecycle (Start / Detour / Complete) │ │ • Sub-second GPS Location Relays       │   │
│   │ • Student Rosters & Stop Sequencing          │ │ • Emergency Violation Broadcasts       │   │
│   │ • DMS Incident Archival                      │ │ • Redis In-Memory Geospatial Cache     │   │
│   └──────────────────────┬───────────────────────┘ └────────────────────────┬───────────────┘   │
│                          │                                                  │                   │
│                          ▼                                                  ▼                   │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │ PostgreSQL Relational Database (Port 5432)                                              │   │
│   │ • users, schools, buses, routes, route_stops, students, trips, dms_incidents            │   │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────────┬───────────────────┘
                                 │                                            │
           Subscribed Bus Stream │                                            │ Fleet Telemetry
                                 ▼                                            ▼
┌──────────────────────────────────────────────┐ ┌────────────────────────────────────────────────┐
│              PARENT MOBILE APP               │ │           SCHOOL ADMIN & RTO WEB PORTAL        │
│          (React Native on Android/iOS)       │ │            (Desktop Chrome / Edge / Safari)    │
│                                              │ │                                                │
│ • Live Map Marker Moving in Real Time        │ │ • Full Multi-Bus Interactive Fleet Map         │
│ • Stop Arrival Countdown (< 5 min alert)     │ │ • DMS Incident Review Audit Queue (Snapshots)  │
│ • Child Boarding / Drop-off Status           │ │ • Speeding & Route Detour Detection            │
│ • Emergency Direct-to-School Call            │ │ • Driver Safety Compliance League Table        │
└──────────────────────────────────────────────┘ └────────────────────────────────────────────────┘
```

---

## Detailed 4-Phase Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1 (Current Milestone): Frontend Architecture, Local AI Validation & Concept Demonstration │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2 (Weeks 1 to 3): Live Company Server Deployment, PostgreSQL Database & Real-Time Sync    │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3 (Weeks 4 to 6): Application Specialization (Dedicated Mobile APKs vs. Desktop Portal)   │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4 (Weeks 7 to 8): Physical Bus Hardware Setup, OTG Camera Tuning & Real-World Road Pilot  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

# PHASE 1: Frontend Architecture, Local AI Validation & Concept Demonstration
* **Status:** Complete & Ready for Tomorrow's Demonstration.
* **Core Principle:** **100% Deterministic & Self-Contained.** Zero external server dependencies, guaranteeing that presentation-room Wi-Fi dropouts cannot disrupt the demo.

### 1.1 What Has Been Accomplished in the Codebase (`D:\RAAH`)
1. **Full DMS Engine Ported:** All 17 specialized modules from our original vision core (`D:\Driver-Attention\src\core`) are active in `src/services/dms/core/`.
   - **PERCLOS Tracker:** Adaptive rolling baseline eye closure with microsleep detection at 1.5 seconds.
   - **Phone Detector Engine:** Differentiates calling posture (phone anchored to ear) from texting posture (downward gaze deflection), rejecting false positives.
   - **Seatbelt Hybrid Fusion:** Dual-torso geometry combining edge-detection and contrast transects.
   - **Hands-On-Wheel (HOW):** Geometric zone classification for steering compliance.
2. **Realistic GPS Route Simulation:**
   - Implemented real-world Srinagar coordinates along Dal Lake Boulevard, Nishat, and Dalgate (`demoRoute.ts`).
   - The simulation loop advances the bus realistically, calculates stop arrival ETAs, and triggers detour alerts if diverted.
3. **Multi-Role User Experience:**
   - Pre-configured demo personas for **Driver** (`driver@raasta.com`), **School Admin** (`admin@raasta.com`), and **Parent** (`parent@raasta.com`).
4. **Driver Heads-Up Display (HUD) & AI Vision Cockpit:**
   - Built a native driver telemetry bar showing PERCLOS %, Hands status, and Seatbelt status.
   - Clicking **`AI Cockpit`** launches real-time client-side MediaPipe landmark inference on the live camera.
5. **School Incident Review Queue:**
   - Critical driver safety events automatically forward to the School Admin's review queue (`SchoolIncidentReviewScreen.tsx`) with timestamps and AI confidence scores.

### 1.2 The Exact 5-Minute Script for Tomorrow's Presentation

#### Minute 0:00 – 0:30: The Problem Statement & Vision
> *"Good morning, Sir. Today we are demonstrating V1 of Raasta Kashmir. Traditional school bus systems only track GPS, which tells you where a bus is, but tells you nothing about what is happening inside the cabin. Raasta combines real-time route telemetry with on-device computer vision AI to actively protect students by monitoring driver alertness and fatigue."*

#### Minute 0:30 – 2:00: The Driver Journey & GPS Simulation
* Log in as **Driver** (`driver@raasta.com` / `password123`).
* Point out the bus route on the Srinagar map and tap **"Start Trip"**.
* Show the live GPS simulation moving smoothly along Boulevard Road, next stop countdown updating, and pickup progress.
* Tap **"Simulate Detour"**:
  > *"Notice how the system immediately flags that the driver has diverted onto Boulevard Road Route B, alerting both the driver and the school fleet manager."*

#### Minute 2:00 – 3:45: The "Hero" Feature — Live AI DMS Cockpit
* Direct attention to the **DMS Heads-Up Bar** showing PERCLOS %, Hands on wheel, and Seatbelt status.
* Tap **`AI Cockpit`** to launch the camera view.
* **Live Test 1 (Microsleep / Drowsiness):**
  - Close your eyes continuously for 1.5 seconds.
  - The PERCLOS meter turns red, an audible alert chime plays, and a critical banner triggers: `CRITICAL: Microsleep Warning`.
* **Live Test 2 (Phone Distraction):**
  - Pick up a smartphone and hold it to your ear.
  - MediaPipe associates hand joints with ear proximity, framing the phone in amber and logging: `CALLING (AT EAR)`.
* *(Safety Backup)*: Mention the built-in **Hardware Test Simulator tray** (`Test` button) that allows instant testing of all edge cases with one click.

#### Minute 3:45 – 4:45: The School Fleet Audit Queue
* Log out and log in as **School Admin** (`admin@raasta.com` / `password123`).
* Navigate to **Incident Review Queue**.
* Show the violations that occurred during the driver test:
  > *"Every critical violation captured in the bus cabin lands directly on the school administrator's desk with bus number, exact time, and AI confidence score for administrative confirmation or dismissal."*

#### Minute 4:45 – 5:00: The Transition to Phase 2 (The Ask)
* Conclude with the roadmap:
  > *"Sir, today's demo proves that our client-side user journeys, simulation engines, and AI safety rules are 100% functional. To make this run across real physical devices—where a driver moving on a real bus broadcasts to parents at home—our next milestone is Phase 2: deploying our backend and database to the company server you offered."*

---

# PHASE 2: Live Company Server Deployment, PostgreSQL Database & Real-Time Sync
* **Timeline:** Weeks 1 to 3
* **Primary Objective:** Deploy the central backend, database, and real-time WebSocket communication hub onto the **Company Server**, enabling real multi-device communication over the public internet.

### 2.1 Understanding the Role of the Company Server
On a live route, a driver’s phone cannot connect directly to 40 different parents' phones. The **Company Server** acts as the central cloud relay:
1. It runs 24/7 on Ubuntu Linux with a static public IP address.
2. It hosts the **Node.js REST API** (managing trips, accounts, rosters, and safety incident history).
3. It runs the **Socket.io WebSocket Server** (ingesting driver GPS coordinates every 2 seconds and broadcasting them to parents in under 500 milliseconds).
4. It hosts the **PostgreSQL Database** (ensuring student records, bus allocations, and driver violation audits are permanently stored).

### 2.2 Server Setup & Software Stack
* **Operating System:** Ubuntu 22.04 LTS
* **Web Server / Reverse Proxy:** Nginx (configured with Let's Encrypt SSL certificates for HTTPS and WSS)
* **Process Manager:** PM2 (ensures the Node.js application auto-restarts on crashes or server reboots)
* **Database Engine:** PostgreSQL 15+
* **Backend Framework:** Node.js (v20 LTS) with Express / TypeScript
* **Caching Layer:** Redis (used for sub-second geospatial caching: `GEOADD` and `GEORADIUS`)

### 2.3 Complete Relational Database Schema Design
```sql
-- 1. USERS & ROLES
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('DRIVER', 'PARENT', 'SCHOOL_ADMIN', 'RTO')),
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SCHOOLS
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. BUS FLEET
CREATE TABLE buses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    vehicle_number VARCHAR(50) UNIQUE NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 32,
    status VARCHAR(50) DEFAULT 'IDLE' CHECK (status IN ('ACTIVE', 'IDLE', 'MAINTENANCE')),
    current_driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ROUTES & STOPS
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path_polyline JSONB NOT NULL, -- GeoJSON array of [lat, lng]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    stop_name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    sequence_order INTEGER NOT NULL,
    scheduled_pickup_time TIME NOT NULL
);

-- 5. STUDENTS
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    assigned_bus_id UUID REFERENCES buses(id) ON DELETE SET NULL,
    assigned_stop_id UUID REFERENCES route_stops(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    current_status VARCHAR(50) DEFAULT 'HOME' CHECK (current_status IN ('HOME', 'ON_BUS', 'AT_SCHOOL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. ACTIVE & HISTORICAL TRIPS
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_id UUID REFERENCES buses(id) ON DELETE RESTRICT,
    driver_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    route_id UUID REFERENCES routes(id) ON DELETE RESTRICT,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABORTED')),
    max_speed_recorded DOUBLE PRECISION DEFAULT 0.0,
    detour_detected BOOLEAN DEFAULT FALSE
);

-- 7. BREADCRUMB GPS TELEMETRY
CREATE TABLE trip_gps_points (
    id BIGSERIAL PRIMARY KEY,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed_kmh DOUBLE PRECISION NOT NULL,
    heading_deg DOUBLE PRECISION,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. DRIVER MONITORING SYSTEM (DMS) SAFETY INCIDENTS
CREATE TABLE dms_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    bus_id UUID REFERENCES buses(id) ON DELETE RESTRICT,
    driver_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    event_type VARCHAR(100) NOT NULL, -- 'MICROSLEEP', 'PHONE_CALL', 'TEXTING', 'DISTRACTION', 'UNBUCKLED'
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    confidence_score DOUBLE PRECISION NOT NULL,
    evidence_snapshot_url TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    speed_at_time DOUBLE PRECISION,
    reviewed_by_admin BOOLEAN DEFAULT FALSE,
    dismissed BOOLEAN DEFAULT FALSE,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2.4 Real-Time GPS & Incident Pipeline Specifications

#### A. Driver Ingestion Channel (`driver:telemetry:push`)
* **Transport:** Secure WebSocket (`WSS`)
* **Interval:** Every 2,000 milliseconds
* **Payload:**
  ```json
  {
    "tripId": "b1a2c3d4-...",
    "busId": "JK-01-AB-1234",
    "lat": 34.08365,
    "lng": 74.79732,
    "speed": 34.5,
    "heading": 87.2,
    "timestamp": 1780000000000
  }
  ```
* **Server Action:**
  1. Writes current coordinate to Redis geospatial index (`GEOADD fleet:locations 74.79732 34.08365 JK-01-AB-1234`).
  2. Buffers point for batch insertion into `trip_gps_points`.
  3. Relays coordinate to room: `bus:JK-01-AB-1234`.

#### B. Parent Live Relay Channel (`bus:telemetry:listen`)
* Parents join room `bus:JK-01-AB-1234` upon logging in.
* Latency target: **< 350 ms** from driver device transmission to parent marker animation.

#### C. Emergency Safety Violation Push (`dms:violation:push`)
* When `dmsEngine.ts` flags a verified violation, it bypasses the periodic GPS timer and sends an immediate high-priority packet.
* The server alerts the School Admin dashboard in real time with an audio alert and records the incident in `dms_incidents`.

### 2.5 What to Ask Your Sir to Begin Phase 2
After tomorrow's presentation, request the following resources:
```text
"Sir, to execute Phase 2, please provide:
 1. SSH access to the company server:
    - Server IP address
    - Username & Password (or SSH Private Key)
    - Sudo/root access to install Node.js, PostgreSQL, and Nginx.
 2. A Google Cloud Maps API key with:
    - Maps SDK for Android enabled
    - Maps JavaScript API enabled
 3. A domain or subdomain pointed to the server IP (e.g., api.raasta.company.com)."
```

---

# PHASE 3: Application Specialization (Dedicated Mobile Apps vs. Web Portal)
* **Timeline:** Weeks 4 to 6
* **Primary Objective:** Separate the unified codebase into specialized applications tailored to their target hardware form factors.

```
┌─────────────────────────────────────────────────────────────┐ ┌─────────────────────────────────────────────────────────────┐
│                 RAASTA DRIVER & PARENT                      │ │                  RAASTA SCHOOL ADMIN & RTO                  │
│                     MOBILE APPS                             │ │                          WEB PORTAL                         │
│             (React Native / Expo Standalone APK)            │ │                 (React / Next.js Desktop Dashboard)         │
├─────────────────────────────────────────────────────────────┤ ├─────────────────────────────────────────────────────────────┤
│ • Compact UI optimized for one-handed mobile use            │ │ • Desktop wide-screen layout (1080p / 4K displays)          │
│ • Android Foreground Service (continuous tracking)          │ │ • Multi-bus live interactive map (50+ vehicles)            │
│ • Offline SQLite storage for network dead zones             │ │ • Incident Review Center with photo evidence review         │
│ • Push notification triggers (Pickup approaching)           │ │ • Student enrollment & route assignment editor              │
└─────────────────────────────────────────────────────────────┘ └─────────────────────────────────────────────────────────────┘
```

### 3.1 Mobile App Specialization (React Native / Android APK)
1. **Persistent Android Foreground Service:**
   - In Android, background apps are killed by battery managers.
   - Configure `react-native-foreground-service` with a persistent status notification (*"Raasta Safety Engine Active - Route JK-01"*).
   - This ensures that if the driver opens Google Maps or takes a phone call, GPS tracking and DMS monitoring continue without interruption.
2. **Offline-First Resilience (Kashmir Valley Mountain Passes):**
   - Certain stretches along mountain routes experience cellular blackouts.
   - Implement a local SQLite/MMKV queue: If the network drops, coordinates and safety events are cached locally on the phone. As soon as connectivity returns, the queue flushes data to the server in chronological order.
3. **Parent Geofence Push Notifications:**
   - Use Google Firebase Cloud Messaging (FCM).
   - The server triggers automated push alerts to parents:
     - *"Bus JK-01 has departed school."*
     - *"Bus is 1 km from your stop (approx. 4 minutes)."*
     - *"Your child has safely boarded the bus."*

### 3.2 School Fleet & RTO Web Portal Specialization
1. **Command & Control Fleet Dashboard:**
   - Built with Next.js / React for desktop web browsers.
   - Displays all active buses across the school district on a high-density vector map.
   - Bus markers dynamically update color:
     - 🟢 **Green:** On schedule, speed compliant, driver attentive.
     - 🟡 **Yellow:** Route detour or speed limit exceeded (>50 km/h).
     - 🔴 **Red:** Active critical DMS violation (microsleep or phone call).
2. **Incident Audit Center:**
   - Transport managers review violation clips and snapshots captured by the DMS.
   - One-click export of driver compliance reports for government transport regulatory compliance.

---

# PHASE 4: Physical Bus Hardware Setup, OTG Camera Tuning & Real-World Road Pilot
* **Timeline:** Weeks 7 to 8
* **Primary Objective:** Install physical hardware inside an operational school bus, calibrate camera angles and illumination, and conduct road testing under actual Kashmir driving conditions.

### 4.1 Bus Cab Hardware Installation Architecture

```
                                  [ BUS ROOF / WINDSHIELD ]
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
          [ Wide-Angle IR USB Camera ]                    [ Vibration-Dampened Mount ]
       (Mounted on A-Pillar or Mirror)                 (Holds Driver Smartphone Securely)
                      │                                               │
                      │ USB Video Cable                               │
                      └───────────────────────┬───────────────────────┘
                                              ▼
                             [ Heavy-Duty USB-C OTG Splitter ]
                             (With Simultaneous Power Passthrough)
                                       │             │
                    15 FPS Video Stream│             │ 12V/24V USB Fast Charging
                                       ▼             ▼
                           [ Driver Phone ]      [ Bus Battery / Fuse Box ]
```

1. **Camera Specifications:**
   - Field of View (FOV): $110^\circ$ to $130^\circ$ (covers driver torso, face, and steering wheel).
   - Sensor: 1080p CMOS with built-in **$850\text{ nm}$ Infrared (IR) LEDs** and an IR cut filter for clear visibility at dawn and inside unlit mountain tunnels.
2. **Power & OTG Passthrough:**
   - Standard phone batteries deplete in 2–3 hours under continuous GPS and AI inference.
   - Install a **Power Delivery (PD) USB-C OTG Y-Cable** connected to a 12V-to-5V step-down vehicle power converter, keeping the smartphone charged at 100% throughout the route.

### 4.2 Native Camera Driver & Hardware Ingestion
- Ensure the native Android module (`UsbCameraDmsModule.kt` / `device_filter.xml`) claims the UVC USB endpoint cleanly upon bus ignition.
- Ingest camera stream at **640x480 resolution capped at 15 FPS**.
  - *Technical rationale:* 15 FPS provides sub-100ms reaction times for microsleep and phone distraction while keeping phone processor temperatures low, preventing thermal shutdowns during hot weather.

### 4.3 Environmental Road Calibration for Kashmir
1. **Pothole & Rough Terrain Filtering:**
   - Kashmir roads frequently present severe bumps and potholes.
   - Calibrate the head pose tracker: Vertical pitch shocks from road bumps must not register as driver nodding/microsleep. A microsleep is only verified if the **Eye Aspect Ratio (EAR)** indicates eye closure along with pitch deflection.
2. **Tunnel & Harsh Sunlight Adaptation:**
   - Transitioning from bright snow glare to dark mountain tunnels causes sudden exposure changes.
   - Calibrate `qualityEvaluator.js` to avoid false "Camera Obstructed" alarms during rapid lighting shifts.
3. **Live 2-Week Fleet Pilot:**
   - Deploy on 1–2 test buses operating on live morning and afternoon routes in Srinagar.
   - Collect driver feedback, verify false-positive rates, and tune alert sensitivities to build driver trust.

---

## Master Milestone Summary

| Phase | Core Deliverable | Target Environment | Key Technical Output |
| :--- | :--- | :--- | :--- |
| **Phase 1 (Immediate)** | **V1 End-to-End Demo** | Local Workstation / Mobile | Client-side GPS simulation, on-device MediaPipe vision in AI Cockpit, and admin incident forwarding. |
| **Phase 2 (Weeks 1–3)** | **Company Server & Real-Time DB** | Ubuntu Linux Server | PostgreSQL schema, Node.js REST API, Socket.io sub-second GPS relays, and live mobile sync. |
| **Phase 3 (Weeks 4–6)** | **Platform Specialization** | Android APK + Desktop Web | Dedicated Driver/Parent mobile apps with persistent foreground services and desktop school audit portal. |
| **Phase 4 (Weeks 7–8)** | **Bus Hardware & Road Pilot** | Operational School Bus | Dashboard USB-OTG camera installation, road vibration rejection, and live route safety verification. |
