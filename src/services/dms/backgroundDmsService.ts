// src/services/dms/backgroundDmsService.ts
/**
 * Headless Background DMS Service
 * 
 * Runs all on-device camera inference (face mesh, PERCLOS, gaze distraction,
 * phone detection, hands-on-wheel) continuously in the background WITHOUT
 * streaming or rendering raw video to the driver's screen.
 * 
 * Directly pipes detections to Raasta Kashmir's central DMS engine and the
 * Driver Dashboard Heads-Up Display in real time.
 */

import { Platform } from 'react-native';
import { dmsEngine, DMSStatus } from './dmsEngine';
import {
  loadVisionModels,
  detectFaceLandmarks,
  detectPhone,
  detectHands,
  detectPose,
  extractHeadPose,
  extractDriverBlendshapes,
  createDriverStateEngine,
  createPhoneDetectorEngine,
  createSafetyEventEngine,
  forwardVisionEventToDMSEngine,
  initNativeLandmarkBridge,
  VisionSafetyEvent,
  extractTorsoGeometry,
  evaluateHybridFusion,
  SeatbeltTemporalTracker,
  createSeatbeltDetectorEngine,
  SEATBELT_TEMPORAL_STATE,
} from './visionCueAdapter';
import {
  isUsbCameraAvailable,
  startNativeMonitoring,
  stopNativeMonitoring,
  switchNativeCameraSource,
  onUsbAttached,
  onUsbDetached,
} from './nativeUsbDmsBridge';

type DetectionListener = (status: DMSStatus) => void;

class BackgroundDmsService {
  private isRunning: boolean = false;
  private isConnecting: boolean = false;
  private cameraError: string | null = null;
  private currentSource: 'usb' | 'front' = 'usb';
  private isUsbPlugged: boolean = false;
  private listeners: Set<DetectionListener> = new Set();

  // Web Headless Resources
  private hiddenVideoElement: HTMLVideoElement | null = null;
  private webMediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private visionModels: any = null;
  private driverEngine: any = null;
  private phoneEngine: any = null;
  private safetyEngine: any = null;
  private lastProcessingTime: number = 0;
  private lastPhoneCheckTime: number = 0;
  private latestPhoneState: any = null;
  private latestHandsRes: any[] = [];
  private latestPhoneRes: any = { hasPhone: false, phones: [] };
  private hiddenCanvas: HTMLCanvasElement | null = null;
  private seatbeltCanvas: HTMLCanvasElement | null = null;
  private lastSeatbeltCheckTime: number = 0;
  private latestSeatbeltFastened: boolean = false;
  private seatbeltEngine: any = null;
  private handsZeroStreak: number = 0;
  private smoothedHandsCount: number = 0;
  private lastWebFrameTimestamp: number = 0;
  private lastNotificationTime: number = 0;

  // Native Mobile Cleanup
  private nativeCleanup: (() => void) | null = null;

  constructor() {
    if (Platform.OS !== 'web') {
      isUsbCameraAvailable().then((avail) => {
        this.isUsbPlugged = avail;
        this.currentSource = avail ? 'usb' : 'front';
      });

      onUsbAttached(() => {
        this.isUsbPlugged = true;
        this.notifyListeners();
      });

      onUsbDetached(() => {
        this.isUsbPlugged = false;
        if (this.currentSource === 'usb') {
          this.currentSource = 'front';
        }
        this.notifyListeners();
      });
    }
  }

  public isDmsActive(): boolean {
    return this.isRunning;
  }

  public isDmsConnecting(): boolean {
    return this.isConnecting;
  }

  public getCameraError(): string | null {
    return this.cameraError;
  }

  public getCameraSource(): 'usb' | 'front' {
    return this.currentSource;
  }

  public isUsbConnected(): boolean {
    return this.isUsbPlugged;
  }

