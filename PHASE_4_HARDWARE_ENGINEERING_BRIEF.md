# Engineering Brief: Phase 4 Hardware Architecture & Roadmap
**Project:** Safe School Bus Kashmir (Raasta Kashmir)  
**Target Audience:** Core Development Team & Hardware Integration Interns  
**Subject:** Phase 4 Vehicle Hardware Setup, OTG Camera Pipeline & Road Calibration  

---

## 1. What is Phase 4? (The End Goal)
In Phase 4, we transition Raasta Kashmir from laptop screens and phone simulations to a **real physical school bus operating on Kashmir roads**.

Our goal is to run our Driver Monitoring System (DMS) using an **external USB/OTG camera mounted on the bus dashboard**, plugged directly into the driver's Android phone, without causing phone overheating, battery depletion, or false alarms over bumpy roads.

---

## 2. Bus Hardware Setup & Wiring Diagram

```
                                  [ BUS WINDSHIELD / A-PILLAR ]
                                                │
                        ┌───────────────────────┴───────────────────────┐
                        ▼                                               ▼
          [ Wide-Angle IR USB Camera ]                      [ Vibration-Dampened Mount ]
       (Watches driver face, hands & torso)               (Holds Driver Android Smartphone)
                        │                                               │
                        │ USB Video Stream                              │
                        └───────────────────────┬───────────────────────┘
                                                ▼
                               [ USB-C OTG Splitter (Power Delivery) ]
                                         │             │
                      640x480 @ 15 FPS   │             │ 12V/24V USB Fast Charge
                      UVC Video Stream   ▼             ▼
                             [ Driver Phone ]      [ Bus Battery / Fuse Box ]
```

### The 3 Core Hardware Components:
1. **The External USB Camera:**
   * **Angle of View:** $110^\circ - 130^\circ$ wide-angle lens (covers driver face, steering wheel, and seatbelt torso).
   * **Night Vision:** Built-in **850nm Infrared (IR) LEDs** with automatic IR-cut filter (essential for early morning winter pickups and unlit mountain tunnels).
2. **The Power Passthrough OTG Splitter:**
   * *Problem:* Running GPS + Computer Vision drains a phone battery in under 2 hours.
   * *Solution:* We use a **USB-C OTG Power Delivery (PD) Y-Cable**. It allows video data to flow into the phone while charging the phone continuously from the bus's 12V power socket.
3. **Vibration-Dampened Dashboard Mount:**
   * Firmly secures the phone near the steering console without obstructing the windshield view.

---

## 3. The Software & Camera Pipeline (How it Runs on Android)

Instead of using web browser tools (`getUserMedia`), we use **native Android drivers**:

```
[ External USB Camera ]
         │
         ▼
[ Android Native UVC Driver ] (UsbCameraDmsModule.kt)
  • Claims USB endpoint via Android UsbManager
  • Ingests raw video frames at a strict 15 FPS @ 640x480 resolution
         │
         ▼
[ Native MediaPipe Tasks SDK ] (com.google.mediapipe:tasks-vision)
  • Executes on the phone's native NPU/GPU hardware
  • Generates 3D landmarks (face mesh, hands, head pose, phone detection)
  • Zero phone overheating (cuts CPU load by ~70% compared to web)
         │
         ▼
[ Raasta DMS Core ] (src/services/dms/core/)
  • PERCLOS & Eye closure tracker (Microsleep alert if closed > 1.5s)
  • Phone detector engine (Calling at ear vs. texting in lap)
  • Seatbelt hybrid fusion & Hands-on-wheel zone compliance
         │
         ▼
[ In-Cab Audio Chimes & Server Telemetry ]
  • Immediate audible chime inside the cabin to alert the driver
  • GPS coordinate & violation log sent to School Admin Dashboard
```

---

## 4. Road Calibration for Kashmir Conditions

Kashmir roads introduce unique environmental challenges that the development team must tune:

