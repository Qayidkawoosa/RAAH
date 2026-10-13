# Raasta Kashmir — Feature & File Guide

What every feature does, how it works under the hood, and which files implement it.

---

## 1. Authentication (all roles)

**What it does:** Email/password login and signup with four roles (driver, parent, school, RTO). Session persists across app restarts.

**How it works:** If `EXPO_PUBLIC_FIREBASE_*` vars are set in `.env`, real Firebase Auth is used. If not, a mock auth layer stores users in AsyncStorage and ships four demo accounts (`driver@raasta.com` etc., password `password123`).

| File | Why it exists |
| --- | --- |
| `src/config/firebase.ts` | Initializes Firebase only when keys exist; exports `isMockFirebase` flag |
| `src/services/auth.ts` | Login/register/logout/reset — switches Firebase ↔ mock automatically |
| `src/context/AuthContext.tsx` | Global auth state (`user`, `loading`, `error`) for the whole app |
| `src/screens/LoginScreen.tsx`, `SignupScreen.tsx` | Auth UI |
| `src/types/auth.ts` | `UserRole`, `UserProfile` types |

## 1b. Scheduled Trips (9:30 pickup / 3:30 drop)

**What it does:** Each bus has a daily timetable. Inside a trip window the driver's app starts tracking automatically; outside it, the app shows a countdown to the next trip instead. The trip ends by itself when the bus reaches the school.

**How it works:** `src/constants/schedule.ts` defines the slots and a tracking window (opens 15 min before, closes 90 min after). The driver screen auto-starts tracking only inside a window; `TripContext.handlePoint` auto-completes the trip within 150 m of the school and records *"Arrived at school — trip completed automatically"*. Parents see the next scheduled time when no trip is running.

| File | Why it exists |
| --- | --- |
| `src/constants/schedule.ts` | Timetable, active-window test, next-slot lookup, time formatting |
| `src/screens/driver/DriverHomeScreen.tsx` | On-duty / waiting card, schedule-gated auto-start |
| `src/context/TripContext.tsx` | Auto-complete on arrival at school |

## 2. Live GPS Tracking & Trip Management (Driver)

**What it does:** Driver taps **Start Trip** → phone GPS streams position every 2 s / 5 m. The home screen shows a live map, current speed vs the 50 km/h limit, distance covered, and a live AI safety score. **End Trip** computes final stats and opens the AI summary.

**How it works:** `TripContext` owns the active trip. Each GPS point updates distance/max/avg speed and is fed to the safety engine. If GPS permission is denied (e.g. emulator), a drive simulator plays the route instead so the demo never dies. When a backend is configured, every point is published over Socket.IO so parents/school see it live.

| File | Why it exists |
| --- | --- |
| `src/context/TripContext.tsx` | Trip lifecycle: start/end/SOS, GPS ingestion, stat accumulation, realtime publishing |
| `src/services/locationService.ts` | expo-location wrapper (permission + watchPosition) |
| `src/services/demo/driveSimulator.ts` | Fake GPS along the demo route when real GPS is unavailable |
| `src/screens/driver/DriverHomeScreen.tsx` | Map, speed card, score ring, Start/End/SOS buttons, live alerts |
| `src/components/LiveMap.tsx` | Shared map: route polyline, stop circles, animated bus marker |

## 3. Safety Detection Engine (Overspeed / Long Stop / Route Deviation)

**What it does:** Detects, in real time on the driver's phone: speeding over 50 km/h, unscheduled stops longer than 90 s, and drifting more than 250 m off the approved route. Each detection creates an alert event with a 30 s cooldown so one incident doesn't spam.

**How it works:** `TripMonitor` is a pure class — GPS point in, events out. The same class powers the driver app, the demo simulator, and could run server-side. Events reduce the live safety score (overspeed −8, long stop −5, deviation −10, SOS −15).

| File | Why it exists |
| --- | --- |
| `src/utils/tripMonitor.ts` | The detection engine + `computeSafetyScore` |
| `src/constants/safety.ts` | All thresholds in one place (limit, stop time, deviation distance, cooldown) |
| `src/utils/geo.ts` | Haversine distance, bearing, distance-to-route, remaining-route math |

## 4. Emergency SOS (Driver → everyone)

**What it does:** Driver taps SOS → confirmation dialog → trip enters `sos` state; a red banner appears for the driver, and the event is broadcast so parent and school screens flag it instantly.

**Files:** `TripContext.triggerSos()` raises the event; `server/src/sockets.js` broadcasts SOS to *all* connected dashboards (not just watchers of that bus); parent/school screens render the red state from `useBusTracking`.

## 5. Parent Live Tracking, ETA & Alerts

**What it does:** Parent sees the assigned bus move on the map with ETA to the next stop, current speed, driver name, and a realtime feed of safety alerts.

**How it works:** `useBusTracking(busNo)` subscribes to the realtime service. With a backend it joins the Socket.IO room `bus:<busNo>`; without one it subscribes to the in-app simulator — the parent experience is identical.

