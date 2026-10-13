// src/services/dms/visionCueAdapter.ts
/**
 * VisionCue DMS Adapter
 * Bridges on-device MediaPipe Computer Vision models with Raasta Kashmir's DMS Central Engine.
 */

// @ts-ignore - imported from headless core js modules
import { loadVisionModels } from './core/vision/loadVisionModels.js';
// @ts-ignore
import { detectFaceLandmarks } from './core/vision/detectFaceLandmarks.js';
// @ts-ignore
import { detectPhone } from './core/vision/detectPhone.js';
// @ts-ignore
import { detectHands, HAND_CONNECTIONS } from './core/vision/detectHands.js';
// @ts-ignore
import { extractHeadPose } from './core/vision/headPose.js';
// @ts-ignore
import { extractDriverBlendshapes } from './core/vision/blendshapes.js';
// @ts-ignore
import { createDriverStateEngine } from './core/interpretation/driverStateEngine.js';
// @ts-ignore
import { createPhoneDetectorEngine } from './core/interpretation/phoneDetectorEngine.js';
// @ts-ignore
import { createSafetyEventEngine } from './core/events/safetyEventEngine.js';
// @ts-ignore
import { SAFETY_EVENT_TYPES, EVENT_SEVERITY } from './core/events/safetyEventTypes.js';

import { dmsEngine } from './dmsEngine';
import { SafetyEventType, SafetyEventSeverity } from '../../types/fleet';

export {
  loadVisionModels,
  detectFaceLandmarks,
  detectPhone,
  detectHands,
  HAND_CONNECTIONS,
  extractHeadPose,
  extractDriverBlendshapes,
  createDriverStateEngine,
  createPhoneDetectorEngine,
  createSafetyEventEngine,
  SAFETY_EVENT_TYPES,
  EVENT_SEVERITY,
};

