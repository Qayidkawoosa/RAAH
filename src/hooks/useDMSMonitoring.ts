import { useEffect, useState, useCallback, useRef } from 'react';
import { dmsEngine, DMSStatus, ActiveDMSAlert, DriverFaceInput, DriverCabinInput } from '../services/dms/dmsEngine';
import { backgroundDmsService } from '../services/dms/backgroundDmsService';
import { SafetyEvent } from '../types/fleet';
import { tripService } from '../services/tripService';

export interface UseDMSMonitoringOptions {
  busId?: string;
  driverId?: string;
  schoolId?: string;
  tripId?: string;
  autoLogToService?: boolean;
}

export function useDMSMonitoring(options: UseDMSMonitoringOptions = {}) {
  const [dmsStatus, setDmsStatus] = useState<DMSStatus>(() => dmsEngine.getStatus());
  const [activeAlert, setActiveAlert] = useState<ActiveDMSAlert | null>(null);
  const [safetyEvents, setSafetyEvents] = useState<SafetyEvent[]>([]);
  const [isDmsActive, setIsDmsActive] = useState<boolean>(() => backgroundDmsService.isDmsActive());
  const [isDmsConnecting, setIsDmsConnecting] = useState<boolean>(() => backgroundDmsService.isDmsConnecting());
  const [cameraError, setCameraError] = useState<string | null>(() => backgroundDmsService.getCameraError());
  const [cameraSource, setCameraSource] = useState<'usb' | 'front'>(() => backgroundDmsService.getCameraSource());
  const [isUsbConnected, setIsUsbConnected] = useState<boolean>(() => backgroundDmsService.isUsbConnected());
  const isSimulatingRef = useRef<any>(null);

  // Sync engine metadata
  useEffect(() => {
    if (options.busId) dmsEngine.busId = options.busId;
    if (options.driverId) dmsEngine.driverId = options.driverId;
    if (options.schoolId) dmsEngine.schoolId = options.schoolId;
    if (options.tripId) dmsEngine.tripId = options.tripId;
  }, [options.busId, options.driverId, options.schoolId, options.tripId]);

  // Subscribe to DMS Engine Safety Events
  useEffect(() => {
    const unsubscribe = dmsEngine.onSafetyEvent(async (event) => {
      setSafetyEvents(prev => [event, ...prev]);
      setActiveAlert(dmsEngine.getStatus().activeAlert);

      // Auto log to tripService if enabled
      if (options.autoLogToService !== false) {
        try {
          if (tripService.recordSafetyEvent) {
            await tripService.recordSafetyEvent(event);
          }
        } catch (err) {
          console.warn('Could not persist DMS safety event:', err);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [options.autoLogToService]);

  // Subscribe to Background DMS Service updates
  useEffect(() => {
    const unsub = backgroundDmsService.subscribe((status) => {
      setDmsStatus(status);
      setActiveAlert(status.activeAlert);
      setIsDmsActive(backgroundDmsService.isDmsActive());
      setIsDmsConnecting(backgroundDmsService.isDmsConnecting());
      setCameraError(backgroundDmsService.getCameraError());
      setCameraSource(backgroundDmsService.getCameraSource());
      setIsUsbConnected(backgroundDmsService.isUsbConnected());
    });

    return () => {
      unsub();
    };
  }, []);

  // Periodic UI status sync
  useEffect(() => {
    const timer = setInterval(() => {
      const status = dmsEngine.getStatus();
      setDmsStatus(status);
      setActiveAlert(status.activeAlert);
      setIsDmsActive(backgroundDmsService.isDmsActive());
      setIsDmsConnecting(backgroundDmsService.isDmsConnecting());
      setCameraError(backgroundDmsService.getCameraError());
      setCameraSource(backgroundDmsService.getCameraSource());
      setIsUsbConnected(backgroundDmsService.isUsbConnected());
    }, 400);

    return () => clearInterval(timer);
  }, []);

  const dismissAlert = useCallback(() => {
    dmsEngine.dismissActiveAlert();
    setActiveAlert(null);
  }, []);

  /**
   * Hardware Ingestion Contract for Native Mobile Camera Modules:
   * Native USB frame grabbers pass landmark coordinates directly to these methods.
   */
  const ingestDriverFaceFrame = useCallback((frame: DriverFaceInput) => {
    if (dmsEngine.scheduler.shouldProcessFrame('driver_camera')) {
      const status = dmsEngine.processDriverFaceFrame(frame);
      setDmsStatus(status);
    }
  }, []);

  const ingestCabinFrame = useCallback((frame: DriverCabinInput) => {
    if (dmsEngine.scheduler.shouldProcessFrame('cabin_camera')) {
      dmsEngine.processCabinFrame(frame);
    }
  }, []);

  /**
   * Interactive Hardware Simulator:
   * Enables complete testing of all DMS rules directly on the device
   * without needing physical USB cables connected during initial dev/test.
   */
  const simulateDmsScenario = useCallback((scenario: 'normal' | 'microsleep' | 'distraction' | 'phone_call' | 'unbuckled') => {
    const now = Date.now();

    switch (scenario) {
      case 'normal':
        dmsEngine.reset();
        ingestDriverFaceFrame({
          leftEyeLandmarks: [{ x: 10, y: 10 }, { x: 12, y: 15 }, { x: 14, y: 15 }, { x: 20, y: 10 }, { x: 14, y: 5 }, { x: 12, y: 5 }],
          rightEyeLandmarks: [{ x: 30, y: 10 }, { x: 32, y: 15 }, { x: 34, y: 15 }, { x: 40, y: 10 }, { x: 34, y: 5 }, { x: 32, y: 5 }],
          mouthLandmarks: { topLip: { x: 25, y: 30 }, bottomLip: { x: 25, y: 35 }, leftCorner: { x: 20, y: 32 }, rightCorner: { x: 30, y: 32 } },
          headPoseLandmarks: { noseTip: { x: 25, y: 20, z: 0 }, chin: { x: 25, y: 40, z: 0 }, leftEye: { x: 15, y: 10, z: 0 }, rightEye: { x: 35, y: 10, z: 0 } },
          timestampMs: now,
        });
        ingestCabinFrame({
          phone: { isDetected: false, nearEar: false, nearLap: false, confidence: 0 },
          hands: { leftHandOnWheel: true, rightHandOnWheel: true },
          seatbelt: { isFastened: true, confidence: 0.95 },
          timestampMs: now,
        });
        break;

      case 'microsleep':
        // Feed closed eyes (EAR < 0.15) for >1.5 seconds
        for (let i = 0; i <= 16; i++) {
          dmsEngine.processDriverFaceFrame({
            leftEyeLandmarks: [{ x: 10, y: 10 }, { x: 12, y: 10.5 }, { x: 14, y: 10.5 }, { x: 20, y: 10 }, { x: 14, y: 9.5 }, { x: 12, y: 9.5 }],
            rightEyeLandmarks: [{ x: 30, y: 10 }, { x: 32, y: 10.5 }, { x: 34, y: 10.5 }, { x: 40, y: 10 }, { x: 34, y: 9.5 }, { x: 32, y: 9.5 }],
            mouthLandmarks: { topLip: { x: 25, y: 30 }, bottomLip: { x: 25, y: 35 }, leftCorner: { x: 20, y: 32 }, rightCorner: { x: 30, y: 32 } },
            headPoseLandmarks: { noseTip: { x: 25, y: 20, z: 0 }, chin: { x: 25, y: 40, z: 0 }, leftEye: { x: 15, y: 10, z: 0 }, rightEye: { x: 35, y: 10, z: 0 } },
            timestampMs: now - (1600 - i * 100),
          });
        }
        break;

      case 'distraction':
        // Head turned 45 degrees to the left for 3.5 seconds
        for (let i = 0; i <= 36; i++) {
          dmsEngine.processDriverFaceFrame({
            leftEyeLandmarks: [{ x: 10, y: 10 }, { x: 12, y: 15 }, { x: 14, y: 15 }, { x: 20, y: 10 }, { x: 14, y: 5 }, { x: 12, y: 5 }],
            rightEyeLandmarks: [{ x: 30, y: 10 }, { x: 32, y: 15 }, { x: 34, y: 15 }, { x: 40, y: 10 }, { x: 34, y: 5 }, { x: 32, y: 5 }],
            mouthLandmarks: { topLip: { x: 25, y: 30 }, bottomLip: { x: 25, y: 35 }, leftCorner: { x: 20, y: 32 }, rightCorner: { x: 30, y: 32 } },
            headPoseLandmarks: { noseTip: { x: 10, y: 20, z: 0 }, chin: { x: 25, y: 40, z: 0 }, leftEye: { x: 15, y: 10, z: 0 }, rightEye: { x: 35, y: 10, z: 0 } },
            timestampMs: now - (3600 - i * 100),
          });
        }
        break;

      case 'phone_call':
        dmsEngine.processCabinFrame({
          phone: { isDetected: true, nearEar: true, nearLap: false, confidence: 0.94 },
          hands: { leftHandOnWheel: true, rightHandOnWheel: false },
          seatbelt: { isFastened: true, confidence: 0.95 },
          timestampMs: now,
        });
        break;

      case 'unbuckled':
        for (let i = 0; i <= 45; i++) {
          dmsEngine.processCabinFrame({
            phone: { isDetected: false, nearEar: false, nearLap: false, confidence: 0 },
            hands: { leftHandOnWheel: true, rightHandOnWheel: true },
            seatbelt: { isFastened: false, confidence: 0.92 },
            timestampMs: now - (4500 - i * 100),
          });
        }
        break;
    }

    setDmsStatus(dmsEngine.getStatus());
    setActiveAlert(dmsEngine.getStatus().activeAlert);
  }, [ingestDriverFaceFrame, ingestCabinFrame]);

  const startBackgroundDms = useCallback(async (source?: 'usb' | 'front') => {
    const res = await backgroundDmsService.start(source);
    setIsDmsActive(backgroundDmsService.isDmsActive());
    return res;
  }, []);

  const stopBackgroundDms = useCallback(async () => {
    const res = await backgroundDmsService.stop();
    setIsDmsActive(backgroundDmsService.isDmsActive());
    return res;
  }, []);

  const toggleBackgroundDms = useCallback(async () => {
    const res = await backgroundDmsService.toggle();
    setIsDmsActive(backgroundDmsService.isDmsActive());
    return res;
  }, []);

  const switchCameraSource = useCallback(async (source: 'usb' | 'front') => {
    await backgroundDmsService.switchSource(source);
    setCameraSource(source);
  }, []);

  const toggleSeatbelt = useCallback(() => {
    const nextVal = dmsEngine.toggleSeatbelt();
    setDmsStatus(dmsEngine.getStatus());
    return nextVal;
  }, []);

  return {
    dmsStatus,
    activeAlert,
    safetyEvents,
    isDmsActive,
    isDmsConnecting,
    cameraError,
    cameraSource,
    isUsbConnected,
    startBackgroundDms,
    stopBackgroundDms,
    toggleBackgroundDms,
    switchCameraSource,
    toggleSeatbelt,
    dismissAlert,
    ingestDriverFaceFrame,
    ingestCabinFrame,
    simulateDmsScenario,
  };
}
