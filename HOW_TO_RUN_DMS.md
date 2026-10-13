# Step-by-Step Guide: Running the Integrated Driver Monitoring System (DMS)
**Project**: RAASTA KASHMIR (Safe School Bus Kashmir)  
**Feature**: On-Device Driver Attention Monitoring & AI Safety Event Cockpit

---

## 1. Prerequisites

Before starting, ensure your system has:
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Web Browser**: Google Chrome, Microsoft Edge, or Brave (recommended for WebGL/WebAssembly and camera permissions)
- **Webcam**: A functional built-in or USB camera (for live facial landmark and phone inference)

---

## 2. Quickstart Commands

Open your terminal in the project directory (`RAASTA KASHMIR`):

### Step 1: Install Dependencies (if not already done)
```bash
npm install
```

### Step 2: Start the Development Server
Run the web development server:
```bash
npm run web
```
*(Alternatively, you can run `npx expo start --web`)*

Once Metro bundler finishes compiling, your browser will open automatically at:
```
http://localhost:8081
```

---

## 3. Step-by-Step Walkthrough

### Step 3: Log In as a School Bus Driver
On the initial login screen:
1. Enter demo driver credentials:
   - **Email**: `driver@raasta.com`
   - **Password**: `password123`
2. Select or verify the role is set to **Driver**.
3. Tap **Sign In**.

You will land on the **Driver Home Screen** (`DriverHomeScreen`).

---

### Step 4: Locate the DMS Telemetry Bar
At the top of the Driver Home Screen (just below your greeting header), you will see the **DMS Heads-Up Bar**:
- **PERCLOS Gauge**: Real-time rolling percentage of eye closure.
- **Hands Status**: Indicates whether hands are detected on the steering wheel.
- **Seatbelt Status**: Displays compliance state (`Belt: OK`).
- **`AI Cockpit` Button**: The glowing purple launch button for the on-device AI camera cockpit.
- **`Test` Button**: Opens the hardware simulator tray for testing without a webcam.

---

### Step 5: Launch the AI Vision Cockpit
1. Click the **`AI Cockpit`** button on the bar.
2. A high-tech **AI Driver Attention Cockpit Modal** will open.
3. In the top right of the modal, click the purple **`Start Monitoring`** button.
4. **Browser Camera Permission**:
   - When prompted by your browser (`localhost wants to use your camera`), click **Allow**.
5. The system will download and initialize the on-device MediaPipe models:
   - `FaceLandmarker` (Face mesh, blendshapes, 3D pose matrix)
   - `ObjectDetector` (EfficientDet mobile phone candidate detector)
   - `HandLandmarker` (Hand skeleton & phone grip association)

---

### Step 6: Test Real-Time AI Detection Scenarios

Once the camera is live, you can test each of the following safety rules:

#### A. Attentive Driving Baseline
- Look straight at the camera.
- The 3D gaze vector arrow on your nose will be **Green**, pointing forward.
- The status banner will display **`✅ DRIVER VIGILANT & ATTENTIVE`**.

#### B. Microsleep & Drowsiness Test
- Close your eyes continuously for **1.5 seconds**.
- The PERCLOS and Eye Closure gauge will spike into the red zone.
- An audible / visual **`CRITICAL: Microsleep Warning`** event will emit immediately onto the Safety Event Bus.

#### C. Off-Road Gaze Distraction Test
- Turn your head sharply to the left or right (exceeding $25^\circ$) for **3 seconds**.
- The 3D gaze arrow will turn **Crimson**.
- The system will emit a **`WARNING: Off-Road Gaze Distraction`** event.

#### D. Mobile Phone Usage & Grip Association Test
- Pick up a smartphone and hold it up to your ear (calling posture):
  - The detector will frame the phone in an amber bounding box, associate your hand joints, recognize the ear anchor, and confirm: **`📞 CALLING (AT EAR)`**.
