# Team Engineering Brief: The 4-Phase Product Roadmap
**Project:** Safe School Bus Kashmir (Raasta Kashmir)  
**Target Audience:** Core Engineering Team & Interns  
**Objective:** A concise, clear guide explaining the complete roadmap from today's demo to the physical school bus rollout.

---

## 1. The Big Picture: What We Are Building

We are building a smart school bus safety ecosystem:
1. 📱 **Driver Mobile App (Android):** Live GPS broadcasting, student checklist, and on-device computer vision AI (Driver Monitoring System) watching for fatigue and phone distraction.
2. 📱 **Parent Mobile App (Android/iOS):** Live child bus tracking, arrival countdowns, and safety notifications.
3. 💻 **School Admin Web Portal (Browser):** Central map of all school buses, driver safety scores, and an incident audit queue.
4. ☁️ **Company Cloud Server:** Connects all devices in real time using WebSockets and a PostgreSQL database.

---

## 2. The 4-Phase Roadmap Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1 (Current): Frontend Prototyping & Local AI Validation                   │
│ • Deterministic simulation (no cloud needed) • Live on-device DMS verified     │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2 (Weeks 1–3): Company Server Deployment & Live Database                  │
│ • Node.js API & PostgreSQL DB on company server • Real-time Socket.io GPS sync │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3 (Weeks 4–6): App Specialization (Mobile APK vs. Web Portal)             │
│ • Standalone Driver/Parent APK (with background service) • Desktop Admin Portal│
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4 (Weeks 7–8): Physical Bus Hardware Setup & Field Road Pilot             │
│ • External USB-OTG dashcam • Pothole vibration tuning • Live Srinagar pilot    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Deep Dive into Each Phase

### Phase 1: Frontend Prototyping & Local AI Validation (Current Milestone)
* **Goal:** Prove the full user experience, GPS route navigation, and computer vision safety rules to stakeholders without relying on external servers or internet connectivity.
* **What is built:**
  * **On-Device DMS Engine:** In `src/services/dms/core/`, running real-time MediaPipe face mesh, eye closure (PERCLOS), phone detection, and seatbelt tracking.
  * **GPS Route Simulator:** In `src/services/simulatorService.ts`, simulating real bus movement along Boulevard Road in Srinagar.
  * **Multi-Role Flow:** Pre-configured accounts for Driver, School Admin, and Parent.
  * **Incident Audit Queue:** Real violations on the driver screen automatically forward to the School Admin's review queue.

---

### Phase 2: Company Server Deployment & Live Telemetry (Weeks 1–3)
* **Goal:** Move from a single-device simulation to a **live multi-device system** where a driver walking with a phone broadcasts GPS coordinates to parents over the internet.
* **Key Tasks:**
  1. **Deploy to Company Server:** Log into the company Linux server via SSH, install Node.js, PostgreSQL, Nginx, and PM2.
  2. **Build Database Schema:** Create normalized PostgreSQL tables for `users`, `buses`, `routes`, `stops`, `students`, `trips`, and `dms_incidents`.
  3. **Real-Time GPS Streaming (Socket.io):** Driver phone pushes real GPS coordinates (`expo-location`) every 2 seconds. Server broadcasts to subscribed parents in <500ms.
  4. **Emergency Violation Push:** When a driver closes their eyes for >1.5s or holds a phone to their ear, an instant alert packet is sent to the server and School Admin dashboard.

---

### Phase 3: Platform Specialization (Weeks 4–6)
* **Goal:** Split the codebase into two optimized production distributions.
* **Key Tasks:**
  1. **Mobile Application (Driver & Parent APK):**
     * Add an **Android Foreground Service** so tracking and DMS continue running if the driver switches to Google Maps or takes a call.
     * Implement an **offline SQLite cache** so trips and safety events are stored locally when passing through mountain dead zones and auto-flushed when 4G returns.
     * Implement Firebase push notifications for parents (*"Bus is 5 minutes away"*).
  2. **School Admin & RTO Web Portal (Desktop Browser):**
     * Build a full-screen desktop dashboard to monitor all active buses on one map.
     * Transport managers can inspect photo evidence snapshots of violations and export driver safety reports.

---

### Phase 4: Physical Bus Hardware Setup & Field Road Pilot (Weeks 7–8)
* **Goal:** Deploy the system inside a real school bus in Srinagar using an external USB/OTG camera.
* **Key Tasks:**
  1. **Hardware Cabling & Mounting:**
     * Mount a wide-angle ($110^\circ - 130^\circ$) **Infrared (IR) USB webcam** on the windshield/A-pillar.
     * Connect via a **USB-C OTG Power Delivery splitter** to charge the driver's phone while streaming video.
  2. **Native Android UVC Driver:**
     * Use `UsbCameraDmsModule.kt` to capture frames at a fixed **15 FPS @ 640x480**, leveraging the phone's native NPU to keep temperatures low and prevent thermal throttling.
  3. **Kashmir Terrain Calibration:**
     * Filter out road bumps/potholes so sudden vertical shocks do not falsely trigger nodding/drowsiness alerts.
     * Calibrate exposure for sudden lighting shifts when entering mountain tunnels or snow glare.
  4. **Field Route Testing:** Run a 1-week pilot on a real school bus route to gather driver feedback and fine-tune sensitivity.

---

## 4. Summary Table

| Phase | Duration | Core Deliverable | Infrastructure Used |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Immediate | Local V1 Demo (UI, GPS Simulation, Live AI Cockpit) | Local PC / Expo Go |
| **Phase 2** | Weeks 1–3 | Live Company Server, PostgreSQL Database, Socket.io GPS Sync | Company Linux Server |
| **Phase 3** | Weeks 4–6 | Dedicated Mobile APK (with background service) + Desktop Web Portal | Standalone Mobile Build |
| **Phase 4** | Weeks 7–8 | External USB-OTG Camera, Pothole Tuning & Real Bus Pilot | Physical School Bus + USB Cam |
