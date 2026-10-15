// core/events/safetyEventEngine.js

import { SAFETY_EVENT_TYPES, EVENT_SEVERITY } from "./safetyEventTypes.js";

export function createSafetyEventEngine(options = {}) {
  const {
    cooldownMs = 4000, // Cooldown before repeating the same event type
    onEvent = null,
  } = options;

  const eventHistory = [];
  const lastEmittedTimes = {};
  let eventCounter = 1;

  function shouldEmit(eventType, now) {
    const last = lastEmittedTimes[eventType] || 0;
    return now - last >= cooldownMs;
  }

  function emitEvent(eventDef, message, durationMs, metadata, now) {
    lastEmittedTimes[eventDef.type] = now;

    const event = {
      eventId: `evt_${Date.now()}_${eventCounter++}`,
      eventType: eventDef.type,
      timestamp: Date.now(),
      severity: eventDef.severity,
      title: eventDef.title,
      message,
      durationMs,
      confidence: metadata.confidence || 0.9,
      metadata,
    };

    eventHistory.unshift(event);
    if (eventHistory.length > 200) {
      eventHistory.pop();
    }

    if (typeof onEvent === "function") {
      onEvent(event);
    }

    return event;
  }

  return {
    evaluate(driverState, tripContext = {}) {
      const now = performance.now();
      const newEvents = [];

      const { quality, eyes, mouth, pose, phone } = driverState;

      // 1. Check Quality / Camera Obstruction
      if (quality.shouldBlockAnalysis && shouldEmit(SAFETY_EVENT_TYPES.CAMERA_OBSTRUCTED.type, now)) {
        if (quality.blockingIssues.some((issue) => issue.toLowerCase().includes("occlu") || issue.toLowerCase().includes("hand"))) {
          const ev = emitEvent(
            SAFETY_EVENT_TYPES.CAMERA_OBSTRUCTED,
            "Camera feed or driver face is obstructed",
            0,
            { blockingIssues: quality.blockingIssues, ...tripContext },
            now
          );
          newEvents.push(ev);
        }
      }

      // 2. Check Microsleep (CRITICAL)
      if (eyes.isMicrosleep && shouldEmit(SAFETY_EVENT_TYPES.MICROSLEEP_DETECTED.type, now)) {
        const ev = emitEvent(
          SAFETY_EVENT_TYPES.MICROSLEEP_DETECTED,
          `Driver eyes closed for ${(eyes.continuousClosedMs / 1000).toFixed(1)}s`,
          eyes.continuousClosedMs,
          {
            eyeBlinkAvg: eyes.eyeBlinkAvg,
            perclos: eyes.perclosScore,
            yaw: pose.yaw,
            pitch: pose.pitch,
            ...tripContext,
          },
          now
        );
        newEvents.push(ev);
      }

      // 3. Check Distraction (WARNING)
      if (pose.isDistracted && shouldEmit(SAFETY_EVENT_TYPES.DRIVER_DISTRACTION.type, now)) {
        const distractionMsg = pose.direction.startsWith("GAZE_")
          ? `Driver gaze deflected ${pose.direction.replace("GAZE_", "")} (eyes off road) for ${(pose.offForwardDurationMs / 1000).toFixed(1)}s`
          : `Head turned ${pose.direction} for ${(pose.offForwardDurationMs / 1000).toFixed(1)}s`;

        const ev = emitEvent(
          SAFETY_EVENT_TYPES.DRIVER_DISTRACTION,
          distractionMsg,
          pose.offForwardDurationMs,
          {
            direction: pose.direction,
            yaw: pose.yaw,
            pitch: pose.pitch,
            ...tripContext,
          },
          now
        );
        newEvents.push(ev);
      }

      // 3b. Check Out of Position (WARNING - sustained shift >= 5s)
      if (pose.isOutOfPosition && shouldEmit(SAFETY_EVENT_TYPES.DRIVER_OUT_OF_POSITION.type, now)) {
        const ev = emitEvent(
          SAFETY_EVENT_TYPES.DRIVER_OUT_OF_POSITION,
          `Driver shifted ${pose.shiftDirection} of center for ${(pose.shiftDurationMs / 1000).toFixed(1)}s`,
          pose.shiftDurationMs,
          {
            shiftDirection: pose.shiftDirection,
            lateralOffset: pose.lateralOffset,
            faceCenterX: pose.faceCenterX,
            yaw: pose.yaw,
            pitch: pose.pitch,
            ...tripContext,
          },
          now
        );
        newEvents.push(ev);
      }

      // 4. Check Fatigue / Yawning / High PERCLOS (WARNING / CRITICAL)
      if ((mouth.isYawningNow || eyes.isSevereFatigue || eyes.isDrowsy) && shouldEmit(SAFETY_EVENT_TYPES.FATIGUE_INDICATOR.type, now)) {
        let reason = "Drowsiness indicators observed";
        let duration = 0;
        let severity = EVENT_SEVERITY.WARNING;

        if (mouth.isYawningNow) {
          reason = `Prolonged yawn for ${(mouth.currentYawnDurationMs / 1000).toFixed(1)}s`;
          duration = mouth.currentYawnDurationMs;
        } else if (eyes.isSevereFatigue) {
          reason = `Critical drowsiness: PERCLOS ${eyes.perclosScore}%`;
          severity = EVENT_SEVERITY.CRITICAL;
        } else if (eyes.isDrowsy) {
          reason = `Moderate drowsiness: PERCLOS ${eyes.perclosScore}%`;
        }

        const ev = emitEvent(
          { ...SAFETY_EVENT_TYPES.FATIGUE_INDICATOR, severity },
          reason,
          duration,
          {
            perclos: eyes.perclosScore,
            yawnCount: mouth.yawnCount,
            jawOpen: mouth.jawOpen,
            ...tripContext,
          },
          now
        );
        newEvents.push(ev);
      }

      // 5. Check Phone Use Distraction (CRITICAL) - Distinct Calling vs Texting vs Holding
      if (phone?.isConfirmed && (phone.mode === "CALLING" || phone?.isHandAssociated)) {
        let eventTypeObj = SAFETY_EVENT_TYPES.PHONE_USE_DETECTED;
        let eventMsg = `Driver actively holding mobile phone for ${(phone.activeDurationMs / 1000).toFixed(1)}s`;

        if (phone.mode === "CALLING") {
          eventTypeObj = SAFETY_EVENT_TYPES.PHONE_CALL_DETECTED;
          eventMsg = `Driver holding phone to ear (Phone Call) for ${(phone.activeDurationMs / 1000).toFixed(1)}s`;
        } else if (phone.mode === "TEXTING") {
          eventTypeObj = SAFETY_EVENT_TYPES.PHONE_TEXTING_DETECTED;
          eventMsg = `Driver looking down at phone (Texting/Browsing) for ${(phone.activeDurationMs / 1000).toFixed(1)}s`;
        }

        if (shouldEmit(eventTypeObj.type, now)) {
          const ev = emitEvent(
            eventTypeObj,
            eventMsg,
            phone.activeDurationMs,
            {
              mode: phone.mode || "HOLDING",
              handState: phone.handRelationship?.state || "PHONE_HAND_ASSOCIATED",
              nearestHandedness: phone.handRelationship?.nearestHandedness || "Unknown",
              phoneScore: phone.candidate?.score || 0.6,
              modeReason: phone.modeReason || "Standard in-hand grip",
              ...tripContext,
            },
            now
          );
          newEvents.push(ev);
        }
      }

      return newEvents;
    },
    getEvents() {
      return eventHistory;
    },
    clearEvents() {
      eventHistory.length = 0;
    },
    exportEventsJSON() {
      return JSON.stringify(eventHistory, null, 2);
    },
  };
}
