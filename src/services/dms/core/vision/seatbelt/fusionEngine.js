// core/vision/seatbelt/fusionEngine.js

import { evaluateTransectMethod } from "./transectMethod.js";
import { evaluateEdgeHoughMethod } from "./edgeHoughMethod.js";
import { evaluateContrastMethod } from "./contrastMethod.js";

/**
 * Method D: Hybrid Multi-Method Fusion Engine.
 *
 * Combines Transect Corridor Probing (Method A), Torso ROI Edge/Hough (Method B),
 * and Color/Texture Contrast (Method C) with pose visibility confidence.
 *
 * @param {ImageData} imageData
 * @param {Object} torsoGeometry
 * @param {Object} options
 * @returns {Object} Fusion results for active or auto-selected side
 */
export function evaluateHybridFusion(imageData, torsoGeometry, options = {}) {
  const {
    selectedSide = "AUTO",
    weights = { transect: 0.50, edgeHough: 0.25, contrast: 0.25 },
    minFusionThreshold = 0.42,
  } = options;

  if (!torsoGeometry) {
    return {
      confidence: 0,
      isFastened: false,
      status: "NO_TORSO_DETECTED",
      dominantSide: null,
      breakdown: null,
    };
  }

  const evaluateSide = (path) => {
    const resA = evaluateTransectMethod(imageData, path, {
      ...options.transectOptions,
      torso: torsoGeometry,
    });
    const resB = evaluateEdgeHoughMethod(imageData, torsoGeometry.torsoRoi, path, options.edgeOptions);
    const resC = evaluateContrastMethod(imageData, path, {
      ...options.contrastOptions,
      observedPath: resA?.observedStrapLine || null,
      flankOffsetPx: Math.max(48, Math.round(torsoGeometry.shoulderDist * 0.26)),
    });

    let rawFused =
      resA.confidence * weights.transect +
      resB.confidence * weights.edgeHough +
      resC.confidence * weights.contrast;

    // PRIMARY CORRIDOR GATING:
    // A physical seatbelt ribbon MUST be confirmed by Method A's transect probes inside the corridor.
    // If Method A detects no corridor ribbon and has low confidence (< 0.28),
    // any signal in Method B or C is clothing folds, logos, or background clutter.
    const hasGeometricRibbon =
      (resA.hasCorridorDetection && resA.confidence >= 0.22) ||
      (resA.confidence >= 0.22 && resB.confidence >= 0.30 && resB.evidenceType === "DUAL_PARALLEL_BAND") ||
      (resA.matchedTransects >= 3 && resA.confidence >= 0.20 && (resB.confidence >= 0.25 || resC.confidence >= 0.28)) ||
      (resB.confidence >= 0.35 && resB.evidenceType === "DUAL_PARALLEL_BAND" && resC.confidence >= 0.32);

    let finalConfidence = rawFused;
    if (!hasGeometricRibbon) {
      finalConfidence = Math.min(0.12, rawFused * 0.18);
    } else if (resA.confidence >= 0.35 && (resB.confidence >= 0.35 || resC.confidence >= 0.35)) {
      finalConfidence = Math.min(1.0, rawFused * 1.10);
    }

    const isFastened = hasGeometricRibbon && finalConfidence >= minFusionThreshold;

    return {
      path,
      fusedConfidence: Math.round(finalConfidence * 100) / 100,
      isFastened,
      methodA: resA,
      methodB: resB,
      methodC: resC,
    };
  };

  let chosenEval = null;

  if (selectedSide === "RHD") {
    chosenEval = evaluateSide(torsoGeometry.pathRHD);
  } else if (selectedSide === "LHD") {
    chosenEval = evaluateSide(torsoGeometry.pathLHD);
  } else {
    // AUTO: Evaluate both RHD and LHD diagonals
    const evalRHD = evaluateSide(torsoGeometry.pathRHD);
    const evalLHD = evaluateSide(torsoGeometry.pathLHD);

    // Standard Kashmiri/Indian buses are physically RHD
    if (evalLHD.fusedConfidence >= 0.35 && evalLHD.fusedConfidence > evalRHD.fusedConfidence + 0.12) {
      chosenEval = evalLHD;
      chosenEval.competingSide = evalRHD;
    } else {
      chosenEval = evalRHD;
      chosenEval.competingSide = evalLHD;
    }
  }

  return {
    methodId: "fusion",
    methodName: "Method D: Hybrid Fusion Engine (Ensemble)",
    confidence: chosenEval.fusedConfidence,
    isFastened: chosenEval.isFastened,
    activePath: chosenEval.path,
    dominantSide: chosenEval.path.side,
    breakdown: {
      transectConfidence: chosenEval.methodA.confidence,
      edgeHoughConfidence: chosenEval.methodB.confidence,
      contrastConfidence: chosenEval.methodC.confidence,
      weights,
    },
    methodA: chosenEval.methodA,
    methodB: chosenEval.methodB,
    methodC: chosenEval.methodC,
  };
}
