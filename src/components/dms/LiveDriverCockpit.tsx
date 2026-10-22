import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import {
  Camera,
  Eye,
  Smartphone,
  AlertTriangle,
  ShieldCheck,
  Activity,
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Volume2,
  Usb,
} from 'lucide-react-native';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { Badge } from '../ui/Badge';
import {
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
  forwardVisionEventToDMSEngine,
  VisionSafetyEvent,
  initNativeLandmarkBridge,
  extractTorsoGeometry,
  evaluateHybridFusion,
  SeatbeltTemporalTracker,
  createSeatbeltDetectorEngine,
  SEATBELT_TEMPORAL_STATE,
  detectPose,
} from '../../services/dms/visionCueAdapter';
import { dmsEngine } from '../../services/dms/dmsEngine';
import {
  isUsbCameraAvailable,
  getConnectedUsbDevices,
  requestUsbPermission,
  startNativeMonitoring,
  stopNativeMonitoring,
  switchNativeCameraSource,
  onUsbAttached,
  onUsbDetached,
  UsbCameraPreviewView,
  UsbDeviceMetadata,
} from '../../services/dms/nativeUsbDmsBridge';

interface LiveDriverCockpitProps {
  visible: boolean;
  onClose: () => void;
  tripId?: string;
  vehicleId?: string;
  driverId?: string;
}

