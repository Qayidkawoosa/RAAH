// core/interpretation/headPoseTracker.js

import { TimeBuffer } from "./timeBuffer.js";

export function createHeadPoseTracker(options = {}) {
  const {
    distractionThresholdMs = 3000, // 3.0s off-forward = distraction
    gazeDisplayThresholdMs = 800,   // 800ms sustained gaze before displaying off-road gaze direction
    minorShiftThresholdMs = 1500,  // 1.5s = minor posture lean
    outOfPositionThresholdMs = 5000, // 5.0s = prolonged out-of-position
    corridorMinX = 0.35,
    corridorMaxX = 0.65,
  } = options;

  let offForwardStartTime = null;
  let offForwardDurationMs = 0;
  let nodCount = 0;
  let lastNodTimestamp = 0;

  let shiftStartTime = null;
  let shiftDurationMs = 0;
  let currentShiftDirection = "CENTER";

  // Sustained gaze timer & gap bridging (filters out micro-glances and saccades)
  let gazeStartTime = null;
  let gazeDurationMs = 0;
  let activeGazeDirection = "FORWARD";
  let lastGazeActiveTimestamp = 0;

  const pitchHistory = new TimeBuffer(2500); // 2.5s window for nod detection

  return {
    update(headPose, timestamp = performance.now(), explicitFaceCenterX = null, blendshapes = null) {
      const { yaw, pitch, roll, isLookingAway: isHeadLookingAway, direction: headDirection } = headPose;
      const faceCenterX = explicitFaceCenterX !== null ? explicitFaceCenterX : (headPose.faceCenterX ?? 0.5);

      const isGazeCandidate = Boolean(blendshapes?.isGazeAway);
      const rawGazeDirection = blendshapes?.gazeDirection ?? "FORWARD";

      // 1. Sustained Gaze Tracking with Onset Timer & Blink Bridge
      // Minor glances (< 800ms) to mirrors/speedometer or brief saccades stay FORWARD.
      if (isGazeCandidate && !isHeadLookingAway) {
        lastGazeActiveTimestamp = timestamp;
        if (!gazeStartTime || activeGazeDirection !== rawGazeDirection) {
          gazeStartTime = timestamp;
          activeGazeDirection = rawGazeDirection;
        }
        gazeDurationMs = Math.round(timestamp - gazeStartTime);
      } else {
        // 200ms bridge for blinks or single-frame drops during sustained gaze
        if (timestamp - lastGazeActiveTimestamp > 200) {
          gazeStartTime = null;
          gazeDurationMs = 0;
          activeGazeDirection = "FORWARD";
        }
      }

      const isSustainedGazeAway = gazeDurationMs >= gazeDisplayThresholdMs;

      // Look away is triggered if head is turned away OR sustained off-road gaze is held
      const isLookingAway = isHeadLookingAway || isSustainedGazeAway;

      let direction = headDirection;
      if (!isHeadLookingAway && isSustainedGazeAway) {
        direction = `GAZE_${activeGazeDirection}`;
      }

      // Track total continuous off-forward duration (head or sustained gaze)
      if (isLookingAway) {
        if (!offForwardStartTime) {
          offForwardStartTime = timestamp;
        }
        offForwardDurationMs = Math.round(timestamp - offForwardStartTime);
      } else {
        offForwardStartTime = null;
        offForwardDurationMs = 0;
      }

      const isDistracted = offForwardDurationMs >= distractionThresholdMs;

      // 2. Lateral Head / Body Movement (Position from Center Corridor)
      // Normalized lateral offset: -1.0 (far left) to +1.0 (far right)
      const lateralOffset = Number(((faceCenterX - 0.5) * 2).toFixed(2));
      let isShifted = false;
      let shiftDirection = "CENTER";

      if (faceCenterX < corridorMinX) {
        isShifted = true;
        shiftDirection = "LEFT";
      } else if (faceCenterX > corridorMaxX) {
        isShifted = true;
        shiftDirection = "RIGHT";
      }

      if (isShifted) {
        if (!shiftStartTime || currentShiftDirection !== shiftDirection) {
          shiftStartTime = timestamp;
          currentShiftDirection = shiftDirection;
        }
        shiftDurationMs = Math.round(timestamp - shiftStartTime);
      } else {
        shiftStartTime = null;
        shiftDurationMs = 0;
        currentShiftDirection = "CENTER";
      }

      // Tier 1: Minor Shift (1.5s to 5.0s - treated as normal/minor posture movement)
      const isShiftedMinor = isShifted && shiftDurationMs >= minorShiftThresholdMs && shiftDurationMs < outOfPositionThresholdMs;
      // Tier 2: Prolonged Out-of-Position (>= 5.0s)
      const isOutOfPosition = isShifted && shiftDurationMs >= outOfPositionThresholdMs;

      // 3. Head Nodding Detection (Drowsiness Dip & Jerk)
      pitchHistory.push(pitch, timestamp);
      const samples = pitchHistory.getSamples();
      let isNodding = false;

      if (samples.length >= 10 && timestamp - lastNodTimestamp > 3000) {
        const minPitch = Math.min(...samples.map((s) => s.v));
        const latestPitch = samples[samples.length - 1].v;
        // If head was tilted down significantly and quickly jerked up
        if (minPitch < -18 && latestPitch > -5 && (latestPitch - minPitch) >= 14) {
          isNodding = true;
          nodCount++;
          lastNodTimestamp = timestamp;
          pitchHistory.clear();
        }
      }

      return {
        yaw,
        pitch,
        roll,
        direction,
        offForwardDurationMs,
        isDistracted,
        isNodding,
        nodCount,
        // Lateral Position Metrics
        faceCenterX,
        lateralOffset,
        shiftDirection: currentShiftDirection,
        shiftDurationMs,
        isShiftedMinor,
        isOutOfPosition,
      };
    },
    reset() {
      offForwardStartTime = null;
      offForwardDurationMs = 0;
      shiftStartTime = null;
      shiftDurationMs = 0;
      currentShiftDirection = "CENTER";
      gazeStartTime = null;
      gazeDurationMs = 0;
      activeGazeDirection = "FORWARD";
      lastGazeActiveTimestamp = 0;
      nodCount = 0;
      lastNodTimestamp = 0;
      pitchHistory.clear();
    },
  };
}