  public subscribe(listener: DetectionListener): () => void {
    this.listeners.add(listener);
    listener(dmsEngine.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const status = dmsEngine.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (e) {
        console.warn('[BackgroundDmsService] Listener notification error:', e);
      }
    });
  }

  /**
   * Start headless background monitoring.
   * Runs vision algorithms without rendering any video to the driver interface.
   */
  public async start(source?: 'usb' | 'front'): Promise<boolean> {
    if (!dmsEngine.isTrackingActive) {
      console.log('[BackgroundDmsService] Standby: DMS tracking is only active during an active driver trip.');
      this.isRunning = false;
      this.isConnecting = false;
      this.notifyListeners();
      return false;
    }

    if (this.isRunning) return true;

    if (source) {
      this.currentSource = source;
    }

    this.isConnecting = true;
    this.cameraError = null;
    this.notifyListeners();

    try {
      if (Platform.OS === 'web') {
        await this.startWebHeadless();
      } else {
        await this.startNativeHeadless();
      }
      this.isRunning = true;
      this.isConnecting = false;
      this.notifyListeners();
      return true;
    } catch (err: any) {
      console.error('[BackgroundDmsService] Failed to start background DMS:', err);
      this.isRunning = false;
      this.isConnecting = false;
      this.cameraError = err?.message || 'Camera permission denied or camera unavailable';
      this.notifyListeners();
      return false;
    }
  }

  /**
   * Stop background detection and release hardware.
   */
  public async stop(): Promise<boolean> {
    if (!this.isRunning && !this.isConnecting) return true;

    try {
      if (Platform.OS === 'web') {
        this.stopWebHeadless();
      } else {
        await this.stopNativeHeadless();
      }
    } finally {
      this.isRunning = false;
      this.isConnecting = false;
      dmsEngine.reset();
      this.notifyListeners();
    }
    return true;
  }

  public async toggle(): Promise<boolean> {
    if (this.isRunning || this.isConnecting) {
      return this.stop();
    } else {
      return this.start();
    }
  }

  public async switchSource(source: 'usb' | 'front'): Promise<void> {
    this.currentSource = source;
    if (this.isRunning) {
      if (Platform.OS === 'web') {
        await this.stop();
        await this.start(source);
      } else {
        await switchNativeCameraSource(source);
      }
    }
    this.notifyListeners();
  }

  // ==================== WEB HEADLESS DETECTION ====================
  private async startWebHeadless(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Web camera API unavailable in this environment');
    }

    // 1. Acquire background camera stream first (prompts browser permission if needed)
    console.log('[BackgroundDmsService] Requesting background camera stream...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
      },
      audio: false,
    });
    this.webMediaStream = stream;

    // 2. Create headless video element (placed in viewport with 0.01 opacity so browser keeps decoding frames continuously)
    let hiddenVideo = this.hiddenVideoElement;
    if (!hiddenVideo) {
      hiddenVideo = document.createElement('video');
      hiddenVideo.playsInline = true;
      hiddenVideo.muted = true;
      hiddenVideo.autoplay = true;
      hiddenVideo.style.position = 'fixed';
      hiddenVideo.style.top = '0px';
      hiddenVideo.style.left = '0px';
      hiddenVideo.style.width = '160px';
      hiddenVideo.style.height = '120px';
      hiddenVideo.style.opacity = '0.01';
      hiddenVideo.style.pointerEvents = 'none';
      hiddenVideo.style.zIndex = '1';
      document.body.appendChild(hiddenVideo);
      this.hiddenVideoElement = hiddenVideo;
    }
    hiddenVideo.srcObject = stream;

    try {
      await hiddenVideo.play();
    } catch (playErr) {
      console.warn('[BackgroundDmsService] Auto-play warning:', playErr);
    }

    await new Promise<void>((resolve) => {
      if (hiddenVideo!.readyState >= 2) {
        resolve();
        return;
      }
      const onReady = () => {
        hiddenVideo!.removeEventListener('loadeddata', onReady);
        hiddenVideo!.removeEventListener('loadedmetadata', onReady);
        resolve();
      };
      hiddenVideo!.addEventListener('loadeddata', onReady);
      hiddenVideo!.addEventListener('loadedmetadata', onReady);
      setTimeout(resolve, 1500);
    });

    // 3. Initialize MediaPipe Models
    if (!this.visionModels) {
      console.log('[BackgroundDmsService] Downloading on-device MediaPipe vision models...');
      this.visionModels = await loadVisionModels();
    }

    this.driverEngine = createDriverStateEngine();
    this.phoneEngine = createPhoneDetectorEngine({
      callingConfirmationMs: 1000,
      dropoutToleranceMs: 750,
    });
    this.seatbeltEngine = createSeatbeltDetectorEngine({
      selectedSide: "AUTO",
      confidenceThreshold: 0.38,
      retentionThreshold: 0.22,
      confirmationWindowMs: 750,
      unfastenDelayMs: 1500,
    });
    this.safetyEngine = createSafetyEventEngine({
      cooldownMs: 6000,
      onEvent: (ev: VisionSafetyEvent) => {
        forwardVisionEventToDMSEngine(ev);
        this.notifyListeners();
      },
    });

    // 4. Connect live snapshot provider so detected anomalies carry camera evidence
    dmsEngine.setSnapshotProvider(() => this.captureSnapshot());

    // 5. Mark running and launch frame loop
    this.isRunning = true;
    this.lastWebFrameTimestamp = performance.now();
    this.runWebFrameLoop();
  }

  public captureSnapshot(): string | null {
    try {
      if (typeof document === 'undefined') return null;
      const video = this.hiddenVideoElement;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = 320;
      snapCanvas.height = 240;
      const ctx = snapCanvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, 320, 240);
      return snapCanvas.toDataURL('image/jpeg', 0.65);
    } catch (err) {
      console.warn('[BackgroundDmsService] Snapshot capture failed:', err);
      return null;
    }
  }

  private runWebFrameLoop = () => {
    if (!this.isRunning) return;

    // Always schedule next frame first to guarantee the loop survives any frame exception
    this.animFrameId = requestAnimationFrame(this.runWebFrameLoop);

    const now = Date.now();
    if (now - this.lastProcessingTime < 200) return;
    this.lastProcessingTime = now;

    const video = this.hiddenVideoElement;
    if (!video || video.readyState < 2 || !this.visionModels?.faceLandmarker) {
      return;
    }

    try {
      this.lastWebFrameTimestamp = now;

      // 1. High-frequency face landmarks & head orientation
      const detection = detectFaceLandmarks(this.visionModels.faceLandmarker, video, now);
      const rawHeadPose = extractHeadPose(
        detection?.facialTransformationMatrix,
        detection?.faceLandmarks,
        detection?.faceBlendshapes
      );
      const rawBlendshapes = extractDriverBlendshapes(detection?.faceBlendshapes);
      const hasFace = Boolean(detection?.faceLandmarks && detection.faceLandmarks.length > 0);

      // 2. Phone detection cadence (~8 FPS)
      const PHONE_INTERVAL_MS = 125;
      if (now - this.lastPhoneCheckTime >= PHONE_INTERVAL_MS) {
        this.lastPhoneCheckTime = now;
        const frameWidth = video.videoWidth || 640;
        const frameHeight = video.videoHeight || 480;

        let phoneRes = { hasPhone: false, phones: [] as any[] };
        if (this.visionModels.objectDetector) {
          phoneRes = detectPhone(this.visionModels.objectDetector, video, now);
          this.latestPhoneRes = phoneRes;
        }

        let handsRes: any[] = [];
        if (this.visionModels.handLandmarker) {
          handsRes = detectHands(this.visionModels.handLandmarker, video, frameWidth, frameHeight, now);
          this.latestHandsRes = handsRes;
        }

        if (this.phoneEngine) {
          this.latestPhoneState = this.phoneEngine.processFrame({
            rawPhones: phoneRes.phones,
            faceLandmarks: detection?.faceLandmarks || null,
            headPose: rawHeadPose,
            blendshapes: rawBlendshapes,
            hands: handsRes,
            frameWidth,
            frameHeight,
            timestamp: now,
          });
        }
      }

      // Seatbelt optical check (250ms cadence)
      const SEATBELT_INTERVAL_MS = 250;
      if (now - this.lastSeatbeltCheckTime >= SEATBELT_INTERVAL_MS) {
        this.lastSeatbeltCheckTime = now;
        const frameWidth = video.videoWidth || 640;
        const frameHeight = video.videoHeight || 480;

        if (!this.seatbeltEngine) {
          this.seatbeltEngine = createSeatbeltDetectorEngine({
            selectedSide: "AUTO",
            confidenceThreshold: 0.38,
            retentionThreshold: 0.22,
            confirmationWindowMs: 750,
            unfastenDelayMs: 1500,
          });
        }

        let poseLandmarks: any = null;
        if (this.visionModels?.poseLandmarker) {
          poseLandmarks = detectPose(this.visionModels.poseLandmarker, video, now);
        }
        const targetLandmarks = poseLandmarks || (hasFace ? detection?.faceLandmarks : null);

        if (targetLandmarks && frameWidth > 0 && frameHeight > 0) {
          try {
            if (!this.seatbeltCanvas && typeof document !== 'undefined') {
              this.seatbeltCanvas = document.createElement('canvas');
            }
            if (this.seatbeltCanvas) {
              if (this.seatbeltCanvas.width !== frameWidth || this.seatbeltCanvas.height !== frameHeight) {
                this.seatbeltCanvas.width = frameWidth;
                this.seatbeltCanvas.height = frameHeight;
              }
              const sctx = this.seatbeltCanvas.getContext('2d', { willReadFrequently: true });
              if (sctx) {
                // Render horizontally mirrored video frame onto offscreen buffer so pixel coordinates match driver perspective
                sctx.save();
                sctx.translate(frameWidth, 0);
                sctx.scale(-1, 1);
                sctx.drawImage(video, 0, 0, frameWidth, frameHeight);
                sctx.restore();

                const sImageData = sctx.getImageData(0, 0, frameWidth, frameHeight);
                const seatbeltRes = this.seatbeltEngine.processFrame({
                  imageData: sImageData,
                  poseLandmarks: targetLandmarks,
                  frameWidth,
                  frameHeight,
                  timestamp: now,
                });
                this.latestSeatbeltFastened = Boolean(seatbeltRes?.isFastened);
              }
            }
          } catch (sbErr) {
            console.warn('[BackgroundDmsService] Seatbelt evaluation error:', sbErr);
          }
        } else {
          const seatbeltRes = this.seatbeltEngine.processFrame({
            imageData: null,
            poseLandmarks: null,
            frameWidth,
            frameHeight,
            timestamp: now,
          });
          this.latestSeatbeltFastened = Boolean(seatbeltRes?.isFastened);
        }
      }

      // 3. Driver state (eyes, yawn, pose, distraction)
      let state: any = null;
      if (this.driverEngine) {
        state = this.driverEngine.processFrame({
          pctx: null,
          canvasWidth: 320,
          canvasHeight: 240,
          faceLandmarks: detection?.faceLandmarks || null,
          allFaceLandmarks: detection?.allFaceLandmarks || [],
          faceBlendshapes: detection?.faceBlendshapes || null,
          facialTransformationMatrix: detection?.facialTransformationMatrix || null,
          phoneState: this.latestPhoneState,
          timestamp: now,
        });
      }

      // 4. Update Central DMS Status with live vision detection
      const calculatedPerclos = typeof state?.eyes?.perclosScore === 'number'
        ? state.eyes.perclosScore / 100
        : (rawBlendshapes.eyeBlinkAvg || 0);

      const isEyesClosed = Boolean(state?.eyes?.isMicrosleep || rawBlendshapes.isEyesClosed);
      const isDistracted = Boolean(
        state?.pose?.isDistracted &&
        state?.pose?.direction !== 'FORWARD' &&
        rawHeadPose?.direction !== 'FORWARD'
      );

      // Real-time Phone in Hand & Interaction Evaluation
      const activePhones = this.latestPhoneRes?.phones || [];
      const hasDetectedPhone = activePhones.length > 0 || Boolean(this.latestPhoneState?.rawPhones?.length > 0);
      let phoneInHand = false;
      let phoneNearEar = false;
      let phoneDescription = 'Clear';
      let phoneModeStr: 'none' | 'calling' | 'texting' = 'none';

      if (hasDetectedPhone) {
        const pBox = activePhones[0]?.box || this.latestPhoneState?.rawPhones?.[0]?.box;
        const isHandNear = this.latestHandsRes.some((h: any) => {
          if (!pBox) return false;
          // Check bounding box intersection if available
          if (h.bbox) {
            const ix1 = Math.max(pBox.originX, h.bbox.originX);
            const iy1 = Math.max(pBox.originY, h.bbox.originY);
            const ix2 = Math.min(pBox.originX + pBox.width, h.bbox.originX + h.bbox.width);
            const iy2 = Math.min(pBox.originY + pBox.height, h.bbox.originY + h.bbox.height);
            if (ix2 > ix1 && iy2 > iy1) return true;
          }
          // Or wrist/center within close grip distance (<= 110px)
          const hwX = h.wristPx ? h.wristPx.x : (h.bbox?.originX || 0) + (h.bbox?.width || 0) / 2;
          const hwY = h.wristPx ? h.wristPx.y : (h.bbox?.originY || 0) + (h.bbox?.height || 0) / 2;
          const phoneCenterX = pBox.originX + pBox.width / 2;
          const phoneCenterY = pBox.originY + pBox.height / 2;
          const dist = Math.hypot(hwX - phoneCenterX, hwY - phoneCenterY);
          return dist <= 110;
        }) || Boolean(this.latestPhoneState?.isHandAssociated);

        // Phone is in hand ONLY if confirmed hand association exists
        phoneInHand = isHandNear;

        // STRICT HIERARCHY: ONLY check Calling/Texting if phone is actively held in hand
        if (phoneInHand) {
          if (detection?.faceLandmarks && pBox) {
            const vw = video.videoWidth || 640;
            const vh = video.videoHeight || 480;
            // Left image side (canonical right): tragus 234, preauricular 127, lobule 132, helix 21/54/162, jaw 93/58/172/136
            const leftCluster = [234, 127, 162, 21, 54, 93, 132, 58, 172, 136];
            // Right image side (canonical left): tragus 454, preauricular 356, lobule 361, helix 251/284/389, jaw 323/288/397/365
            const rightCluster = [454, 356, 389, 251, 284, 323, 361, 288, 397, 365];

            const getBoxDist = (idx: number) => {
              const lm = detection.faceLandmarks[idx];
              if (!lm) return Infinity;
              const px = lm.x * vw;
              const py = lm.y * vh;
              const cx = Math.max(pBox.originX, Math.min(px, pBox.originX + pBox.width));
              const cy = Math.max(pBox.originY, Math.min(py, pBox.originY + pBox.height));
              return Math.hypot(px - cx, py - cy);
            };

            const minLeftDist = Math.min(...leftCluster.map(getBoxDist));
            const minRightDist = Math.min(...rightCluster.map(getBoxDist));
            const minEarDist = Math.min(minLeftDist, minRightDist);

            if (minEarDist <= 110 || this.latestPhoneState?.mode === 'CALLING') {
              phoneNearEar = true;
            }
          }

          if (phoneNearEar || this.latestPhoneState?.mode === 'CALLING') {
            phoneModeStr = 'calling';
            phoneDescription = 'Calling (Near Ear)';
          } else if (rawHeadPose.pitch < -14 || rawBlendshapes.isGazeDown || this.latestPhoneState?.mode === 'TEXTING') {
            phoneModeStr = 'texting';
            phoneDescription = 'Texting / Lap';
          } else {
            phoneDescription = 'Phone In Hand';
          }
        } else {
          // Phone is detected but NOT in hand (e.g. car dashboard mount/cradle)
          phoneModeStr = 'none';
          phoneDescription = 'Phone in Mount / Clear';
        }
      }

      // Real-time Hands on Wheel Evaluation
      let handsOnWheel = false;
      let handsCount = 0;

      if (!hasFace) {
        handsOnWheel = false;
        handsCount = 0;
        this.smoothedHandsCount = 0;
        this.handsZeroStreak = 0;
      } else if (this.visionModels?.handLandmarker) {
        const vHeight = video.videoHeight || 480;
        const vWidth = video.videoWidth || 640;

        // Establish the driver's face & steering zone geometry
        const chin = detection?.faceLandmarks?.[152];
        const nose = detection?.faceLandmarks?.[1];
        const forehead = detection?.faceLandmarks?.[10];

        const chinY = chin ? chin.y * vHeight : vHeight * 0.45;
        const faceH = (chin && forehead)
          ? Math.hypot((chin.x - forehead.x) * vWidth, (chin.y - forehead.y) * vHeight)
          : vHeight * 0.28;
        const faceRadius = faceH * 0.65;

        // Steering wheel is in the lower cabin/torso zone, below the chin/chest
        const steeringZoneMinY = Math.max(vHeight * 0.44, chinY + faceH * 0.18);
        const pBox = activePhones[0]?.box || this.latestPhoneState?.rawPhones?.[0]?.box;

        const handsOnWheelList = this.latestHandsRes.filter((h: any) => {
          const hwX = h.wristPx ? h.wristPx.x : (h.bbox?.originX || 0) + (h.bbox?.width || 0) / 2;
          const hwY = h.wristPx ? h.wristPx.y : (h.bbox?.originY || 0) + (h.bbox?.height || 0) / 2;

          // 1. Hand touching face or scratching head is NOT on wheel
          if (nose) {
            const distToNose = Math.hypot(hwX - nose.x * vWidth, hwY - nose.y * vHeight);
            if (distToNose < faceRadius) return false;
          }
          if (hwY < chinY) return false; // Hand is above chin level

          // 2. Hand holding or operating phone is NOT on wheel
          if (phoneNearEar) return false;
          if (pBox) {
            const pdx = Math.abs(hwX - (pBox.originX + pBox.width / 2));
            const pdy = Math.abs(hwY - (pBox.originY + pBox.height / 2));
            if (pdx < 140 && pdy < 140) return false;
          }

          // 3. Must be situated in the lower steering wheel zone
          return hwY >= steeringZoneMinY;
        });

        const rawDetectedHands = handsOnWheelList.length;

        // Smooth brief 1-frame camera dropouts without creating false positives
        if (rawDetectedHands > 0) {
          this.handsZeroStreak = 0;
          this.smoothedHandsCount = Math.min(2, rawDetectedHands);
        } else {
          this.handsZeroStreak++;
          // Require 2 consecutive frames (~250ms) of absence to confirm hands-off
          if (this.handsZeroStreak >= 2) {
            this.smoothedHandsCount = 0;
          }
        }

        handsCount = this.smoothedHandsCount;
        handsOnWheel = handsCount > 0;
      }

      dmsEngine.updateVisionMetrics({
        isDriverPresent: hasFace,
        handsCount,
        phoneInHand,
        phoneDescription,
        perclos: calculatedPerclos,
        isMicrosleeping: isEyesClosed,
        isDistracted,
        distractionReason: isDistracted
          ? rawHeadPose.pitch > 22
            ? 'looking_up'
            : rawHeadPose.pitch < -20
            ? 'looking_down'
            : rawHeadPose.yaw > 25
            ? 'looking_left'
            : rawHeadPose.yaw < -25
            ? 'looking_right'
            : state?.pose?.direction && state.pose.direction.startsWith('GAZE_')
            ? (state.pose.direction.toLowerCase() as any)
            : 'head_turned'
          : 'normal',
        isYawning: Boolean(state?.mouth?.isYawningNow || rawBlendshapes.isYawningCandidate),
        isUsingPhone: Boolean(hasDetectedPhone && phoneInHand && (phoneNearEar || phoneModeStr !== 'none' || this.latestPhoneState?.isConfirmed)),
        phoneMode: phoneInHand ? phoneModeStr : 'none',
        handsOnWheel,
        seatbeltFastened: this.latestSeatbeltFastened,
        headPose: {
          yaw: hasFace ? rawHeadPose.yaw : 0,
          pitch: hasFace ? rawHeadPose.pitch : 0,
          roll: hasFace ? rawHeadPose.roll : 0,
          direction: !hasFace ? 'NO_FACE' : rawHeadPose.direction,
          isLookingAway: isDistracted,
        },
        attentionSummary: !hasFace
          ? 'DRIVER ABSENT / NO FACE DETECTED'
          : !dmsEngine.isSeatbeltFastened()
          ? 'SEATBELT UNBUCKLED'
          : phoneInHand
          ? 'PHONE DETECTED IN HAND'
          : !handsOnWheel
          ? 'HANDS OFF STEERING WHEEL'
          : isDistracted
          ? 'OFF-ROAD GAZE DETECTED'
          : isEyesClosed
          ? 'MICROSLEEP WARNING'
          : 'ATTENTIVE & VIGILANT',
      });

      // 5. Evaluate safety rules & alert triggers
      if (state && this.safetyEngine) {
        this.safetyEngine.evaluate(state, {
          tripId: dmsEngine.tripId,
          vehicleId: dmsEngine.busId,
          driverId: dmsEngine.driverId,
        });
      }

      // Throttle real-time listener notification (~12-15 FPS) for smooth React rendering
      const nowMs = performance.now();
      if (nowMs - this.lastNotificationTime >= 70) {
        this.lastNotificationTime = nowMs;
        this.notifyListeners();
      }
    } catch (frameErr) {
      console.warn('[BackgroundDmsService] Frame iteration warning:', frameErr);
    }
  };

  private stopWebHeadless(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.webMediaStream) {
      try {
        this.webMediaStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      this.webMediaStream = null;
    }
    if (this.hiddenVideoElement) {
      try {
        if (this.hiddenVideoElement.srcObject) {
          const stream = this.hiddenVideoElement.srcObject as MediaStream;
          stream.getTracks?.().forEach((track) => track.stop());
          this.hiddenVideoElement.srcObject = null;
        }
        this.hiddenVideoElement.pause?.();
        this.hiddenVideoElement.remove();
      } catch (e) {}
      this.hiddenVideoElement = null;
    }

    // Fail-safe cleanup: stop any open video media tracks in the document
    if (typeof document !== 'undefined') {
      try {
        const allVideos = document.querySelectorAll('video');
        allVideos.forEach((vid) => {
          if (vid.srcObject && 'getTracks' in (vid.srcObject as any)) {
            try {
              (vid.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
            } catch (err) {}
            vid.srcObject = null;
          }
        });
      } catch (e) {}
    }

    this.driverEngine?.reset?.();
    this.phoneEngine?.reset?.();
    this.seatbeltEngine?.reset?.();
    this.latestPhoneState = null;
    this.latestSeatbeltFastened = false;
  }

  // ==================== NATIVE HEADLESS DETECTION ====================
  private async startNativeHeadless(): Promise<void> {
    const targetSource = this.currentSource === 'usb' && this.isUsbPlugged ? 'usb' : 'front';

    const started = await startNativeMonitoring(targetSource);
    if (!started && targetSource === 'usb') {
      await startNativeMonitoring('front');
      this.currentSource = 'front';
    }

    if (this.nativeCleanup) {
      this.nativeCleanup();
    }

    this.nativeCleanup = initNativeLandmarkBridge({
      tripId: dmsEngine.tripId,
      vehicleId: dmsEngine.busId,
      driverId: dmsEngine.driverId,
      onStateUpdate: () => {
        this.notifyListeners();
      },
      onEvent: () => {
        this.notifyListeners();
      },
    });
  }

  private async stopNativeHeadless(): Promise<void> {
    if (this.nativeCleanup) {
      this.nativeCleanup();
      this.nativeCleanup = null;
    }
    await stopNativeMonitoring();
  }
}

// Singleton Background Service
export const backgroundDmsService = new BackgroundDmsService();
