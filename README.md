# Raasta Kashmir

### **Every School Trip. Safe. Smart. Connected.**

<p align="center">
  <img src="./assets/icon.png" alt="Raasta Kashmir Logo" width="120" height="120" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-emerald.svg?style=flat-square" alt="License: MIT" />
  <img src="https://img.shields.io/badge/Expo-SDK%2054-blueviolet.svg?style=flat-square" alt="Expo SDK: 54" />
  <img src="https://img.shields.io/badge/language-TypeScript-blue.svg?style=flat-square" alt="Language: TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-green.svg?style=flat-square" alt="Node: >=18" />
  <img src="https://img.shields.io/badge/database-MongoDB-darkgreen.svg?style=flat-square" alt="Database: MongoDB" />
</p>

Raasta Kashmir is a modern, pure-software school transport safety and real-time tracking platform. It connects Parents, School Administrators, Bus Drivers, and Regional Transport Officers (RTO) in a unified ecosystem designed to keep children safe during their daily commute - operating completely from a driver's smartphone without requiring expensive proprietary GPS transponders, IoT hardware, or OBD-II readers.

> [!NOTE]
> Unlike traditional vehicle tracking systems, Raasta Kashmir operates entirely on standard mobile hardware. The app leverages the driver's phone sensors and GPS to run a lightweight local safety engine that calculates overspeeding, deviations, and stop dwell times in real time.

---

## <img src="https://img.shields.io/badge/Features-Overview-34495e?style=flat-square" alt="Features Overview Badge" />

### <img src="https://img.shields.io/badge/1._Driver_Console-00b894?style=flat-square" alt="Driver Application Badge" />
- **Scheduled Trips:** Every bus runs to a timetable (Morning Pickup 9:30 AM, Afternoon Drop 3:30 PM). Tracking arms itself inside the trip window; outside it the console counts down to the next departure.
- **Zero-Friction Workflow:** Uses geofencing to automatically start trips when leaving school zones (>150m) and end them upon arrival.
- **Telemetry Console:** Live speed monitoring with visual warnings against the local speed limits.
- **Stop Proximity & Boarding:** Detects upcoming pickup points, lists students waiting at each stop, and provides a quick messaging portal.
- **Emergency SOS:** Instant one-tap SOS trigger broadcasts red alerts and real-time locations to school authorities and parents.

### <img src="https://img.shields.io/badge/2._Parent_Portal-6c5ce7?style=flat-square" alt="Parent Portal Badge" />
- **Real-time Bus Tracking:** Follow the assigned bus on a live map with heading, current speed, and dynamic ETA calculations.
- **Smart Proximity Alerts:** Notifications when the bus enters `approaching` (1 km) or `imminent` (500m) thresholds of their selected pickup stop.
- **Invite-Link Verification:** Connect parents securely to student profiles using secure invite codes (e.g. `STU-1`).
- **Direct Report Filing:** Report transport concerns directly to the school administration with instant AI category and severity triaging.

### <img src="https://img.shields.io/badge/3._School_Dashboard-0984e3?style=flat-square" alt="School Dashboard Badge" />
- **Live Fleet Monitor:** Observe all active buses, live locations, and status tags (Live, Idle, Done, SOS) on a central dashboard.
- **Student Roster Management:** Add a student with their class, assign them to a bus and a pickup stop, and remove them again — listed grouped per bus with live counts.
- **AI Fleet Insights:** Automated weekly reports summarizing fleet performance trends, safety scores, and recurring hazard hotspots.
- **Smart Complaints Inbox:** View and manage parent concerns automatically categorized and prioritized by an AI triage engine, with an `open → reviewing → resolved` workflow the parent can follow.

### <img src="https://img.shields.io/badge/4._RTO_Inspectorate-2d3436?style=flat-square" alt="RTO Dashboard Badge" />
- **District Live Fleet:** Track every registered bus in one place — running or parked, its route, driver, student count, live speed and next stop, with a full-screen map for any vehicle.
- **Compliance & Audits:** Monitor vehicle insurance validity and inspection dates, with non-compliant vehicles flagged for action.
- **Violation Logs:** Track historical speeding events, unauthorized detours, and trigger alerts.
- **Driver Performance Leaderboard:** View and rank drivers according to historical safety indices to reward compliance.

---

## <img src="https://img.shields.io/badge/Demo-Credentials-fdcb6e?style=flat-square" alt="Demo Credentials Badge" />

You can log into the application using the following mock credentials in offline/demo mode:

| Role | Account Email | Initial View & Primary Capability |
| :--- | :--- | :--- |
| **Driver** | `driver@raasta.com` | Manually start trips, follow routes, report SOS, and send status updates. |
| **Parent** | `parent@raasta.com` | Follow their child's bus, set pickup stops, and view proximity alerts. |
| **School Admin** | `school@raasta.com` | Manage the live fleet dashboard, weekly AI insights, and complaint queues. |
| **RTO Inspector** | `rto@raasta.com` | Review vehicle compliance lists, speed limit violations, and driver rankings. |