export interface VisionSafetyEvent {
  eventId: string;
  eventType: string;
  timestamp: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  durationMs?: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

/**
 * Map VisionCue safety events into Raasta Kashmir SafetyEvent format
 * and trigger central DMS engine notifications.
 */
export function forwardVisionEventToDMSEngine(event: VisionSafetyEvent) {
  let mappedType: SafetyEventType = 'drowsiness';
  let mappedSeverity: SafetyEventSeverity = 'warn';

  switch (event.eventType) {
    case 'MICROSLEEP_DETECTED':
      mappedType = 'drowsiness';
      mappedSeverity = 'critical';
      break;
    case 'FATIGUE_INDICATOR':
      mappedType = 'yawn';
      mappedSeverity = 'warn';
      break;
    case 'DRIVER_DISTRACTION':
      mappedType = 'hands_off';
      mappedSeverity = 'warn';
      break;
    case 'PHONE_USE_DETECTED':
    case 'PHONE_CALL_DETECTED':
    case 'PHONE_TEXTING_DETECTED':
      mappedType = 'phone_use';
      mappedSeverity = 'critical';
      break;
    case 'CAMERA_OBSTRUCTED':
      mappedType = 'tamper';
      mappedSeverity = 'warn';
      break;
    case 'DRIVER_OUT_OF_POSITION':
      mappedType = 'hands_off';
      mappedSeverity = 'warn';
      break;
    default:
      mappedType = 'drowsiness';
      mappedSeverity = event.severity === 'CRITICAL' ? 'critical' : 'warn';
  }

  // Forward to Raasta Kashmir DMS Engine
  dmsEngine.emitVisionSafetyEvent({
    type: mappedType,
    severity: mappedSeverity,
    confidence: event.confidence ?? 0.92,
    source: 'driver_cam',
    title: event.title,
    message: event.message,
    durationMs: event.durationMs ?? 1500,
  });
}

import { onNativeLandmarks, NativeLandmarkPayload } from './nativeUsbDmsBridge';

export interface NativeDmsBridgeConfig {
  tripId?: string;
  vehicleId?: string;
  driverId?: string;
  onStateUpdate?: (state: any) => void;
  onEvent?: (event: VisionSafetyEvent) => void;
}

/**
 * Initializes the Native USB / Mobile Camera landmark bridge.
 * Ingests 15 FPS landmarks emitted by UsbCameraDmsModule,
 * runs the driverStateEngine & phoneDetectorEngine algorithms,
 * and passes the metrics into Raasta Kashmir's DMS Central Engine.
 */
export function initNativeLandmarkBridge(config: NativeDmsBridgeConfig = {}) {
  const tripId = config.tripId || 'TRIP_KSH_01';
  const vehicleId = config.vehicleId || 'JK-01-AB-1234';
  const driverId = config.driverId || 'DRV-8821';

  const driverEngine: any = createDriverStateEngine();
  const phoneEngine: any = createPhoneDetectorEngine();
  const safetyEngine: any = createSafetyEventEngine({
    cooldownMs: 6000, // 6.0s alert cooldown to prevent alert flooding
    onEvent: (ev: VisionSafetyEvent) => {
      forwardVisionEventToDMSEngine(ev);
      config.onEvent?.(ev);
    },
  });

  let latestPhoneState: any = null;

  const unsubscribe = onNativeLandmarks((payload: NativeLandmarkPayload) => {
    try {
      const now = payload.timestamp || Date.now();

      // 1. Process Phone & Hand Posture
      const rawPhones = payload.phoneDetection?.isDetected
        ? [
            {
              box: payload.phoneDetection.box || [0.4, 0.4, 0.2, 0.2],
              score: payload.phoneDetection.confidence || 0.85,
              label: 'cell phone',
            },
          ]
        : [];

      const phoneState = phoneEngine.processFrame({
        rawPhones,
        faceLandmarks: payload.faceLandmarks || null,
        headPose: payload.headPose || null,
        blendshapes: payload.faceBlendshapes || null,
        hands: payload.hands || [],
        frameWidth: 640,
        frameHeight: 480,
        timestamp: now,
      });
      latestPhoneState = phoneState;

      // 2. Process Full Driver State (PERCLOS, Yawn, Distraction, Out-of-Position)
      const state = driverEngine.processFrame({
        pctx: null, // Headless native mode (no DOM Canvas needed)
        canvasWidth: 640,
        canvasHeight: 480,
        faceLandmarks: payload.faceLandmarks || null,
        allFaceLandmarks: payload.faceLandmarks ? [payload.faceLandmarks] : [],
        faceBlendshapes: payload.faceBlendshapes || null,
        facialTransformationMatrix: payload.facialTransformationMatrix || null,
        phoneState: latestPhoneState,
        timestamp: now,
      });

      const fullState: any = {
        ...state,
        hands: payload.hands || [],
        source: payload.source,
        fps: payload.fps,
      };

      // 3. Update Raasta Central DMS Engine Status
      dmsEngine.updateVisionMetrics({
        perclos: fullState.eyes?.perclosScore ? fullState.eyes.perclosScore / 100 : 0.05,
        isMicrosleeping: fullState.eyes?.isMicrosleep,
        isDistracted: fullState.pose?.isDistracted,
        isYawning: fullState.mouth?.isYawningNow,
        isUsingPhone: fullState.phone?.isConfirmed,
        phoneMode:
          fullState.phone?.mode === 'CALLING'
            ? 'calling'
            : fullState.phone?.mode === 'TEXTING'
            ? 'texting'
            : 'none',
        handsOnWheel: !(fullState.phone?.isConfirmed && fullState.phone?.isHandAssociated),
      });

      // 4. Evaluate Safety Events
      safetyEngine.evaluate(state, {
        tripId,
        vehicleId,
        driverId,
      });

      config.onStateUpdate?.(fullState);
    } catch (err) {
      console.warn('[initNativeLandmarkBridge] Error processing native frame:', err);
    }
  });

  return () => {
    unsubscribe();
    driverEngine.reset?.();
    phoneEngine.reset?.();
  };
}
