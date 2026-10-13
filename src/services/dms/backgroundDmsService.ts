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
  extractHeadPose,
  extractDriverBlendshapes,
  createDriverStateEngine,
  createPhoneDetectorEngine,
  createSafetyEventEngine,
  forwardVisionEventToDMSEngine,
  initNativeLandmarkBridge,
  VisionSafetyEvent,
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
  private lastPhoneCheckTime: number = 0;
  private latestPhoneState: any = null;
  private latestHandsRes: any[] = [];
  private latestPhoneRes: any = { hasPhone: false, phones: [] };
  private hiddenCanvas: HTMLCanvasElement | null = null;
  private lastSeatbeltCheckTime: number = 0;
  private latestSeatbeltFastened: boolean = false;
  private consecutiveSeatbeltDetections: number = 0;
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
    this.phoneEngine = createPhoneDetectorEngine();
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

    const video = this.hiddenVideoElement;
    if (!video || video.readyState < 2 || !this.visionModels?.faceLandmarker) {
      return;
    }

    try {
      const rawNow = performance.now();
      const now = Math.max(this.lastWebFrameTimestamp + 1, Math.round(rawNow));
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

      // Seatbelt optical diagonal strap check (~2 FPS)
      const SEATBELT_INTERVAL_MS = 500;
      if (now - this.lastSeatbeltCheckTime >= SEATBELT_INTERVAL_MS) {
        this.lastSeatbeltCheckTime = now;
        if (!hasFace) {
          this.consecutiveSeatbeltDetections = 0;
          this.latestSeatbeltFastened = false;
        } else {
          try {
            if (!this.hiddenCanvas && typeof document !== 'undefined') {
              this.hiddenCanvas = document.createElement('canvas');
              this.hiddenCanvas.width = 160;
              this.hiddenCanvas.height = 120;
            }
            if (this.hiddenCanvas && video.videoWidth > 0) {
              const ctx = this.hiddenCanvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, 160, 120);
                const chin = detection?.faceLandmarks?.[152];
                if (chin && chin.y < 0.70) {
                  // Probe 4 horizontal slices across the torso below the chin
                  const sliceY1 = Math.min(98, Math.floor((chin.y + 0.12) * 120));
                  const sliceY2 = Math.min(104, Math.floor((chin.y + 0.19) * 120));
                  const sliceY3 = Math.min(110, Math.floor((chin.y + 0.26) * 120));
                  const sliceY4 = Math.min(116, Math.floor((chin.y + 0.33) * 120));

                  const findStrapCenterInSlice = (sliceY: number) => {
                    const rowData = ctx.getImageData(15, sliceY, 130, 1).data;
                    const lums: number[] = [];
                    let totalLum = 0;
                    for (let x = 0; x < 130; x++) {
                      const idx = x * 4;
                      const lum = 0.299 * rowData[idx] + 0.587 * rowData[idx + 1] + 0.114 * rowData[idx + 2];
                      lums.push(lum);
                      totalLum += lum;
                    }
                    const avgLum = totalLum / 130;
                    // If the torso slice is uniformly dark, contrast valley cannot confirm a strap without severe false positives
                    if (avgLum < 50) return -1;

                    let bestValleyCenter = -1;
                    let bestContrast = 0;
                    for (let x = 16; x < 114; x++) {
                      const strapCoreLum = (lums[x - 2] + lums[x] + lums[x + 2]) / 3;
                      // Seatbelt webbing must be intrinsically dark
                      if (strapCoreLum > 48) continue;

                      const leftFlank = (lums[x - 14] + lums[x - 11]) / 2;
                      const rightFlank = (lums[x + 11] + lums[x + 14]) / 2;
                      const leftContrast = leftFlank - strapCoreLum;
                      const rightContrast = rightFlank - strapCoreLum;
                      const valleyDepth = Math.min(leftContrast, rightContrast);

                      // Real seatbelt strap requires high dual-sided contrast against shirt/skin
                      if (valleyDepth > 60 && valleyDepth > bestContrast) {
                        bestContrast = valleyDepth;
                        bestValleyCenter = x + 15;
                      }
                    }
                    return bestValleyCenter;
                  };

                  const c1 = findStrapCenterInSlice(sliceY1);
                  const c2 = findStrapCenterInSlice(sliceY2);
                  const c3 = findStrapCenterInSlice(sliceY3);
                  const c4 = findStrapCenterInSlice(sliceY4);

                  // A real seatbelt strap is a continuous, collinear diagonal band
                  let isDiagonalStrap = false;
                  if (c1 > 0 && c2 > 0 && c3 > 0 && c4 > 0) {
                    const d12 = c2 - c1;
                    const d23 = c3 - c2;
                    const d34 = c4 - c3;
                    const sameSign = Math.sign(d12) === Math.sign(d23) && Math.sign(d23) === Math.sign(d34);
                    const realisticSlope = Math.abs(d12) >= 5 && Math.abs(d12) <= 16;
                    // Collinearity: a straight line has near-identical shifts between equidistant slices
                    const isCollinear = Math.abs(d12 - d23) <= 1 && Math.abs(d23 - d34) <= 1;

                    if (sameSign && realisticSlope && isCollinear) {
                      isDiagonalStrap = true;
                    }
                  }

                  if (isDiagonalStrap) {
                    this.consecutiveSeatbeltDetections++;
                  } else {
                    this.consecutiveSeatbeltDetections = 0;
                  }

                  // Require 6 consecutive positive frames (3 full seconds) to confirm fastened
                  this.latestSeatbeltFastened = this.consecutiveSeatbeltDetections >= 6;
                } else {
                  this.consecutiveSeatbeltDetections = 0;
                  this.latestSeatbeltFastened = false;
                }
              }
            }
          } catch {
            this.consecutiveSeatbeltDetections = 0;
            this.latestSeatbeltFastened = false;
          }
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
      const isDistracted = Boolean(state?.pose?.isDistracted || rawHeadPose.isLookingAway || rawBlendshapes.isGazeAway);

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
          const hwX = h.wristPx ? h.wristPx.x : (h.bbox?.originX || 0) + (h.bbox?.width || 0) / 2;
          const hwY = h.wristPx ? h.wristPx.y : (h.bbox?.originY || 0) + (h.bbox?.height || 0) / 2;
          if (!pBox) return true;
          const dx = Math.abs(hwX - (pBox.originX + pBox.width / 2));
          const dy = Math.abs(hwY - (pBox.originY + pBox.height / 2));
          return dx < 220 && dy < 220;
        }) || Boolean(this.latestPhoneState?.isHandAssociated);

        phoneInHand = isHandNear || Boolean(pBox && pBox.originY > 80);

        if (detection?.faceLandmarks && pBox) {
          const leftEar = detection.faceLandmarks[234];
          const rightEar = detection.faceLandmarks[454];
          const pNormX = (pBox.originX + pBox.width / 2) / (video.videoWidth || 640);
          const pNormY = (pBox.originY + pBox.height / 2) / (video.videoHeight || 480);
          const distL = leftEar ? Math.hypot(pNormX - leftEar.x, pNormY - leftEar.y) : 1;
          const distR = rightEar ? Math.hypot(pNormX - rightEar.x, pNormY - rightEar.y) : 1;
          if (distL < 0.22 || distR < 0.22) {
            phoneNearEar = true;
          }
        }

        if (phoneNearEar || this.latestPhoneState?.mode === 'CALLING') {
          phoneModeStr = 'calling';
          phoneDescription = 'Calling (Near Ear)';
        } else if (phoneInHand && (rawHeadPose.pitch < -14 || rawBlendshapes.isGazeDown || this.latestPhoneState?.mode === 'TEXTING')) {
          phoneModeStr = 'texting';
          phoneDescription = 'Texting / Lap';
        } else if (phoneInHand) {
          phoneDescription = 'Phone In Hand';
        } else {
          phoneDescription = 'Phone Detected';
        }
      }

      // Real-time Hands on Wheel Evaluation
      let handsOnWheel = true;
      let handsCount = 2;

      if (!hasFace) {
        handsOnWheel = false;
        handsCount = 0;
      } else if (this.visionModels.handLandmarker) {
        const vHeight = video.videoHeight || 480;
        const steeringThresholdY = vHeight * 0.38;

        const handsOnWheelList = this.latestHandsRes.filter((h: any) => {
          const wristY = h.wristPx ? h.wristPx.y : (h.bbox?.originY || 0) + (h.bbox?.height || 0);
          const isLowerZone = wristY >= steeringThresholdY;
          if (phoneNearEar || (phoneInHand && h.bbox && activePhones[0]?.box)) {
            const pBox = activePhones[0]?.box;
            const dx = Math.abs((h.bbox.originX + h.bbox.width / 2) - (pBox.originX + pBox.width / 2));
            const dy = Math.abs((h.bbox.originY + h.bbox.height / 2) - (pBox.originY + pBox.height / 2));
            if (dx < 160 && dy < 160) return false;
          }
          return isLowerZone;
        });

        if (this.latestHandsRes.length > 0) {
          handsCount = handsOnWheelList.length;
          handsOnWheel = handsCount > 0;
        } else {
          if (phoneInHand) {
            handsCount = 1;
            handsOnWheel = true;
          } else {
            handsCount = 2;
            handsOnWheel = true;
          }
        }
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
          ? rawHeadPose.pitch > 20
            ? 'looking_up'
            : rawHeadPose.pitch < -15
            ? 'looking_down'
            : rawHeadPose.yaw > 20
            ? 'looking_left'
            : rawHeadPose.yaw < -20
            ? 'looking_right'
            : 'head_turned'
          : 'normal',
        isYawning: Boolean(state?.mouth?.isYawningNow || rawBlendshapes.isYawningCandidate),
        isUsingPhone: Boolean(hasDetectedPhone && (phoneInHand || phoneNearEar || phoneModeStr !== 'none')),
        phoneMode: phoneModeStr,
        handsOnWheel,
        seatbeltFastened: this.latestSeatbeltFastened,
        headPose: {
          yaw: hasFace ? rawHeadPose.yaw : 0,
          pitch: hasFace ? rawHeadPose.pitch : 0,
          roll: hasFace ? rawHeadPose.roll : 0,
          direction: !hasFace ? 'NO_FACE' : rawHeadPose.direction,
          isLookingAway: rawHeadPose.isLookingAway || rawBlendshapes.isGazeAway,
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
      this.webMediaStream.getTracks().forEach((track) => track.stop());
      this.webMediaStream = null;
    }
    if (this.hiddenVideoElement) {
      this.hiddenVideoElement.srcObject = null;
      this.hiddenVideoElement.remove();
      this.hiddenVideoElement = null;
    }
    this.driverEngine?.reset?.();
    this.phoneEngine?.reset?.();
    this.latestPhoneState = null;
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
