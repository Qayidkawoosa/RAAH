// core/vision/seatbelt/seatbeltDetectorEngine.js

import { extractTorsoGeometry } from "./torsoGeometry.js";
import { evaluateHybridFusion } from "./fusionEngine.js";
import { SeatbeltTemporalTracker, SEATBELT_TEMPORAL_STATE } from "./seatbeltTracker.js";
import { applyCLAHETorsoROI } from "./clahePreprocessor.js";

/**
 * Creates an instance of the Seatbelt Detection Engine for production driver monitoring.
 *
 * Encapsulates landmark jitter smoothing, torso geometry extraction, hybrid ensemble evaluation,
 * and automotive Schmitt-trigger temporal state tracking.
 *
 * @param {Object} [options]
 * @param {string} [options.selectedSide="AUTO"] - "AUTO", "RHD", or "LHD"
 * @param {number} [options.confidenceThreshold=0.42]
 * @param {number} [options.retentionThreshold=0.22]
 * @param {number} [options.confirmationWindowMs=750]
 * @param {number} [options.unfastenDelayMs=1500]
 * @param {boolean} [options.enableCLAHE=true] - Apply CLAHE local contrast enhancement to torso ROI
 * @param {number} [options.claheClipLimit=3.5] - CLAHE contrast clip limit
 * @param {number} [options.claheTileSize=32] - CLAHE tile size in pixels
 * @returns {Object} Engine instance with processFrame and reset methods
 */
export function createSeatbeltDetectorEngine(options = {}) {
  const {
    selectedSide = "AUTO",
    confidenceThreshold = 0.42,
    retentionThreshold = 0.22,
    confirmationWindowMs = 750,
    unfastenDelayMs = 1500,
    enableCLAHE = true,
    claheClipLimit = 3.5,
    claheTileSize = 32,
  } = options;

  let smoothedLandmarks = null;
  const tracker = new SeatbeltTemporalTracker({
    confirmationWindowMs,
    unfastenDelayMs,
    retentionThreshold,
  });

  /**
   * Evaluates a camera frame for seatbelt compliance.
   *
   * @param {Object} params
   * @param {ImageData} params.imageData - Frame RGB buffer
   * @param {Array} params.poseLandmarks - Raw MediaPipe 33-point pose landmarks (unmirrored or mirrored)
   * @param {number} params.frameWidth - Image width in px
   * @param {number} params.frameHeight - Image height in px
   * @param {number} [params.timestamp=performance.now()]
   * @returns {Object}
   */
  function processFrame({ imageData, poseLandmarks, frameWidth, frameHeight, timestamp = performance.now() }) {
    if (!poseLandmarks || poseLandmarks.length < 25) {
      smoothedLandmarks = null;
      const telemetry = tracker.update(false, false, 0, timestamp);
      return {
        isDriverPresent: false,
        isFastened: false,
        state: SEATBELT_TEMPORAL_STATE.NO_DRIVER,
        confidence: 0,
        smoothedConfidence: 0,
        durationFastenedSec: telemetry.totalFastenedTimeSec,
        dominantSide: selectedSide === "AUTO" ? "RHD" : selectedSide,
        strapLine: null,
        torsoRoi: null,
        progress: 0,
      };
    }

    // Mirror horizontally so landmarks align with driver perspective
    const rawMirrored = poseLandmarks.map((pt) => ({
      ...pt,
      x: 1 - pt.x,
    }));

    // Exponential Moving Average smoothing on torso joints to eliminate flutter during movement
    if (!smoothedLandmarks || smoothedLandmarks.length !== rawMirrored.length) {
      smoothedLandmarks = rawMirrored.map((pt) => ({ ...pt }));
    } else {
      const alpha = 0.55;
      for (let i = 0; i < rawMirrored.length; i++) {
        smoothedLandmarks[i].x = alpha * rawMirrored[i].x + (1 - alpha) * smoothedLandmarks[i].x;
        smoothedLandmarks[i].y = alpha * rawMirrored[i].y + (1 - alpha) * smoothedLandmarks[i].y;
        smoothedLandmarks[i].z = rawMirrored[i].z;
        smoothedLandmarks[i].visibility = rawMirrored[i].visibility;
      }
    }

    const torso = extractTorsoGeometry(
      smoothedLandmarks,
      frameWidth,
      frameHeight,
      selectedSide
    );

    if (!torso || !imageData) {
      const telemetry = tracker.update(true, false, 0, timestamp);
      return {
        isDriverPresent: true,
        isFastened: false,
        state: telemetry.state,
        confidence: 0,
        smoothedConfidence: telemetry.smoothedConfidence,
        durationFastenedSec: telemetry.totalFastenedTimeSec,
        dominantSide: selectedSide === "AUTO" ? "RHD" : selectedSide,
        strapLine: null,
        torsoRoi: null,
        progress: telemetry.progress,
      };
    }

    // Dynamic torso dimensions based on actual driver scale in frame
    const shoulderDist = torso.shoulderDist;
    const probeLength = Math.max(160, Math.round(shoulderDist * 1.15));
    const corridorWidth = Math.max(125, Math.round(shoulderDist * 0.75));
    const transectOpts = {
      numTransects: 12,
      probeLength,
      corridorWidth,
      torso,
      relativeEdgeThreshold: 0.10,
    };

    // Apply CLAHE to boost local contrast in dark torso region without blowing out highlights
    const enhancedImageData = enableCLAHE && torso.torsoRoi
      ? applyCLAHETorsoROI(imageData, torso.torsoRoi, {
          tileSize: claheTileSize,
          clipLimit: claheClipLimit,
          returnCopy: true,
        })
      : imageData;

    const fusionResult = evaluateHybridFusion(enhancedImageData, torso, {
      selectedSide,
      minFusionThreshold: confidenceThreshold,
      transectOptions: transectOpts,
    });

    const isFrameFastened = fusionResult.isFastened;
    const telemetry = tracker.update(true, isFrameFastened, fusionResult.confidence, timestamp);

    const isConfirmedFastened = telemetry.state === SEATBELT_TEMPORAL_STATE.CONFIRMED_FASTENED;
    const isFastening = telemetry.state === SEATBELT_TEMPORAL_STATE.FASTENING;
    const effectiveIsFastened = isConfirmedFastened;

    // Active visual strap line (uses dynamically observed belt line when confirmed fastened, or target torso trajectory on starting)
    const activePath = fusionResult.activePath || (selectedSide === "LHD" ? torso.pathLHD : torso.pathRHD);
    const strapLine = (isConfirmedFastened && fusionResult.methodA?.observedStrapLine)
      ? fusionResult.methodA.observedStrapLine
      : activePath;

    return {
      isDriverPresent: true,
      isFastened: isConfirmedFastened,
      effectiveFastened: effectiveIsFastened,
      state: telemetry.state,
      confidence: fusionResult.confidence,
      smoothedConfidence: telemetry.smoothedConfidence,
      durationFastenedSec: telemetry.totalFastenedTimeSec,
      dominantSide: fusionResult.dominantSide,
      strapLine,
      targetPath: activePath,
      torsoRoi: torso.torsoRoi,
      progress: telemetry.progress,
      telemetry,
    };
  }

  function reset() {
    smoothedLandmarks = null;
    tracker.reset();
  }

  return {
    processFrame,
    reset,
    SEATBELT_TEMPORAL_STATE,
  };
}

export { SEATBELT_TEMPORAL_STATE };
