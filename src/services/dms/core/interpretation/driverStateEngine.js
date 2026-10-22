// core/interpretation/driverStateEngine.js

import { createEyeClosureTracker } from "./eyeClosureTracker.js";
import { createYawnTracker } from "./yawnTracker.js";
import { createHeadPoseTracker } from "./headPoseTracker.js";
import { createQualityEvaluator } from "../quality/qualityEvaluator.js";
import { extractHeadPose } from "../vision/headPose.js";
import { extractDriverBlendshapes } from "../vision/blendshapes.js";

export function createDriverStateEngine(options = {}) {
  const eyeTracker = createEyeClosureTracker(options.eye);
  const yawnTracker = createYawnTracker(options.yawn);
  const headPoseTracker = createHeadPoseTracker(options.head);
  const qualityEvaluator = createQualityEvaluator();

  return {
    processFrame({
      pctx,
      canvasWidth,
      canvasHeight,
      faceLandmarks,
      allFaceLandmarks = [],
      faceBlendshapes,
      facialTransformationMatrix,
      phoneState = null,
      timestamp = performance.now(),
    }) {
      // 1. Evaluate Video Quality
      const quality = qualityEvaluator.evaluate({
        pctx,
        canvasWidth,
        canvasHeight,
        landmarks: faceLandmarks,
        allFaces: allFaceLandmarks,
      });

      // 2. Extract Raw Observations
      const blendshapes = extractDriverBlendshapes(faceBlendshapes);
      const rawHeadPose = extractHeadPose(facialTransformationMatrix, faceLandmarks, faceBlendshapes);

      // If video quality is critically poor, return degraded state without hallucinating behavior
      if (quality.shouldBlockAnalysis) {
        return {
          timestamp,
          rawLandmarks: faceLandmarks,
          quality,
          eyes: {
            ...blendshapes,
            continuousClosedMs: 0,
            isMicrosleep: false,
            perclosScore: eyeTracker.getPerclosScore?.() ?? 0,
            isDrowsy: false,
            isSevereFatigue: false,
            blinkCount: eyeTracker.getBlinkCount?.() ?? 0,
          },
          mouth: {
            jawOpen: 0,
            currentYawnDurationMs: 0,
            isYawningNow: false,
            yawnCount: 0,
            recentYawnCount: 0,
            isFrequentYawning: false,
          },
          pose: {
            ...rawHeadPose,
            offForwardDurationMs: 0,
            isDistracted: false,
            isNodding: false,
            nodCount: 0,
            faceCenterX: 0.5,
            lateralOffset: 0,
            shiftDirection: "CENTER",
            shiftDurationMs: 0,
            isShiftedMinor: false,
            isOutOfPosition: false,
          },
          summary: {
            status: "DEGRADED_FEED",
            alertLevel: "WARNING",
            primaryReason: quality.blockingIssues[0] || "Quality below operational threshold",
          },
          phone: phoneState || {
            hasPhoneCandidate: false,
            isConfirmed: false,
            isHandAssociated: false,
            state: "IDLE",
            activeDurationMs: 0,
            candidate: null,
            handRelationship: null,
          },
        };
      }

      // 3. Temporal Interpretation
      const faceCenterX = quality.metrics?.faceCenter?.x ?? 0.5;
      const eyeState = eyeTracker.update(blendshapes, timestamp);
      const mouthState = yawnTracker.update(blendshapes, timestamp);
      const poseState = headPoseTracker.update(rawHeadPose, timestamp, faceCenterX, blendshapes);

      // 4. Overall Driver Status Classification
      let status = "ALERT";
      let alertLevel = "NORMAL";
      let primaryReason = "Driver attentive";

      if (eyeState.isMicrosleep) {
        status = "MICROSLEEP";
        alertLevel = "CRITICAL";
        primaryReason = `Prolonged eye closure: ${(eyeState.continuousClosedMs / 1000).toFixed(1)}s`;
      } else if (phoneState?.isConfirmed && (phoneState.mode === "CALLING" || phoneState?.isHandAssociated)) {
        if (phoneState.mode === "CALLING") {
          status = "PHONE_CALL";
          alertLevel = "CRITICAL";
          primaryReason = `Driver holding phone to ear (Phone Call: ${(phoneState.activeDurationMs / 1000).toFixed(1)}s)`;
        } else if (phoneState.mode === "TEXTING" || (poseState.pitch < -5.0 && phoneState.candidate?.box?.originY > (quality.metrics?.faceCenter?.y ?? 0.4) * canvasHeight)) {
          status = "PHONE_TEXTING";
          alertLevel = "CRITICAL";
          primaryReason = `Driver looking down at phone (Texting/Browsing: ${(phoneState.activeDurationMs / 1000).toFixed(1)}s)`;
        } else {
          status = "PHONE_DISTRACTION";
          alertLevel = "CRITICAL";
          primaryReason = `Driver using mobile phone in hand for ${(phoneState.activeDurationMs / 1000).toFixed(1)}s`;
        }
      } else if (poseState.isDistracted) {
        status = "DISTRACTED";
        alertLevel = "WARNING";
        primaryReason = poseState.direction.startsWith("GAZE_")
          ? `Gaze deflected ${poseState.direction.replace("GAZE_", "")} (eyes off road) for ${(poseState.offForwardDurationMs / 1000).toFixed(1)}s`
          : `Head turned ${poseState.direction} for ${(poseState.offForwardDurationMs / 1000).toFixed(1)}s`;
      } else if (poseState.isOutOfPosition) {
        status = "OUT_OF_POSITION";
        alertLevel = "WARNING";
        primaryReason = `Driver shifted ${poseState.shiftDirection} for ${(poseState.shiftDurationMs / 1000).toFixed(1)}s`;
      } else if (eyeState.isSevereFatigue || eyeState.isDrowsy) {
        status = "DROWSY";
        alertLevel = eyeState.isSevereFatigue ? "CRITICAL" : "WARNING";
        primaryReason = `High PERCLOS eye closure (${eyeState.perclosScore}%)`;
      } else if (mouthState.isYawningNow || mouthState.isFrequentYawning) {
        status = "FATIGUE";
        alertLevel = "WARNING";
        primaryReason = mouthState.isYawningNow ? "Active yawning detected" : "Frequent yawning detected";
      } else if (poseState.isNodding) {
        status = "DROWSY";
        alertLevel = "WARNING";
        primaryReason = "Head nodding / jerking detected";
      }

      return {
        timestamp,
        rawLandmarks: faceLandmarks,
        quality,
        eyes: { ...blendshapes, ...eyeState },
        mouth: mouthState,
        pose: poseState,
        phone: phoneState || {
          hasPhoneCandidate: false,
          isConfirmed: false,
          isHandAssociated: false,
          state: "IDLE",
          activeDurationMs: 0,
          candidate: null,
          handRelationship: null,
        },
        summary: {
          status,
          alertLevel,
          primaryReason,
        },
      };
    },
    reset() {
      eyeTracker.reset();
      yawnTracker.reset();
      headPoseTracker.reset();
      qualityEvaluator.reset();
    },
  };
}
