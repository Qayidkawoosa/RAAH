# Step-by-Step Guide: Running & Testing DMS in Raasta Kashmir

This document explains how to run the Raasta Kashmir mobile app, test the integrated **Driver Monitoring System (DMS)**, and verify the end-to-end fleet incident pipeline.

---

## 1. Quick Start / Running the App

### Step 1: Open Terminal in the Project Root
Make sure you are in the project folder:
```bash
cd "/Users/apple/Desktop/RAASTA KASHMIR"
```

### Step 2: Start the Expo Development Server
Run the standard start command:
```bash
npm run start
```
*(Or use `npx expo start`)*

### Step 3: Choose Your Running Environment
From the interactive Expo terminal menu:
* **To run in your desktop web browser (easiest & fastest for testing):**
  Press `w` in your terminal. This opens `http://localhost:8081` in your browser.
* **To run on a physical Android phone:**
  1. Install **Expo Go** from Google Play Store on the phone.
  2. Ensure the phone and your computer are on the same Wi-Fi network.
  3. Scan the QR code displayed in your terminal using the Expo Go app.
* **To run on an Android Emulator:**
  Press `a` in your terminal (with Android Studio emulator running).

---

## 2. Navigating to the Driver Monitoring System (DMS)

1. When the app loads, you will see the **Login Screen**.
2. Tap **"Demo Driver"** (or log in with `driver@raasta.com`).
3. You will arrive at the **Driver Home Screen**.
4. Right below the header (`Salaam, Driver`), you will see the new **DMS Telemetry Bar**:
   * **PERCLOS:** Real-time eye closure rate (e.g. `PERCLOS: 0%`)
   * **Hands:** Steering compliance (`Hands: On`)
   * **Belt:** 3-point seatbelt status (`Belt: OK`)
   * **`Test` Button:** Expands the on-device hardware simulation panel.

---

## 3. How to Test the DMS Rules (Without Needing Physical USB Cables)

To test on your mobile device immediately without connecting physical USB OTG cables, use the built-in **Hardware Test Simulator**:

1. Tap the **`Test`** toggle on the right side of the DMS telemetry bar.
2. The interactive test tray will expand with 5 scenario buttons:

| Button | Scenario Tested | Expected Reaction |
| :--- | :--- | :--- |
| **`Normal`** | Driver attentive, eyes open, belt on | Clears all warnings. Telemetry returns to normal green state. |
| **`Microsleep`** | Driver eyes closed continuously for >1.5s | Flashes a **CRITICAL RED BANNER**: *"CRITICAL: Driver Microsleep! Driver eyes continuously closed for 1.6s!"* |
| **`Off-Road Gaze`** | Driver head turned >25° for >3.5s | Flashes a **WARNING AMBER BANNER**: *"Off-Road Gaze Distraction: Driver looking left/right for 3.6s."* |
| **`Phone Call`** | Mobile phone detected near driver ear | Flashes a **CRITICAL RED BANNER**: *"Mobile Phone In Use: Driver detected making a call while vehicle is in motion."* |
| **`Unbuckled`** | Driver seatbelt unfastened for >4.0s | Flashes an **AMBER WARNING**: *"Seatbelt Unbuckled: Driver seatbelt is not fastened."* |

3. Tap **"Dismiss Alert"** on the banner to clear it manually, or wait 5 seconds for it to auto-clear.

---

## 4. How to Verify School Incident Queue Integration

Whenever the DMS detects an incident on the driver's phone, it automatically dispatches a typed `SafetyEvent` into the school safety review queue.

To verify this:
1. Log out or switch to the **School Admin** profile (`school@raasta.com`).
2. Navigate to the **Incident Review Queue** (`SchoolIncidentReviewScreen`).
3. Any incident triggered during the driver session (e.g. `drowsiness`, `phone_use`, `seatbelt_off`) will appear in the queue with:
   * Event type badge (`critical` / `warning`)
   * Bus number (`JK01-1234`)
   * AI confidence score (e.g. `96%`)
   * Exact detection timestamp
4. School administrators can review and tap **"Confirm"** or **"Dismiss"** to resolve the incident.

---

## 5. Connecting Real Native Camera Streams (Architecture Contract)

When you are ready to connect physical USB webcams via an Android native module or edge device, feed landmark coordinates into the engine using the decoupled methods in `useDMSMonitoring`:

```typescript
import { useDMSMonitoring } from '../hooks/useDMSMonitoring';

const { ingestDriverFaceFrame, ingestCabinFrame } = useDMSMonitoring();

// 1. When native Driver IR camera delivers face landmarks (Target: 8-10 FPS)
ingestDriverFaceFrame({
  leftEyeLandmarks: [{ x, y }, ...],   // 6 standardized eye points
  rightEyeLandmarks: [{ x, y }, ...],  // 6 standardized eye points
  mouthLandmarks: { topLip, bottomLip, leftCorner, rightCorner },
  headPoseLandmarks: { noseTip, chin, leftEye, rightEye },
  timestampMs: Date.now(),
});

// 2. When native Cabin camera delivers object bounding boxes (Target: 2-3 FPS)
ingestCabinFrame({
  phone: { isDetected: true, nearEar: true, nearLap: false, confidence: 0.92 },
  hands: { leftHandOnWheel: true, rightHandOnWheel: true },
  seatbelt: { isFastened: true, confidence: 0.95 },
  timestampMs: Date.now(),
});
```

The built-in **`DMSScheduler`** automatically enforces rate limits (8 FPS for driver, 2 FPS for cabin) and drops overflow frames, protecting your low-end mobile phone from overheating and memory crashes.