1. **Potholes & Road Bump Filtering:**
   * *The Problem:* Deep potholes can cause the driver's head to bob up and down rapidly, which might falsely trigger a nodding/microsleep alert.
   * *The Fix:* In `headPoseTracker.ts`, a vertical shock is **rejected** unless the Eye Aspect Ratio (EAR) confirms that the driver's eyes were also closed at the exact same moment.
2. **Tunnel & Snow Glare Adaptation:**
   * *The Problem:* Sudden changes from bright snow sunlight to dark mountain tunnels can confuse camera exposure.
   * *The Fix:* In `qualityEvaluator.js`, we allow a 1.5-second auto-exposure adjustment window before flagging a "Camera Obstructed" event.
3. **Network Dead Zones (Offline Fallback):**
   * If the bus enters a cellular dead zone in a valley, all GPS points and safety events are cached in local phone storage (SQLite) and flushed to the central server automatically as soon as 4G reconnects.

---

## 5. Steering Wheel & Hands-On Calibration System

### Why Hands-On-Wheel Cannot Be Calibrated Yet:
1. **Geometric Dependency:** Facial DMS (eye blink, yawning, phone at ear) is invariant to vehicle cabin geometry because the camera points directly at the driver's face. In contrast, **steering wheel position in the camera frame depends strictly on physical mounting angles and lens Field of View (FOV)**.
2. **Webcam vs. In-Cabin Camera Frustum:** In Phase 1–3 testing (laptops, desk webcams, phone front cameras), the steering wheel does not exist in the frame. Hardcoding any screen coordinates or bounding zones right now would be completely fictitious.
3. **Vehicle Cabin Variability:** Different school buses (e.g., Force Traveller, Tata Winger, SML Isuzu, Ashok Leyland) have drastically different steering column angles, wheel diameters, and dashboard depths.

### The Phase 4 In-Cabin Calibration Flow:
Once the physical wide-angle IR camera is permanently mounted in the target school bus during Phase 4, the team will implement an **In-App Steering Calibration Wizard**:
1. **Step 1 - Field of View (FOV) Verification:** The installer views the live camera feed on the phone screen to confirm that both the driver's face and the full steering wheel rim are within the viewing frame.
2. **Step 2 - Interactive 10-and-2 Baseline Capture:**
   * The calibration wizard prompts the driver: *"Hold the steering wheel firmly with both hands at the 10-and-2 position."*
   * The native MediaPipe Hand Landmark tracker registers the 21 3D hand/knuckle landmarks and computes the centroid bounding ellipses for the left hand $[x_{L1}, y_{L1}, x_{L2}, y_{L2}]$ and right hand $[x_{R1}, y_{R1}, x_{R2}, y_{R2}]$.
3. **Step 3 - Steering Arc Polygon Definition:**
   * The installer can optionally drag an interactive bounding quadrilateral over the wheel rim on the touchscreen to lock the "Permissible Steering Zone".
4. **Step 4 - Persistent Vehicle Profile:**
   * These calibrated bounding coordinates are saved locally to `AsyncStorage` / SQLite and synced to the central backend database under the specific `bus_id` hardware profile.
   * Hands leaving this dynamic zone for $> 3.0$ seconds while vehicle speed $> 15\text{ km/h}$ triggers the "Hands Off Wheel" audio chime and server alert.

---

## 6. Team Execution Checklist for Phase 4

- [ ] **Hardware Sourcing:** Select and test 1 wide-angle IR USB webcam and 1 USB-C PD OTG charging cable.
- [ ] **Android USB Permissions:** Verify `UsbCameraDmsModule.kt` prompts for device permission when the cable is plugged in.
- [ ] **Thermal Stability Check:** Run the camera and DMS continuously for 1 hour while plugged in; verify the phone remains cool and FPS stays steady at 15 FPS.
- [ ] **Vehicle Pilot:** Mount the setup in an operational school bus in Srinagar for a 1-week test route, gathering driver feedback and tuning sensitivity.