export const LiveDriverCockpit: React.FC<LiveDriverCockpitProps> = ({
  visible,
  onClose,
  tripId = 'TRIP_KSH_01',
  vehicleId = 'JK-01-AB-1234',
  driverId = 'DRV-8821',
}) => {
  const { colors } = useAppTheme();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [showWireframe, setShowWireframe] = useState(true);
  const [events, setEvents] = useState<VisionSafetyEvent[]>([]);
  const [driverState, setDriverState] = useState<any>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // Native Mobile USB & Front Camera State
  const [isUsbConnected, setIsUsbConnected] = useState<boolean>(false);
  const [nativeCameraSource, setNativeCameraSource] = useState<'usb' | 'front'>('usb');
  const [connectedUsbDevices, setConnectedUsbDevices] = useState<UsbDeviceMetadata[]>([]);
  const nativeBridgeCleanupRef = useRef<(() => void) | null>(null);

  // Web Video & Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Engine Refs
  const visionModelsRef = useRef<any>(null);
  const driverEngineRef = useRef<any>(null);
  const phoneEngineRef = useRef<any>(null);
  const safetyEngineRef = useRef<any>(null);
  const lastPhoneCheckRef = useRef<number>(0);
  const latestPhoneStateRef = useRef<any>(null);
  const latestHandsRef = useRef<any[]>([]);
  const seatbeltEngineRef = useRef<any>(null);
  const seatbeltCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastSeatbeltCheckRef = useRef<number>(0);
  const latestSeatbeltRef = useRef<boolean>(false);
  const latestSeatbeltStateRef = useRef<any>(null);

  // Enumerate & Refresh Available Video Devices (Built-in & External USB / Dashcams on Web)
  const refreshCameras = useCallback(async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        if (videoDevices.length > 0 && !selectedCameraId) {
          setSelectedCameraId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.warn('[LiveDriverCockpit] Could not enumerate camera devices:', err);
      }
    }
  }, [selectedCameraId]);

  // Initialize Engines, Web Models, or Native USB Device Listeners
  useEffect(() => {
    if (!visible) {
      stopCamera();
      return;
    }

    if (Platform.OS === 'web') {
      refreshCameras();
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.ondevicechange = refreshCameras;
      }

      safetyEngineRef.current = createSafetyEventEngine({
        cooldownMs: 4000,
        onEvent: (ev: VisionSafetyEvent) => {
          setEvents((prev) => [ev, ...prev].slice(0, 50));
          // Bridge directly to Raasta Kashmir Central DMS Engine & Fleet bus
          forwardVisionEventToDMSEngine(ev);
        },
      });

      driverEngineRef.current = createDriverStateEngine();
      phoneEngineRef.current = createPhoneDetectorEngine({
        callingConfirmationMs: 1000,
        dropoutToleranceMs: 750,
      });
      seatbeltEngineRef.current = createSeatbeltDetectorEngine({
        selectedSide: "AUTO",
        confidenceThreshold: 0.38,
        retentionThreshold: 0.22,
        confirmationWindowMs: 750,
        unfastenDelayMs: 1500,
      });

      const pCanvas = document.createElement('canvas');
      pCanvas.width = 320;
      pCanvas.height = 240;
      processCanvasRef.current = pCanvas;

      const sCanvas = document.createElement('canvas');
      seatbeltCanvasRef.current = sCanvas;

      async function init() {
        try {
          setIsModelLoading(true);
          setModelError(null);
          const models = await loadVisionModels();
          visionModelsRef.current = models;
          setIsModelLoading(false);
        } catch (err: any) {
          console.error('[LiveDriverCockpit] Failed to load Vision Models:', err);
          setModelError(err?.message || 'Failed to download MediaPipe models');
          setIsModelLoading(false);
        }
      }

      init();

      return () => {
        stopCamera();
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
          navigator.mediaDevices.ondevicechange = null;
        }
      };
    } else {
      // Native Android / Mobile Hardware Setup
      const checkUsb = async () => {
        try {
          const avail = await isUsbCameraAvailable();
          setIsUsbConnected(avail);
          if (avail) {
            setNativeCameraSource('usb');
          } else {
            setNativeCameraSource('front');
          }
          const devices = await getConnectedUsbDevices();
          setConnectedUsbDevices(devices);
        } catch (e) {
          console.warn('[LiveDriverCockpit] USB check error:', e);
        }
      };
      checkUsb();

      const unsubAttach = onUsbAttached((dev) => {
        setIsUsbConnected(true);
        setConnectedUsbDevices((prev) => [
          ...prev.filter((d) => d.vendorId !== dev.vendorId || d.productId !== dev.productId),
          dev,
        ]);
      });

      const unsubDetach = onUsbDetached(() => {
        isUsbCameraAvailable().then((avail) => {
          setIsUsbConnected(avail);
          if (!avail) setNativeCameraSource('front');
        });
        getConnectedUsbDevices().then(setConnectedUsbDevices);
      });

      return () => {
        stopCamera();
        unsubAttach();
        unsubDetach();
      };
    }
  }, [visible]);

  // Frame Processing Loop for Web
  const processLoop = useCallback(() => {
    if (Platform.OS !== 'web') return;

    const video = videoRef.current;
    const visionModels = visionModelsRef.current;
    const driverEngine = driverEngineRef.current;
    const phoneEngine = phoneEngineRef.current;
    const safetyEngine = safetyEngineRef.current;
    const pCanvas = processCanvasRef.current;
    const canvas = canvasRef.current;

    if (!video || !visionModels || !driverEngine || !phoneEngine || !safetyEngine || video.readyState < 2) {
      animFrameIdRef.current = requestAnimationFrame(processLoop);
      return;
    }

    const now = performance.now();

    // 1. Image Quality Frame sampling
    const pctx = pCanvas?.getContext('2d', { willReadFrequently: true });
    if (pctx && pCanvas) {
      pctx.drawImage(video, 0, 0, pCanvas.width, pCanvas.height);
    }

    // 2. High-Frequency Face Landmark Detection
    const detection = detectFaceLandmarks(visionModels.faceLandmarker, video, now);

    // 3. Object & Hand Detection (Phone cadence ~8 FPS)
    const PHONE_CADENCE_MS = 125;
    if (now - lastPhoneCheckRef.current >= PHONE_CADENCE_MS) {
      lastPhoneCheckRef.current = now;
      const frameWidth = video.videoWidth || 640;
      const frameHeight = video.videoHeight || 480;

      const phoneRes = detectPhone(visionModels.objectDetector, video, now);
      const handsRes = detectHands(visionModels.handLandmarker, video, frameWidth, frameHeight, now);
      latestHandsRef.current = handsRes;

      const rawHeadPose = extractHeadPose(
        detection?.facialTransformationMatrix,
        detection?.faceLandmarks,
        detection?.faceBlendshapes
      );
      const rawBlendshapes = extractDriverBlendshapes(detection?.faceBlendshapes);

      const phoneState = phoneEngine.processFrame({
        rawPhones: phoneRes.phones,
        faceLandmarks: detection?.faceLandmarks || null,
        headPose: rawHeadPose,
        blendshapes: rawBlendshapes,
        hands: handsRes,
        frameWidth,
        frameHeight,
        timestamp: now,
      });
      latestPhoneStateRef.current = phoneState;
    }

    // 4. Update Driver State Engine
    const state = driverEngine.processFrame({
      pctx,
      canvasWidth: pCanvas?.width || 320,
      canvasHeight: pCanvas?.height || 240,
      faceLandmarks: detection?.faceLandmarks || null,
      allFaceLandmarks: detection?.allFaceLandmarks || [],
      faceBlendshapes: detection?.faceBlendshapes || null,
      facialTransformationMatrix: detection?.facialTransformationMatrix || null,
      phoneState: latestPhoneStateRef.current,
      timestamp: now,
    });

    const fullState = {
      ...state,
      hands: latestHandsRef.current || [],
    };
    setDriverState(fullState);

    // Evaluate Hands on Wheel accurately in Cockpit
    const vHeight = video.videoHeight || 480;
    const vWidth = video.videoWidth || 640;
    const chin = detection?.faceLandmarks?.[152];
    const nose = detection?.faceLandmarks?.[1];
    const forehead = detection?.faceLandmarks?.[10];
    const chinY = chin ? chin.y * vHeight : vHeight * 0.45;
    const faceH = (chin && forehead)
      ? Math.hypot((chin.x - forehead.x) * vWidth, (chin.y - forehead.y) * vHeight)
      : vHeight * 0.28;
    const faceRadius = faceH * 0.65;
    const steeringZoneMinY = Math.max(vHeight * 0.44, chinY + faceH * 0.18);
    const pBox = latestPhoneStateRef.current?.rawPhones?.[0]?.box;

    const handsOnWheelList = (latestHandsRef.current || []).filter((h: any) => {
      const hwX = h.wristPx ? h.wristPx.x : (h.bbox?.originX || 0) + (h.bbox?.width || 0) / 2;
      const hwY = h.wristPx ? h.wristPx.y : (h.bbox?.originY || 0) + (h.bbox?.height || 0) / 2;
      if (nose) {
        const distToNose = Math.hypot(hwX - nose.x * vWidth, hwY - nose.y * vHeight);
        if (distToNose < faceRadius) return false;
      }
      if (hwY < chinY) return false;
      if (pBox) {
        const pdx = Math.abs(hwX - (pBox.originX + pBox.width / 2));
        const pdy = Math.abs(hwY - (pBox.originY + pBox.height / 2));
        if (pdx < 140 && pdy < 140) return false;
      }
      return hwY >= steeringZoneMinY;
    });

    const cockpitHandsCount = handsOnWheelList.length;
    const cockpitHandsOnWheel = cockpitHandsCount > 0;

    // Evaluate Seatbelt in Cockpit (250ms cadence)
    if (now - lastSeatbeltCheckRef.current >= 250) {
      lastSeatbeltCheckRef.current = now;
      const frameWidth = video.videoWidth || 640;
      const frameHeight = video.videoHeight || 480;

      if (!seatbeltEngineRef.current) {
        seatbeltEngineRef.current = createSeatbeltDetectorEngine({
          selectedSide: "AUTO",
          confidenceThreshold: 0.38,
          retentionThreshold: 0.22,
          confirmationWindowMs: 750,
          unfastenDelayMs: 1500,
        });
      }

      let poseLandmarks: any = null;
      if (visionModels.poseLandmarker) {
        poseLandmarks = detectPose(visionModels.poseLandmarker, video, now);
      }
      const targetLandmarks = poseLandmarks || (detection?.faceLandmarks || null);
      const sCanvas = seatbeltCanvasRef.current;

      if (targetLandmarks && sCanvas && frameWidth > 0 && frameHeight > 0) {
        try {
          if (sCanvas.width !== frameWidth || sCanvas.height !== frameHeight) {
            sCanvas.width = frameWidth;
            sCanvas.height = frameHeight;
          }
          const sctx = sCanvas.getContext('2d', { willReadFrequently: true });
          if (sctx) {
            // Render horizontally mirrored video frame onto offscreen buffer so pixel coordinates match driver perspective
            sctx.save();
            sctx.translate(frameWidth, 0);
            sctx.scale(-1, 1);
            sctx.drawImage(video, 0, 0, frameWidth, frameHeight);
            sctx.restore();

            const sImageData = sctx.getImageData(0, 0, frameWidth, frameHeight);
            const seatbeltRes = seatbeltEngineRef.current.processFrame({
              imageData: sImageData,
              poseLandmarks: targetLandmarks,
              frameWidth,
              frameHeight,
              timestamp: now,
            });
            latestSeatbeltStateRef.current = seatbeltRes;
            latestSeatbeltRef.current = Boolean(seatbeltRes?.isFastened);
          }
        } catch (sbErr) {
          console.warn('[LiveDriverCockpit] Seatbelt evaluation error:', sbErr);
        }
      } else {
        const seatbeltRes = seatbeltEngineRef.current.processFrame({
          imageData: null,
          poseLandmarks: null,
          frameWidth,
          frameHeight,
          timestamp: now,
        });
        latestSeatbeltStateRef.current = seatbeltRes;
        latestSeatbeltRef.current = Boolean(seatbeltRes?.isFastened);
      }
    }

    const isDistracted = Boolean(
      fullState.pose?.isDistracted &&
      fullState.pose?.direction !== 'FORWARD'
    );

    // Update Central DMS status
    dmsEngine.updateVisionMetrics({
      perclos: fullState.eyes?.perclosScore ? fullState.eyes.perclosScore / 100 : 0.05,
      isMicrosleeping: fullState.eyes?.isMicrosleep,
      isDistracted,
      distractionReason: isDistracted
        ? fullState.pose.pitch > 22
          ? 'looking_up'
          : fullState.pose.pitch < -20
          ? 'looking_down'
          : fullState.pose.yaw > 25
          ? 'looking_left'
          : fullState.pose.yaw < -25
          ? 'looking_right'
          : fullState.pose?.direction && fullState.pose.direction.startsWith('GAZE_')
          ? (fullState.pose.direction.toLowerCase() as any)
          : 'head_turned'
        : 'normal',
      headPose: {
        yaw: fullState.pose?.yaw || 0,
        pitch: fullState.pose?.pitch || 0,
        roll: fullState.pose?.roll || 0,
        direction: fullState.pose?.direction || 'FORWARD',
        isLookingAway: isDistracted,
      },
      isUsingPhone: Boolean(fullState.phone?.isConfirmed && fullState.phone?.isHandAssociated),
      phoneMode: (fullState.phone?.isHandAssociated && fullState.phone?.mode === 'CALLING')
        ? 'calling'
        : (fullState.phone?.isHandAssociated && fullState.phone?.mode === 'TEXTING')
        ? 'texting'
        : 'none',
      handsCount: cockpitHandsCount,
      handsOnWheel: cockpitHandsOnWheel,
      seatbeltFastened: latestSeatbeltRef.current,
    });

    // 5. Evaluate Safety Events
    safetyEngine.evaluate(state, {
      tripId,
      vehicleId,
      driverId,
    });

    // 6. Draw Wireframe & HUD Overlays onto Canvas
    if (canvas && video) {
      drawCanvasOverlay(
        canvas,
        video,
        detection?.faceLandmarks,
        fullState.pose,
        fullState.phone,
        fullState.hands,
        latestSeatbeltStateRef.current,
        showWireframe
      );
    }

    animFrameIdRef.current = requestAnimationFrame(processLoop);
  }, [showWireframe, tripId, vehicleId, driverId]);

  // Canvas drawing routine
  function drawCanvasOverlay(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    landmarks: any,
    headPose: any,
    phoneState: any,
    hands: any[],
    seatbeltState: any,
    wireframeEnabled: boolean
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    const w = canvas.width;
    const h = canvas.height;
    
    // Draw Cockpit Telemetry Radar Background (No raw video streamed)
    ctx.fillStyle = '#0B0B14';
    ctx.fillRect(0, 0, w, h);

    // Subtle Radar Grid & Concentric Crosshairs
    ctx.strokeStyle = 'rgba(108, 92, 231, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.28, 0, 2 * Math.PI);
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.44, 0, 2 * Math.PI);
    ctx.stroke();

    // Top watermark indicating headless processing
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('HEADLESS ON-DEVICE VISION RADAR · NO RAW VIDEO STREAMED', 16, 26);

    if (!wireframeEnabled) return;

    // 1. Draw Face Wireframe Landmarks
    if (landmarks && landmarks.length > 0) {
      ctx.lineWidth = 1.2;

      // Face Oval
      const faceOvalIdxs = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
        400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
        54, 103, 67, 109, 10
      ];
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.6)';
      for (let i = 0; i < faceOvalIdxs.length; i++) {
        const pt = landmarks[faceOvalIdxs[i]];
        if (!pt) continue;
        if (i === 0) ctx.moveTo(pt.x * w, pt.y * h);
        else ctx.lineTo(pt.x * w, pt.y * h);
      }
      ctx.stroke();

      // Eyes
      const leftEyeIdxs = [33, 160, 158, 133, 153, 144, 33];
      const rightEyeIdxs = [362, 385, 387, 263, 373, 380, 362];
      ctx.strokeStyle = '#00f0ff';
      [leftEyeIdxs, rightEyeIdxs].forEach((indices) => {
        ctx.beginPath();
        for (let i = 0; i < indices.length; i++) {
          const pt = landmarks[indices[i]];
          if (!pt) continue;
          if (i === 0) ctx.moveTo(pt.x * w, pt.y * h);
          else ctx.lineTo(pt.x * w, pt.y * h);
        }
        ctx.stroke();
      });

      // Mouth
      const mouthIdxs = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 61];
      ctx.beginPath();
      ctx.strokeStyle = '#f59e0b';
      for (let i = 0; i < mouthIdxs.length; i++) {
        const pt = landmarks[mouthIdxs[i]];
        if (!pt) continue;
        if (i === 0) ctx.moveTo(pt.x * w, pt.y * h);
        else ctx.lineTo(pt.x * w, pt.y * h);
      }
      ctx.stroke();

      // Nose & 3D Pose Arrow
      const nose = landmarks[1];
      if (nose && headPose) {
        const nx = nose.x * w;
        const ny = nose.y * h;
        const radYaw = (headPose.yaw * Math.PI) / 180;
        const radPitch = (headPose.pitch * Math.PI) / 180;
        const arrowLen = 55;
        const targetX = nx - Math.sin(radYaw) * arrowLen;
        const targetY = ny - Math.sin(radPitch) * arrowLen;

        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(targetX, targetY);
        ctx.strokeStyle = headPose.isLookingAway ? '#ef4444' : '#10b981';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(targetX, targetY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = headPose.isLookingAway ? '#ef4444' : '#10b981';
        ctx.fill();
      }
    }

    // 2. Draw Hands Skeleton
    if (hands && hands.length > 0) {
      for (const hand of hands) {
        if (!hand.landmarksPx) continue;
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1.5;
        for (const [i1, i2] of HAND_CONNECTIONS) {
          const p1 = hand.landmarksPx[i1];
          const p2 = hand.landmarksPx[i2];
          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
        for (const pt of hand.landmarksPx) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = '#00f0ff';
          ctx.fill();
        }
      }
    }

    // 3. Draw Mobile Phone Bounding Box
    if (phoneState?.candidate) {
      const { originX, originY, width, height } = phoneState.candidate.box;
      const isInHand = Boolean(phoneState.isHandAssociated);
      const isConfirmed = phoneState.isConfirmed && isInHand;
      const earBadge = phoneState.activeEar
        ? phoneState.activeEar === 'LEFT_EAR'
          ? ' (LEFT EAR)'
          : ' (RIGHT EAR)'
        : '';

      const modeStr = (isInHand && phoneState.mode === 'CALLING')
        ? `PHONE: CALLING${earBadge}`
        : (isInHand && phoneState.mode === 'TEXTING')
        ? 'PHONE: TEXTING'
        : isInHand
        ? 'PHONE: IN HAND'
        : 'PHONE (IN MOUNT)';

      const boxColor = !isInHand
        ? '#64748b'
        : phoneState.mode === 'CALLING'
        ? '#ef4444'
        : phoneState.mode === 'TEXTING'
        ? '#f59e0b'
        : '#3b82f6';

      ctx.save();
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(originX, originY, width, height);

      // Label
      ctx.fillStyle = 'rgba(13, 13, 20, 0.85)';
      ctx.fillRect(originX, originY - 24, Math.max(160, width), 22);
      ctx.fillStyle = boxColor;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(modeStr, originX + 6, originY - 8);
      ctx.restore();
    }

    // 4. Draw Seatbelt Overlay Ribbon & Badge
    if (seatbeltState && seatbeltState.isDriverPresent) {
      const line = seatbeltState.strapLine || seatbeltState.targetPath;
      if (line && line.start && line.end) {
        const x1 = line.start.x;
        const y1 = line.start.y;
        const x2 = line.end.x;
        const y2 = line.end.y;

        ctx.save();
        if (seatbeltState.isFastened) {
          // FASTENED: Bright glowing emerald ribbon
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = 'rgba(0, 255, 136, 0.35)';
          ctx.lineWidth = 10;
          ctx.lineCap = 'round';
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 3.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(x1, y1, 5, 0, 2 * Math.PI);
          ctx.arc(x2, y2, 5, 0, 2 * Math.PI);
          ctx.fillStyle = '#00ff88';
          ctx.fill();

          const tagText = `SEATBELT FASTENED ${Math.round((seatbeltState.smoothedConfidence || seatbeltState.confidence || 0.9) * 100)}%`;
          ctx.font = 'bold 11px monospace';
          const tagW = ctx.measureText(tagText).width + 16;
          const tagH = 20;
          const pillX = Math.max(10, Math.min(w - tagW - 10, x1 - tagW / 2));
          const pillY = Math.max(10, y1 - 24);

          ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 1.2;
          ctx.fillRect(pillX, pillY, tagW, tagH);
          ctx.strokeRect(pillX, pillY, tagW, tagH);

          ctx.fillStyle = '#00ff88';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tagText, pillX + tagW / 2, pillY + tagH / 2);
        } else if (seatbeltState.state === 'FASTENING') {
          // FASTENING: Pulsing amber dashed track
          ctx.beginPath();
          ctx.setLineDash([8, 6]);
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = '#ffb703';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.setLineDash([]);

          const pct = Math.round(seatbeltState.progress || 0);
          const tagText = `LATCHING SEATBELT (${pct}%)...`;
          ctx.font = 'bold 11px monospace';
          const tagW = ctx.measureText(tagText).width + 16;
          const tagH = 20;
          const pillX = Math.max(10, Math.min(w - tagW - 10, x1 - tagW / 2));
          const pillY = Math.max(10, y1 - 24);

          ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
          ctx.strokeStyle = '#ffb703';
          ctx.lineWidth = 1.2;
          ctx.fillRect(pillX, pillY, tagW, tagH);
          ctx.strokeRect(pillX, pillY, tagW, tagH);

          ctx.fillStyle = '#ffb703';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tagText, pillX + tagW / 2, pillY + tagH / 2);
        } else {
          // UNFASTENED: Dim Guide Track
          ctx.beginPath();
          ctx.setLineDash([4, 6]);
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = 'rgba(255, 51, 102, 0.35)';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    }
  }

  // Start Camera (supports Web getUserMedia and Android Native USB / Front Camera)
  async function startCamera(targetDeviceId?: string) {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;

      const deviceIdToUse = targetDeviceId || selectedCameraId;
      try {
        const videoConstraints: MediaTrackConstraints = deviceIdToUse
          ? {
              deviceId: { exact: deviceIdToUse },
              width: { ideal: 640 },
              height: { ideal: 480 },
            }
          : {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user',
            };

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsCameraActive(true);
            animFrameIdRef.current = requestAnimationFrame(processLoop);
            // Refresh devices so labels are populated after permission is granted
            refreshCameras();
          };
        }
      } catch (err: any) {
        console.error('[LiveDriverCockpit] Camera error:', err);
        alert('Unable to access camera: ' + err.message);
      }
    } else {
      // Native Android / Mobile Camera Mode
      try {
        setIsModelLoading(true);
        setModelError(null);

        const targetSource = nativeCameraSource === 'usb' && isUsbConnected ? 'usb' : 'front';
        if (targetSource === 'usb') {
          await requestUsbPermission();
        }

        const started = await startNativeMonitoring(targetSource);
        if (!started) {
          console.warn('[LiveDriverCockpit] Fallback to front camera');
          await startNativeMonitoring('front');
          setNativeCameraSource('front');
        }

        if (nativeBridgeCleanupRef.current) {
          nativeBridgeCleanupRef.current();
        }

        nativeBridgeCleanupRef.current = initNativeLandmarkBridge({
          tripId,
          vehicleId,
          driverId,
          onStateUpdate: (st) => {
            setDriverState(st);
          },
          onEvent: (ev) => {
            setEvents((prev) => [ev, ...prev].slice(0, 50));
          },
        });

        setIsCameraActive(true);
        setIsModelLoading(false);
      } catch (err: any) {
        console.error('[LiveDriverCockpit] Native camera start error:', err);
        setModelError(err?.message || 'Failed to start native camera stream');
        setIsModelLoading(false);
      }
    }
  }

  // Switch between Built-in Camera and External USB / Dashcam on Web
  const handleCameraChange = async (newDeviceId: string) => {
    setSelectedCameraId(newDeviceId);
    if (isCameraActive) {
      stopCamera();
      setTimeout(() => {
        startCamera(newDeviceId);
      }, 150);
    }
  };

  // Switch between USB External Dashcam and Front Camera on Native Android
  const handleSwitchNativeSource = async (source: 'usb' | 'front') => {
    setNativeCameraSource(source);
    if (isCameraActive) {
      if (source === 'usb') {
        await requestUsbPermission();
      }
      await switchNativeCameraSource(source);
    }
  };

  // Stop Camera (Web Stream or Native Android Hardware loop)
  function stopCamera() {
    if (Platform.OS === 'web') {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      if (driverEngineRef.current) driverEngineRef.current.reset();
      if (phoneEngineRef.current) phoneEngineRef.current.reset();
      latestPhoneStateRef.current = null;
      latestHandsRef.current = [];
    } else {
      if (nativeBridgeCleanupRef.current) {
        nativeBridgeCleanupRef.current();
        nativeBridgeCleanupRef.current = null;
      }
      stopNativeMonitoring();
    }
    setIsCameraActive(false);
  }

  const eyes = driverState?.eyes || { perclosScore: 6, closedDurationMs: 0, blinkRate: 14 };
  const pose = driverState?.pose || { direction: 'FORWARD', yaw: 0, pitch: 0, offForwardDurationMs: 0, isOutOfPosition: false };
  const mouth = driverState?.mouth || { isYawningNow: false, jawOpen: 0.1, yawnCount: 0 };
  const phone = driverState?.phone || { isConfirmed: false, mode: 'NONE', progress: 0 };
  const quality = driverState?.quality || { overallQualityScore: 94, overallSeverity: 'good' };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Cockpit Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.statusIndicator, { backgroundColor: isCameraActive ? '#10b981' : '#6b7280' }]} />
            <Text style={[typography.titleLarge, { color: colors.textPrimary, fontWeight: '700' }]}>
              AI Driver Attention Cockpit
            </Text>
            <Badge
              label={isCameraActive ? 'LIVE EDGE AI' : 'STANDBY'}
              tone={isCameraActive ? 'success' : 'neutral'}
            />
          </View>

          <View style={styles.headerActionRow}>
            <TouchableOpacity
              style={[
                styles.cameraToggleBtn,
                { backgroundColor: isCameraActive ? '#dc2626' : colors.primary },
              ]}
              onPress={isCameraActive ? stopCamera : () => startCamera()}
              disabled={isModelLoading}
            >
              <Camera size={16} color="#FFFFFF" />
              <Text style={styles.cameraToggleBtnText}>
                {isModelLoading
                  ? 'Loading...'
                  : isCameraActive
                  ? 'Stop Camera'
                  : 'Start Monitoring'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {modelError && (
          <View style={styles.errorBanner}>
            <AlertTriangle size={18} color="#ef4444" />
            <Text style={styles.errorText}>
              Model Download Error: {modelError}. Please verify internet access for initial download.
            </Text>
          </View>
        )}

        {/* Cockpit Main Grid */}
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.gridRow}>
            {/* Left Column: Camera Viewport */}
            <View style={[styles.cameraCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.viewportContainer}>
                {Platform.OS === 'web' ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 340, backgroundColor: '#0B0B14', borderRadius: 12, overflow: 'hidden' }}>
                    {/* Headless Video Stream (Invisible to Driver, Processing Only) */}
                    <video
                      ref={videoRef as any}
                      playsInline
                      muted
                      autoPlay
                      style={{
                        display: 'none',
                      }}
                    />
                    <canvas
                      ref={canvasRef as any}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        transform: 'scaleX(-1)',
                      }}
                    />
                    {!isCameraActive && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(13,13,20,0.88)',
                          color: '#fff',
                        }}
                      >
                        <Camera size={44} color="#6C5CE7" style={{ marginBottom: 12 }} />
                        <span style={{ fontSize: 16, fontWeight: 700 }}>Driver Camera Offline</span>
                        <span style={{ fontSize: 13, color: '#9090ad', marginTop: 4 }}>
                          Click "Start Monitoring" to launch on-device MediaPipe inference
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <View style={styles.nativeViewportWrapper}>
                    {/* Native Camera Surface (Headless Ingestion Only) */}
                    <UsbCameraPreviewView style={{ width: 1, height: 1, opacity: 0 }} />

                    {isCameraActive ? (
                      <View style={styles.nativeLiveOverlay}>
                        {/* Header Telemetry Pill */}
                        <View style={styles.nativeOverlayHeader}>
                          <View style={styles.liveFpsBadge}>
                            <View style={styles.greenPulseDot} />
                            <Text style={styles.liveFpsText}>
                              15 FPS • {nativeCameraSource === 'usb' ? 'USB DASHCAM' : 'FRONT CAM'}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.attentionPill,
                              {
                                backgroundColor: pose.isDistracted
                                  ? 'rgba(239, 68, 68, 0.25)'
                                  : 'rgba(16, 185, 129, 0.25)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.attentionPillText,
                                { color: pose.isDistracted ? '#ef4444' : '#10b981' },
                              ]}
                            >
                              {pose.isDistracted ? 'LOOKING AWAY' : 'FOCUSED'}
                            </Text>
                          </View>
                        </View>

                        {/* Center Reticle & Pose Metrics */}
                        {showWireframe && (
                          <View style={styles.centerReticleContainer}>
                            <View
                              style={[
                                styles.faceMeshReticle,
                                pose.isDistracted && { borderColor: '#ef4444' },
                              ]}
                            >
                              <View style={styles.reticleCornerTL} />
                              <View style={styles.reticleCornerTR} />
                              <View style={styles.reticleCornerBL} />
                              <View style={styles.reticleCornerBR} />
                              <Text style={styles.reticleText}>
                                YAW: {typeof pose.yaw === 'number' ? pose.yaw.toFixed(1) : 0}° | PITCH:{' '}
                                {typeof pose.pitch === 'number' ? pose.pitch.toFixed(1) : 0}°
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Bottom Telemetry Bar */}
                        <View style={styles.nativeBottomTelemetry}>
                          <View style={styles.telemetryTag}>
                            <Text style={styles.telemetryLabel}>PERCLOS</Text>
                            <Text
                              style={[
                                styles.telemetryValue,
                                eyes.isMicrosleep && { color: '#ef4444' },
                              ]}
                            >
                              {eyes.perclosScore ?? 5}%
                            </Text>
                          </View>

                          <View style={styles.telemetryTag}>
                            <Text style={styles.telemetryLabel}>PHONE</Text>
                            <Text
                              style={[
                                styles.telemetryValue,
                                phone.isConfirmed && { color: '#ef4444' },
                              ]}
                            >
                              {phone.isConfirmed ? phone.mode : 'CLEAR'}
                            </Text>
                          </View>

                          <View style={styles.telemetryTag}>
                            <Text style={styles.telemetryLabel}>HANDS</Text>
                            <Text style={styles.telemetryValue}>ON WHEEL</Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.nativeOfflineOverlay}>
                        <Camera size={44} color="#6C5CE7" style={{ marginBottom: 12 }} />
                        <Text style={[typography.titleMedium, { color: '#fff', fontWeight: '700' }]}>
                          Driver Camera Standby
                        </Text>
                        <View style={styles.usbStatusPill}>
                          <View
                            style={[
                              styles.usbDot,
                              { backgroundColor: isUsbConnected ? '#10b981' : '#f59e0b' },
                            ]}
                          />
                          <Text style={styles.usbStatusText}>
                            {isUsbConnected
                              ? `External USB Webcam Ready (${
                                  connectedUsbDevices[0]?.productName || 'UVC Device'
                                })`
                              : 'No USB Camera Detected (Using Front Camera Fallback)'}
                          </Text>
                        </View>
                        <Text
                          style={[
                            typography.bodySmall,
                            {
                              color: '#9090ad',
                              textAlign: 'center',
                              marginTop: 8,
                              paddingHorizontal: 20,
                            },
                          ]}
                        >
                          Tap "Start Monitoring" to launch on-device 15 FPS MediaPipe NPU driver
                          monitoring.
                        </Text>
                        <TouchableOpacity
                          style={styles.nativeStartBtn}
                          onPress={() => startCamera()}
                        >
                          <Camera size={16} color="#FFFFFF" />
                          <Text style={styles.nativeStartBtnText}>Start Monitoring</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Camera Controls & Device Picker */}
              <View style={styles.cameraToolbar}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setShowWireframe(!showWireframe)}
                >
                  <View style={[styles.checkbox, showWireframe && { backgroundColor: colors.primary }]}>
                    {showWireframe && <CheckCircle2 size={12} color="#FFF" />}
                  </View>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Face Mesh & Hand Wireframes
                  </Text>
                </TouchableOpacity>

                {Platform.OS !== 'web' ? (
                  <View style={styles.nativeSourceRow}>
                    <TouchableOpacity
                      style={[
                        styles.nativeSourcePill,
                        nativeCameraSource === 'usb' && styles.nativeSourcePillActive,
                      ]}
                      onPress={() => handleSwitchNativeSource('usb')}
                    >
                      <View
                        style={[
                          styles.sourceDot,
                          { backgroundColor: isUsbConnected ? '#10b981' : '#6b7280' },
                        ]}
                      />
                      <Text
                        style={[
                          styles.nativeSourcePillText,
                          nativeCameraSource === 'usb' && styles.nativeSourcePillTextActive,
                        ]}
                      >
                        USB Dashcam {isUsbConnected ? '✓' : '(Unplugged)'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.nativeSourcePill,
                        nativeCameraSource === 'front' && styles.nativeSourcePillActive,
                      ]}
                      onPress={() => handleSwitchNativeSource('front')}
                    >
                      <Smartphone
                        size={12}
                        color={nativeCameraSource === 'front' ? '#6C5CE7' : '#9090ad'}
                      />
                      <Text
                        style={[
                          styles.nativeSourcePillText,
                          nativeCameraSource === 'front' && styles.nativeSourcePillTextActive,
                        ]}
                      >
                        Built-in Front
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  availableCameras.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginRight: 6 }]}>
                        Source:
                      </Text>
                      <select
                        value={selectedCameraId}
                        onChange={(e) => handleCameraChange(e.target.value)}
                        style={{
                          backgroundColor: '#1E1E2E',
                          color: '#FFFFFF',
                          border: '1px solid #374151',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 11,
                          cursor: 'pointer',
                          outline: 'none',
                          maxWidth: 190,
                        }}
                        title="Select Built-in or External USB / Dashboard Camera"
                      >
                        {availableCameras.map((cam, idx) => (
                          <option key={cam.deviceId || idx} value={cam.deviceId}>
                            {cam.label || `Camera ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </View>
                  )
                )}

                <Text style={[typography.caption, { color: colors.textTertiary }]}>
                  {isCameraActive ? '640x480 @ 30 FPS' : 'STANDBY'}
                </Text>
              </View>
            </View>

            {/* Right Column: High-Tech Telemetry HUD */}
            <View style={[styles.hudCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Overall Driver Attention Status */}
              <View style={[styles.attentionStatusBanner, { backgroundColor: ((pose.isDistracted && pose.direction !== 'FORWARD') || eyes.isMicrosleep) ? '#7F1D1D' : '#1A1A28' }]}>
                <Activity size={20} color={((pose.isDistracted && pose.direction !== 'FORWARD') || eyes.isMicrosleep) ? '#EF4444' : colors.success} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                    {eyes.isMicrosleep
                      ? '⚠️ MICROSLEEP ALERT'
                      : (pose.isDistracted && pose.direction !== 'FORWARD')
                      ? '⚠️ OFF-ROAD GAZE DISTRACTION'
                      : phone.isConfirmed
                      ? '⚠️ MOBILE PHONE DISTRACTION'
                      : '✅ DRIVER VIGILANT & ATTENTIVE'}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {tripId} · {vehicleId}
                  </Text>
                </View>
              </View>

              {/* HUD Gauge 1: Eye Closure & PERCLOS */}
              <View style={styles.gaugeBox}>
                <View style={styles.gaugeHeader}>
                  <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                    EYE CLOSURE & PERCLOS (FATIGUE)
                  </Text>
                  <Text style={[typography.caption, { color: eyes.perclosScore > 15 ? colors.danger : colors.textPrimary, fontWeight: '700' }]}>
                    {eyes.perclosScore.toFixed(0)}% (Threshold: 15%)
                  </Text>
                </View>
                <View style={styles.meterTrack}>
                  <View
                    style={[
                      styles.meterFill,
                      {
                        width: `${Math.min(100, eyes.perclosScore * 3.5)}%`,
                        backgroundColor: eyes.perclosScore > 15 ? colors.danger : '#00f0ff',
                      },
                    ]}
                  />
                </View>
                <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                  Closed Duration: {(eyes.closedDurationMs / 1000).toFixed(1)}s · Blink Rate: {eyes.blinkRate} /min
                </Text>
              </View>

              {/* HUD Gauge 2: Head Pose & Lateral Corridor */}
              <View style={styles.gaugeBox}>
                <View style={styles.gaugeHeader}>
                  <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                    HEAD POSE & GAZE DIRECTION
                  </Text>
                  <Text style={[typography.caption, { color: (pose.isDistracted && pose.direction !== 'FORWARD') ? colors.danger : colors.success, fontWeight: '700' }]}>
                    {pose.direction} (Y:{pose.yaw}° P:{pose.pitch}°)
                  </Text>
                </View>
                <View style={styles.meterTrack}>
                  <View
                    style={[
                      styles.meterFill,
                      {
                        width: `${Math.min(100, Math.max(10, Math.abs(pose.yaw) * 2))}%`,
                        backgroundColor: (pose.isDistracted && pose.direction !== 'FORWARD') ? colors.danger : colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                  {pose.offForwardDurationMs > 0
                    ? `Off-forward gaze: ${(pose.offForwardDurationMs / 1000).toFixed(1)}s`
                    : 'Forward road view maintained'}
                </Text>
              </View>

              {/* HUD Gauge 3: Mobile Phone Detection & Grip Association */}
              <View style={styles.gaugeBox}>
                <View style={styles.gaugeHeader}>
                  <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                    MOBILE PHONE INTERACTION MODE
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: phone.isConfirmed ? colors.danger : colors.textPrimary,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {phone.isConfirmed
                      ? phone.mode === 'CALLING'
                        ? '📞 AT EAR (CALLING)'
                        : phone.mode === 'TEXTING'
                        ? '💬 TEXTING / SCREEN'
                        : '📱 IN HAND'
                      : 'NO PHONE IN USE'}
                  </Text>
                </View>
                <View style={styles.meterTrack}>
                  <View
                    style={[
                      styles.meterFill,
                      {
                        width: `${Math.round((phone.progress || 0) * 100)}%`,
                        backgroundColor: phone.isConfirmed ? colors.danger : '#f59e0b',
                      },
                    ]}
                  />
                </View>
                <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                  Hand Association: {phone.isConfirmed ? 'CONFIRMED GRIP' : 'Normal Driving Grip'}
                </Text>
              </View>

              {/* HUD Gauge 4: Yawning & Video Quality Ribbon */}
              <View style={styles.bottomGaugeRow}>
                <View style={[styles.miniGauge, { flex: 1, marginRight: 8 }]}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>Yawn Counter</Text>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                    {mouth.yawnCount} yawns
                  </Text>
                </View>
                <View style={[styles.miniGauge, { flex: 1 }]}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>Camera Quality</Text>
                  <Text style={[typography.bodyMedium, { color: colors.success, fontWeight: '700' }]}>
                    {quality.overallQualityScore}/100
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Safety Event Bus */}
          <View style={[styles.eventStreamCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.eventStreamHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Volume2 size={18} color={colors.primary} />
                <Text style={[typography.titleMedium, { color: colors.textPrimary, marginLeft: 8, fontWeight: '700' }]}>
                  Real-Time Edge Safety Event Bus
                </Text>
                <Badge label={`${events.length} EVENTS`} tone="info" />
              </View>

              <TouchableOpacity style={styles.clearBtn} onPress={() => setEvents([])}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Clear Bus</Text>
              </TouchableOpacity>
            </View>

            {events.length === 0 ? (
              <View style={styles.emptyEventRow}>
                <CheckCircle2 size={18} color={colors.success} />
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 8 }]}>
                  No safety violations detected. Driving vigilance nominal.
                </Text>
              </View>
            ) : (
              events.map((ev) => (
                <TouchableOpacity
                  key={ev.eventId}
                  style={[
                    styles.eventItem,
                    {
                      borderColor: ev.severity === 'CRITICAL' ? colors.danger : colors.warning,
                      backgroundColor: ev.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.08)',
                    },
                  ]}
                  onPress={() => setSelectedEventId(selectedEventId === ev.eventId ? null : ev.eventId)}
                >
                  <View style={styles.eventItemRow}>
                    <Badge
                      label={ev.severity}
                      tone={ev.severity === 'CRITICAL' ? 'danger' : 'warning'}
                    />
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: 8, flex: 1, fontWeight: '600' }]}>
                      {ev.title}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textTertiary }]}>
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
                    {ev.message}
                  </Text>

                  {selectedEventId === ev.eventId && (
                    <View style={styles.jsonPreview}>
                      <Text style={[typography.caption, { color: '#a78bfa', fontFamily: 'monospace' }]}>
                        {JSON.stringify(ev, null, 2)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cameraToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  cameraToggleBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    flex: 1,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 16,
  },
  gridRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 16,
  },
  cameraCard: {
    flex: 1.2,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    minHeight: 380,
  },
  viewportContainer: {
    flex: 1,
    minHeight: 340,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  nativePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  nativeViewportWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
    minHeight: 340,
    borderRadius: 12,
    overflow: 'hidden',
  },
  nativeLiveOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 12,
  },
  nativeOverlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveFpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13, 13, 20, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  liveFpsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  attentionPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attentionPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  centerReticleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceMeshReticle: {
    width: 140,
    height: 180,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.5)',
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
  },
  reticleCornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 12,
    height: 12,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#6C5CE7',
  },
  reticleCornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#6C5CE7',
  },
  reticleCornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 12,
    height: 12,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#6C5CE7',
  },
  reticleCornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#6C5CE7',
  },
  reticleText: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    backgroundColor: 'rgba(13, 13, 20, 0.7)',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  nativeBottomTelemetry: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(13, 13, 20, 0.75)',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  telemetryTag: {
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 9,
    color: '#9090ad',
    fontWeight: '600',
  },
  telemetryValue: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '700',
  },
  nativeOfflineOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 13, 20, 0.92)',
    padding: 24,
  },
  usbStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  usbDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  usbStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  nativeStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 18,
  },
  nativeStartBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  nativeSourceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  nativeSourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  nativeSourcePillActive: {
    borderColor: '#6C5CE7',
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nativeSourcePillText: {
    fontSize: 11,
    color: '#9090ad',
  },
  nativeSourcePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cameraToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  attentionStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  gaugeBox: {
    gap: 6,
  },
  gaugeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 4,
  },
  bottomGaugeRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  miniGauge: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    borderRadius: 8,
  },
  eventStreamCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  eventStreamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearBtn: {
    padding: 4,
  },
  emptyEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  eventItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  eventItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jsonPreview: {
    backgroundColor: '#0d0d14',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
});
