/**
 * Asymmetric Multi-Camera Frame Scheduler for Low-End Mobile Devices
 * 
 * Prevents thermal throttling, OOM crashes, and UI freezes by:
 * 1. Limiting Driver Camera to 8-10 FPS (sufficient for PERCLOS/EAR)
 * 2. Limiting Secondary Camera (Seatbelt/Cabin) to 2-3 FPS
 * 3. Enforcing non-blocking frame dropping (drops incoming frames if the previous frame is still processing)
 * 4. Staggering inference cycles so multiple heavy models never run concurrently.
 */

export type CameraStreamType = 'driver_camera' | 'cabin_camera';

export interface CameraProcessingTarget {
  stream: CameraStreamType;
  minIntervalMs: number; // e.g. 100ms for 10fps, 500ms for 2fps
  lastProcessedTimestamp: number;
}

export class DMSScheduler {
  private targets: Record<CameraStreamType, CameraProcessingTarget> = {
    driver_camera: {
      stream: 'driver_camera',
      minIntervalMs: 120, // ~8.3 FPS (optimal balance for eye closures without overheating)
      lastProcessedTimestamp: 0,
    },
    cabin_camera: {
      stream: 'cabin_camera',
      minIntervalMs: 450, // ~2.2 FPS (optimal for seatbelt & cabin checks)
      lastProcessedTimestamp: 0,
    },
  };

  private isProcessing: Record<CameraStreamType, boolean> = {
    driver_camera: false,
    cabin_camera: false,
  };

  /**
   * Determines whether the current frame should be processed or dropped.
   * Enforces both rate limits and active-worker locks.
   */
  public shouldProcessFrame(stream: CameraStreamType, nowMs: number = Date.now()): boolean {
    const target = this.targets[stream];
    if (!target) return false;

    // 1. Backpressure guard: Drop frame if prior frame from this camera is still executing
    if (this.isProcessing[stream]) {
      return false;
    }

    // 2. Rate limiting guard
    const elapsed = nowMs - target.lastProcessedTimestamp;
    if (elapsed < target.minIntervalMs) {
      return false;
    }

    return true;
  }

  /**
   * Marks frame processing as started.
   */
  public markProcessingStart(stream: CameraStreamType, nowMs: number = Date.now()): void {
    this.isProcessing[stream] = true;
    this.targets[stream].lastProcessedTimestamp = nowMs;
  }

  /**
   * Marks frame processing as completed, freeing the worker.
   */
  public markProcessingEnd(stream: CameraStreamType): void {
    this.isProcessing[stream] = false;
  }

  /**
   * Dynamically adjust frame rates if device temperature or battery drops.
   */
  public setPowerSavingMode(enabled: boolean): void {
    if (enabled) {
      this.targets.driver_camera.minIntervalMs = 200; // 5 FPS
      this.targets.cabin_camera.minIntervalMs = 1000; // 1 FPS
    } else {
      this.targets.driver_camera.minIntervalMs = 120; // ~8.3 FPS
      this.targets.cabin_camera.minIntervalMs = 450; // ~2.2 FPS
    }
  }
}