- Hold the phone down in front of your chest and glance downward:
  - The system will identify downward gaze excursion and confirm: **`💬 TEXTING / SCREEN VIEW`**.
- A **`CRITICAL: Mobile Phone Distraction`** safety violation will be dispatched.

#### E. Yawn Detection
- Open your mouth widely for $>2.5\text{s}$ simulating a yawn.
- The Yawn Monitor gauge will register jaw opening $>50\%$ and increment the yawn counter.

#### F. Face Occlusion / Camera Obstructed
- Cover your face with both hands.
- The video quality gate will detect facial landmark occlusion and log **`Camera Feed Obstructed`**.

---

### Step 7: Inspect the Safety Event Bus
At the bottom of the Cockpit:
- Every safety event is listed in chronological order with severity tags (`CRITICAL`, `WARNING`, `INFO`).
- **Click any event card** to expand the raw telemetry JSON payload (including timestamps, pitch, yaw, roll, and confidence).
- Use **`Clear Bus`** to reset the visual list, or close the modal using the **`X`** in the top right.

---

## 4. Alternative: Testing Without a Webcam (Hardware Simulator)

If you are running in an environment without camera access:
1. On the Driver Home Screen's DMS telemetry bar, tap the **`Test`** button.
2. An on-device simulation tray will expand showing preset test pills:
   - **`Normal`**: Sets driver state to compliant.
   - **`Microsleep`**: Injects simulated continuous eye closure (triggers in-cab critical warning).
   - **`Off-Road Gaze`**: Injects pitch/yaw rotation exceeding corridor limits.
   - **`Phone Call`**: Injects phone near-ear candidate.
   - **`Unbuckled`**: Injects seatbelt unfastened event.
3. Observe how each scenario updates the heads-up banner and propagates into Raasta Kashmir's central fleet safety scores.

---

## 5. Verifying School & Admin Fleet Telemetry

All safety violations generated by the AI Vision Cockpit automatically route to Raasta Kashmir's administrative oversight system:
1. Log out from the Driver account.
2. Log in as a School Coordinator (`school@raasta.com` / `password123`).
3. Navigate to **Incident Review** (`SchoolIncidentReviewScreen`).
4. You will see the incoming driver safety events flagged in real-time, allowing school administrators to review the driver's safety score and timeline.

---

## 6. Technical Architecture Summary

```
                      +---------------------------------------+
                      |       Driver's In-Cabin Camera        |
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |   MediaPipe Vision Edge Inference     |
                      |   - FaceLandmarker (478 pts + 3D)     |
                      |   - EfficientDet (Phone)              |
                      |   - HandLandmarker (21 joints)        |
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |     driverStateEngine & Quality       |
                      |     - PERCLOS Rolling Window          |
                      |     - Head Pose Euler Decomp          |
                      |     - Phone Grip & Ear Association    |
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |      safetyEventEngine & Adapter      |
                      |   (src/services/dms/visionCueAdapter) |
                      +---------------------------------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
                     v                                         v
       +----------------------------+            +----------------------------+
       |   LiveDriverCockpit HUD    |            |   Central DMSEngine        |
       |   - Wireframe overlays     |            |   - TripContext events     |
       |   - Real-time gauges       |            |   - Safety Score reducer   |
       |   - Event Stream Bus       |            |   - School Incident Review |
       +----------------------------+            +----------------------------+
```

---

## 7. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| Camera shows "Offline" | Camera permission not granted in browser | Click the lock/camera icon in your browser address bar and set Camera to **Allow**, then refresh. |
| Model Download Error | Initial network timeout fetching Google CDN WASM models | Ensure your internet connection is active. MediaPipe caches WASM models locally after the first download. |
| Port 8081 already in use | Another Expo instance is active | Run `npx expo start --web --clear -p 8082` to start on port 8082. |

---

*Safe School Bus Kashmir — Autonomous Driver Vigilance & Student Protection System.*
