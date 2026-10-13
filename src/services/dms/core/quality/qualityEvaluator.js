// core/quality/qualityEvaluator.js

import { blurCheck } from "./check/blurcheck.js";
import { checkBrightness } from "./check/brightnesscheck.js";
import { facedistancecheck } from "./check/facedistancecheck.js";
import { checkFacePosition } from "./check/facepositioncheck.js";
import { missingFaceCheck } from "./check/missingFaceCheck.js";
import { multiFaceCheck } from "./check/multiFaceCheck.js";
import { occlusionCheck } from "./check/occlusionCheck.js";
import { unevenLightingCheck } from "./check/unevenlightingcheck.js";

import { getfacebox } from "./detection/getFacebox.js";
import { getFaceArea } from "./detection/getFaceArea.js";
import { getFaceCenter } from "./detection/getFaceCenter.js";
import { getCheekBrightness } from "./detection/getCheekBrightness.js";
import { getBlurScore } from "./detection/getBlurScore.js";
import { getFaceBrightness } from "./detection/getFaceBrightness.js";
import { getMultiFaceMetrics } from "./detection/getMultiFaceMetrics.js";
import { getOcclusionMetrics } from "./detection/getOcclusionMetrics.js";
import { videoQualityEngine } from "./videoQualityEngine.js";

export function createQualityEvaluator() {
  const refs = {
    brightnessRef: { current: null },
    lightingRef: { current: null },
    blurRef: { current: null },
    faceDistRef: { current: null },
    facePostRef: { current: null },
    missingFaceRef: { current: null },
    multiFaceRef: { current: null },
    occlusionRef: { current: null },
    prevFaceArea: null,
  };

  return {
    evaluate({ pctx, canvasWidth, canvasHeight, landmarks, allFaces = [] }) {
      const faceDetected = Boolean(landmarks && landmarks.length > 0);

      // 1. Missing Face
      const missingFaceResult = missingFaceCheck(refs.missingFaceRef, {
        personDetected: faceDetected,
      });

      if (!faceDetected) {
        return {
          overallQualityScore: 0,
          overallSeverity: "poor",
          shouldBlockAnalysis: true,
          warnings: ["No face detected"],
          blockingIssues: ["Driver face not visible"],
          activePopup: {
            title: "Driver Face Missing",
            message: "Driver face is not detected in front of the camera.",
            suggestion: "Position the phone so the driver's face is clearly visible.",
          },
          missingFace: missingFaceResult,
          metrics: null,
        };
      }

      // 2. Face Box & Area
      const faceBox = getfacebox(landmarks, canvasWidth, canvasHeight);
      const { minX, maxX, minY, maxY, x1, y1, faceWidth, faceHeight } = faceBox;
      const { FaceArea } = getFaceArea(minX, maxX, minY, maxY);
      const faceBoxWithArea = { ...faceBox, FaceArea };

      // 3. Brightness & Lighting
      let faceBrightnessVal = 100;
      let cheekMetrics = { leftBrightness: 100, rightBrightness: 100, lightingDifferencePercent: 0 };
      if (pctx) {
        try {
          faceBrightnessVal = getFaceBrightness(pctx, x1, y1, faceWidth, faceHeight);
          cheekMetrics = getCheekBrightness(pctx, landmarks, canvasWidth, canvasHeight);
        } catch {
          // Fallback if context read fails
        }
      }

      const brightnessResult = checkBrightness(faceBrightnessVal, refs.brightnessRef);
      const lightingResult = unevenLightingCheck(cheekMetrics, refs.lightingRef);

      // 4. Blur Score
      let blurScore = 300;
      if (pctx) {
        try {
          blurScore = getBlurScore(pctx, x1, y1, faceWidth, faceHeight);
        } catch {
          blurScore = 300;
        }
      }
      const blurResult = blurCheck(blurScore, refs.blurRef);

      // 5. Distance & Position
      const distanceResult = facedistancecheck(FaceArea, refs.faceDistRef);
      const { faceCenterX, faceCenterY } = getFaceCenter(minX, maxX, minY, maxY);
      const positionResult = checkFacePosition(faceCenterX, faceCenterY, refs.facePostRef);

      // 6. Multi-face
      const multiFaceMetrics = getMultiFaceMetrics(allFaces);
      const multiFaceResult = multiFaceCheck(multiFaceMetrics, refs.multiFaceRef);

      // 7. Occlusion
      const occlusionMetrics = getOcclusionMetrics({
        landmarks,
        hands: null,
        faceBox: faceBoxWithArea,
        prevFaceArea: refs.prevFaceArea,
      });
      refs.prevFaceArea = FaceArea;
      const occlusionResult = occlusionCheck(occlusionMetrics, refs.occlusionRef);

      // 8. Video Quality Engine
      const quality = videoQualityEngine({
        lightingSeverity: lightingResult.lightingSeverity,
        lightingQualityScore: lightingResult.lightingQualityScore,
        brightnessSeverity: brightnessResult.brightnessSeverity,
        brightnessQualityScore: brightnessResult.brightnessQualityScore,
        occlusionSeverity: occlusionResult.occlusionSeverity,
        occlusionQualityScore: occlusionResult.occlusionQualityScore,
        occlusionType: occlusionResult.occlusionType,
        showFaceDistancePopup: distanceResult.showFaceDistancePopup,
        faceDistanceType: distanceResult.faceDistanceType,
        showMultiFacePopup: multiFaceResult.showMultiFacePopup,
        blurSeverity: blurResult.blurSeverity,
        blurQualityScore: blurResult.blurQualityScore,
      });

      return {
        ...quality,
        metrics: {
          brightness: faceBrightnessVal,
          blurScore,
          lightingDiffPercent: cheekMetrics.lightingDifferencePercent,
          faceArea: FaceArea,
          faceCenter: { x: faceCenterX, y: faceCenterY },
          occlusionType: occlusionResult.occlusionType,
          faceDistanceType: distanceResult.faceDistanceType,
        },
      };
    },
    reset() {
      refs.brightnessRef.current = null;
      refs.lightingRef.current = null;
      refs.blurRef.current = null;
      refs.faceDistRef.current = null;
      refs.facePostRef.current = null;
      refs.missingFaceRef.current = null;
      refs.multiFaceRef.current = null;
      refs.occlusionRef.current = null;
      refs.prevFaceArea = null;
    },
  };
}