| File | Why it exists |
| --- | --- |
| `src/hooks/useBusTracking.ts` | One hook = live bus state + alert feed for any watcher screen |
| `src/services/realtime.ts` | Transport switch: Socket.IO ↔ simulator behind one interface |
| `src/services/demo/busSimulator.ts` | Demo bus driving the Srinagar route with scripted overspeed + long stop |
| `src/screens/parent/ParentHomeScreen.tsx` | Map, ETA card, stat row, alert feed |
| `src/screens/parent/ParentAlertsScreen.tsx` | Full alert history feed |

## 6. AI Safety Copilot (Gemini)

**What it does:** Not a chatbot — it turns trip telemetry into: driver safety score + grade, trip summary, complaint categorization (category/severity/suggested action), and weekly fleet insights.

**How it works:** With a backend + `GEMINI_API_KEY`, the server prompts Gemini for strict-JSON responses. Without them, deterministic fallbacks generate equivalent output from the same telemetry — so AI screens always work. Both paths return identical TypeScript shapes.

| File | Why it exists |
| --- | --- |
| `src/services/aiService.ts` | App-side switch: backend AI ↔ on-device fallback |
| `src/types/ai.ts` | `SafetyReport`, `TripSummary`, `ComplaintAnalysis`, `WeeklyInsight` |
| `server/src/gemini.js` | Gemini REST call, JSON-only, never throws |
| `server/src/aiFallback.js` | Server-side deterministic fallback (mirrors the app's) |
| `src/components/AiInsightCard.tsx` | Purple-accented card used by every AI output |

## 7. Trip Summary & History

**What it does:** After End Trip: score ring, duration/distance/max-speed stats, AI summary and safety review. History tab lists past trips; tapping one shows the route, stats and every safety event.

**Files:** `src/screens/driver/TripSummaryScreen.tsx`, `src/screens/shared/TripHistoryScreen.tsx`, `src/screens/shared/TripDetailScreen.tsx`, `src/services/tripService.ts` (persists to backend/Mongo when live, AsyncStorage + demo history otherwise), `src/components/TripCard.tsx`.

## 8. School Dashboard

**What it does:** Fleet monitor (the demo bus is genuinely live in the list — speed/ETA update in place), SOS banner, fleet stats, AI weekly insights, complaints inbox with per-complaint **Analyze with AI**, and driver rankings.

**Files:** `src/screens/school/SchoolDashboardScreen.tsx`, `SchoolComplaintsScreen.tsx`, `SchoolRankingsScreen.tsx`, `src/components/RankingRow.tsx`, `src/types/fleet.ts`.

## 9. Complaints (Parent → School)

**What it does:** Parent writes a concern → it's stored and AI-triaged (category, severity, suggested action) → appears in the school's complaints inbox.

**Files:** `src/screens/parent/ReportComplaintScreen.tsx` (submit + instant AI triage), `tripService.submitComplaint/getComplaints`, `server/src/routes.js` (`/api/complaints`).

## 9b. Students & Pickup Assignment (School)

**What it does:** The school adds a student with their class (e.g. "Class 5-A"), assigns them to a bus, and picks the stop where they board. Students are listed grouped per bus with counts; removing a student is one tap.

**Files:** `src/screens/school/SchoolStudentsScreen.tsx`, `tripService.getStudents/addStudent/removeStudent`, server `GET/POST/DELETE /api/students` backed by the `students` collection.

## 10. RTO Dashboard

**What it does:** Compliance rate, trips today, SOS count; per-bus compliance cards (fitness/insurance/permit validity, last inspection, non-compliant buses flagged red); violation history with severity; driver rankings.

**Files:** `src/screens/rto/RtoDashboardScreen.tsx`, `RtoViolationsScreen.tsx`, seed data in `src/services/demo/demoData.ts` / `server/src/seed.js`.

**Live Fleet tab** (`RtoLiveFleetScreen.tsx`): the current schedule window, a live map, counts (registered / running / students), and every bus with its route, driver, student count, live speed and next stop — tap any bus to open it full-screen.

## 11. Backend (server/)

**What it does:** REST API (trips, fleet, rankings, complaints, compliance, violations, analytics, 5 AI endpoints) + Socket.IO realtime (per-bus rooms, SOS global broadcast). MongoDB when `MONGODB_URI` is set, in-memory otherwise. Reads the **same root `.env`** as the app. `GET /health` shows which modes are active.

**Files:** `server/index.js` (bootstrap), `src/store.js` (Mongo ↔ memory data layer), `src/routes.js`, `src/sockets.js`, `src/gemini.js`, `src/aiFallback.js`, `src/seed.js`.

## 12. Design system

Poppins typography, the green/violet palette, dark mode via `useColorScheme`, reusable UI in `src/components/ui/` (cards, stat tiles, gradient button, skeleton loaders, badges, empty states), Reanimated entrance animations, role-based bottom tabs in `src/navigation/RoleTabs.tsx`.
