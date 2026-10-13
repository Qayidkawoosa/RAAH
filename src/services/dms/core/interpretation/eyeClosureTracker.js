// core/interpretation/eyeClosureTracker.js

import { TimeBuffer } from "./timeBuffer.js";

export function createEyeClosureTracker(options = {}) {
  const {
    microsleepThresholdMs = 2000, // 2.0 seconds eyes closed = microsleep (responsive alert)
    perclosWindowMs = 30000,       // 30-second rolling window (responsive fatigue tracking)
    perclosWarningThreshold = 15,  // 15% PERCLOS = Drowsy
    perclosCriticalThreshold = 25, // 25% PERCLOS = Severe Fatigue
    closeThreshold = 0.42,         // Onset threshold for eye closure
    openThreshold = 0.24,          // Reopen threshold (hysteresis release)
    minBlinkDurationMs = 20,       // Minimum closure duration (catches fast 1-frame blinks)
    maxBlinkDurationMs = 1000,     // Max closure duration for a blink (>1s is prolonged closure/microsleep)
    debounceMs = 70,               // Debounce refractory period (supports rapid double blinks)
    adaptive = true,               // Dynamically adapt to driver's resting eye openness baseline
  } = options;

  let closedStartTime = null;
  let continuousClosedMs = 0;
  let blinkCount = 0;
  let lastBlinkTimestamp = 0;
  let inBlink = false;
  let peakBlinkScore = 0;
  let baselineBlinkAvg = 0.08;
  let perclosScore = 0;

  const perclosBuffer = new TimeBuffer(perclosWindowMs);

  return {
    update(blendshapes, timestamp = performance.now()) {
      const left = blendshapes?.eyeBlinkLeft ?? 0;
      const right = blendshapes?.eyeBlinkRight ?? 0;
      const avg = blendshapes?.eyeBlinkAvg ?? ((left + right) / 2);
      const maxEye = Math.max(left, right);
      const minEye = Math.min(left, right);

      // 1. Adaptive Resting Baseline Tracking
      if (adaptive) {
        // Update baseline during relaxed open-eye periods
        if (avg < 0.30 && maxEye < 0.35) {
          if (avg < baselineBlinkAvg) {
            baselineBlinkAvg = baselineBlinkAvg * 0.85 + avg * 0.15;
          } else {
            baselineBlinkAvg = baselineBlinkAvg * 0.998 + avg * 0.002;
          }
          baselineBlinkAvg = Math.max(0.02, Math.min(0.25, baselineBlinkAvg));
        }
      }

      const effectiveCloseThreshold = Math.max(closeThreshold, baselineBlinkAvg + 0.22);
      const effectiveOpenThreshold = Math.max(openThreshold, baselineBlinkAvg + 0.08);

      // 2. Hysteresis Blink State Machine
      // When gaze is directed down (e.g. lap/phone), eyelid descends naturally without true closure.
      // Eyelids must be clamped shut (>= 0.78) to be considered closing when gaze is directed down.
      const isDownGaze = Boolean(blendshapes?.isGazeDown);
      const isClosingCandidate = isDownGaze
        ? (avg >= 0.78 || (left >= 0.75 && right >= 0.75))
        : (avg >= effectiveCloseThreshold ||
          (left >= effectiveCloseThreshold - 0.04 && right >= effectiveCloseThreshold - 0.04) ||
          (maxEye >= effectiveCloseThreshold + 0.08 && minEye >= effectiveOpenThreshold));

      const isReopened = isDownGaze
        ? (avg < 0.65)
        : (avg < effectiveOpenThreshold &&
          left < (effectiveOpenThreshold + 0.06) &&
          right < (effectiveOpenThreshold + 0.06));

      if (!inBlink) {
        if (isClosingCandidate) {
          inBlink = true;
          closedStartTime = timestamp;
          peakBlinkScore = maxEye;
          continuousClosedMs = 0;
        } else {
          closedStartTime = null;
          continuousClosedMs = 0;
        }
      } else {
        peakBlinkScore = Math.max(peakBlinkScore, maxEye);
        continuousClosedMs = Math.round(timestamp - closedStartTime);

        if (isReopened) {
          const closureDuration = timestamp - closedStartTime;


          if (
            closureDuration >= minBlinkDurationMs &&
            closureDuration <= maxBlinkDurationMs &&
            (timestamp - lastBlinkTimestamp) >= debounceMs
          ) {
            blinkCount++;
            lastBlinkTimestamp = timestamp;
          }

          inBlink = false;
          closedStartTime = null;
          continuousClosedMs = 0;
        }
      }

      const isMicrosleep = continuousClosedMs >= microsleepThresholdMs;

      // P80 Closure check: Detects both fully closed eyes and heavy drowsy drooping
      // (>= 60% closure or actively in-blink closure; >= 75% when looking down)
      const isPerclosClosed = (!isDownGaze && (avg >= 0.60 || (inBlink && avg >= 0.48))) ||
        (isDownGaze && (avg >= 0.75 || (inBlink && avg >= 0.65))) ? 1 : 0;
      perclosBuffer.push(isPerclosClosed, timestamp);

      const samples = perclosBuffer.getSamples();
      const bufferDurationMs = perclosBuffer.getDuration();
      // Responsive ramp-up: clamp to min 8s so initial 200ms blinks stay low (<3%),
      // but eyes drooping for 1.5-2s immediately register fatigue
      const effectiveWindowMs = Math.max(8000, Math.min(perclosWindowMs, bufferDurationMs));

      // Compute actual closed duration in milliseconds
      let closedDurationMs = 0;
      for (let i = 0; i < samples.length - 1; i++) {
        if (samples[i].v === 1) {
          const dt = samples[i + 1].t - samples[i].t;
          closedDurationMs += Math.max(0, Math.min(200, dt));
        }
      }

      if (samples.length > 0 && samples[samples.length - 1].v === 1) {
        closedDurationMs += 33;
      }

      perclosScore = Number(((closedDurationMs / effectiveWindowMs) * 100).toFixed(1));

      // Drowsiness is evaluated after brief 6s ramp-up
      const isWarmingUp = bufferDurationMs < 6000;
      const isDrowsy = !isWarmingUp && perclosScore >= perclosWarningThreshold;
      const isSevereFatigue = !isWarmingUp && perclosScore >= perclosCriticalThreshold;

      return {
        continuousClosedMs,
        isMicrosleep,
        blinkCount,
        lastBlinkTimestamp,
        perclosScore,
        calibrating: bufferDurationMs < perclosWindowMs,
        bufferDurationMs: Math.round(bufferDurationMs),
        isDrowsy,
        isSevereFatigue,
        isEyesClosed: inBlink,
        blinkPeak: peakBlinkScore,
        baselineBlinkAvg: Number(baselineBlinkAvg.toFixed(3)),
      };
    },
    getBlinkCount() {
      return blinkCount;
    },
    getPerclosScore() {
      return perclosScore;
    },
    getState() {
      return {
        blinkCount,
        lastBlinkTimestamp,
        continuousClosedMs,
        isMicrosleep: continuousClosedMs >= microsleepThresholdMs,
        isEyesClosed: inBlink,
        perclosScore,
      };
    },
    reset() {
      closedStartTime = null;
      continuousClosedMs = 0;
      blinkCount = 0;
      lastBlinkTimestamp = 0;
      inBlink = false;
      peakBlinkScore = 0;
      baselineBlinkAvg = 0.08;
      perclosScore = 0;
      perclosBuffer.clear();
    },
  };
}