> [!TIP]
> The default password for all demo credentials is `password123`.

---

## <img src="https://img.shields.io/badge/Architecture-&_Tech_Stack-1abc9c?style=flat-square" alt="Architecture & Tech Stack Badge" />

### Client (React Native / Expo)
- **Framework:** React Native (Expo SDK 54)
- **Language:** TypeScript
- **UI Components:** React Native Paper & Lucide React Icons
- **Maps:** React Native Maps (Google Maps / Apple Maps wrappers)
- **State Management:** React Context (Auth & Trip Lifecycles)
- **Animation:** React Native Reanimated

### Backend (Node.js Server)
- **Runtime:** Node.js (Express framework)
- **Real-time Transport:** Socket.IO WebSockets
- **Database:** MongoDB (using Mongoose ODM) with In-Memory fallback
- **AI Analysis:** Google Gemini API (with heuristic local fallback)

### Project Directory Structure
```
├── assets/         # Visual branding, icons, and mockups
├── src/            # Client Application Codebase
│   ├── api/        # Axios configuration and backend endpoints
│   ├── components/ # Reusable UI components (LiveMap, Badges, Cards)
│   ├── config/     # Environment configurations (Firebase, endpoints)
│   ├── constants/  # Route coordinates, stops, and safety thresholds
│   ├── context/    # Global Context states (AuthContext, TripContext)
│   ├── hooks/      # Custom React hooks (useBusTracking, usePickupProximity)
│   ├── navigation/ # App navigators and routing configuration
│   ├── screens/    # Driver, Parent, School, and RTO dashboards
│   ├── services/   # Location tracking, Socket.IO, and AI services
│   ├── theme/      # Style guides, color palettes, and typography
│   └── utils/      # Geo-math, formatting, and route deviation engines
└── server/         # Express & Socket.IO backend service
```

---

## <img src="https://img.shields.io/badge/Local-Development_Setup-e67e22?style=flat-square" alt="Local Development Setup Badge" />

Follow these steps to run the application locally on your machine.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm or yarn
- [Expo Go](https://expo.dev/client) app installed on your physical Android or iOS device to test mobile code

### 1. Environment Configuration

Duplicate the example environment file at the root:
```bash
cp .env.example .env
```

The keys are defined as follows:

| Environment Variable | Description | Default Fallback |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | The HTTP endpoint for REST backend calls | `http://localhost:4000` |
| `MONGODB_URI` | MongoDB Connection String for backend storage | In-Memory Database (No setup required) |
| `GEMINI_API_KEY` | Google Gemini developer API key | Heuristic rule-based fallback analysis |
| `EXPO_PUBLIC_FIREBASE_*` | Firebase project parameters for live user auth | SQLite-based local user mock db |

> [!IMPORTANT]
> If you leave these values blank, the client app and server automatically switch to local offline-simulation mode, allowing full testing of maps and notifications without any external setup.

### 2. Client Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Expo server:
   ```bash
   npm start
   ```
3. Scan the QR code displayed in your terminal using the **Expo Go** app (Android) or the native Camera app (iOS).

### 3. Backend Setup (Optional)
If you wish to test real-time Socket.IO synchronization or save data to MongoDB:
1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install server-side dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Verify the server is running by visiting `http://localhost:4000/health`.

> [!TIP]
> When testing on a physical mobile device, ensure your computer and phone are connected to the same Wi-Fi network, and use your computer's local LAN IP (e.g. `http://192.168.1.50:4000`) instead of `localhost` in `EXPO_PUBLIC_API_URL`.

---

## <img src="https://img.shields.io/badge/Contribution-Guidelines-d35400?style=flat-square" alt="Contribution Guidelines Badge" />

We welcome contributions from developers, designers, and transport safety advocates! To contribute:

1. **Fork the Repository** on GitHub.
2. **Create a Feature Branch** (`git checkout -b feature/amazing-feature`).
3. **Commit Your Changes** (`git commit -m 'Add some amazing feature'`).
4. **Push to the Branch** (`git push origin feature/amazing-feature`).
5. **Open a Pull Request** describing your changes.

### Contribution Guidelines
- **Code Style:** Ensure TypeScript types are fully defined. We use strict type checking. Run `npx tsc --noEmit` to verify type safety.
- **Testing:** Test changes in simulated demo mode to verify they don't break offline fallbacks.
- **Caching:** Run `npx expo start -c` if you suspect Metro bundling issues.
- **Pull Requests:** Provide clear descriptions and screenshots if you are updating UI components.

---

## <img src="https://img.shields.io/badge/Project-License-2980b9?style=flat-square" alt="Project License Badge" />

This project is licensed under the MIT License - see the [LICENSE](file:///C:/Users/plesi/OneDrive/Desktop/2026/EmlyOpenHack/LICENSE) file for details.
