// core/vision/seatbelt/seatbeltTracker.js

export const SEATBELT_TEMPORAL_STATE = {
  NO_DRIVER: "NO_DRIVER",
  UNFASTENED: "UNFASTENED",
  FASTENING: "FASTENING",
  CONFIRMED_FASTENED: "CONFIRMED_FASTENED",
  UNFASTENING: "UNFASTENING",
};

/**
 * Automotive Schmitt-Trigger Temporal State Debouncer for Seatbelt Compliance.
 */
export class SeatbeltTemporalTracker {
  constructor(options = {}) {
    this.confirmationWindowMs = options.confirmationWindowMs || 750;
    this.unfastenDelayMs = options.unfastenDelayMs || 1500;
    this.retentionThreshold = options.retentionThreshold || 0.22;

    this.currentState = SEATBELT_TEMPORAL_STATE.UNFASTENED;
    this.stateStartTime = performance.now();
    this.lastFrameTime = performance.now();

    this.fastenCreditMs = 0;
    this.unfastenAccumulatorMs = 0;
    this.smoothedConfidence = 0.0;

    this.blipsSuppressed = 0;
    this.transitionsCount = 0;
    this.totalFastenedTimeMs = 0;
    this.totalUnfastenedTimeMs = 0;
  }

  /**
   * Updates tracker with instantaneous frame result using dual-threshold hysteresis
   * and asymmetric unfasten grace period.
   *
   * @param {boolean} isDriverPresent - Whether pose landmarks detected a driver
   * @param {boolean} isFrameFastened - Instantaneous belt detection for this frame
   * @param {number} confidence - Current detection confidence [0..1]
   * @param {number} [now=performance.now()]
   * @returns {Object} Current temporal state and metrics
   */
  update(isDriverPresent, isFrameFastened, confidence, now = performance.now()) {
    const dt = Math.min(200, Math.max(0, now - this.lastFrameTime));
    this.lastFrameTime = now;

    if (!isDriverPresent) {
      this.currentState = SEATBELT_TEMPORAL_STATE.NO_DRIVER;
      this.fastenCreditMs = 0;
      this.unfastenAccumulatorMs = 0;
      this.smoothedConfidence = 0.0;
      return this.getTelemetry(now);
    }

    // Exponential Moving Average (EMA) on confidence (alpha = 0.25)
    this.smoothedConfidence = this.smoothedConfidence === 0
      ? confidence
      : 0.25 * confidence + 0.75 * this.smoothedConfidence;

    // Accumulate total times
    if (this.currentState === SEATBELT_TEMPORAL_STATE.CONFIRMED_FASTENED || this.currentState === SEATBELT_TEMPORAL_STATE.UNFASTENING) {
      this.totalFastenedTimeMs += dt;
    } else {
      this.totalUnfastenedTimeMs += dt;
    }

    const prevState = this.currentState;

    if (this.currentState === SEATBELT_TEMPORAL_STATE.CONFIRMED_FASTENED || this.currentState === SEATBELT_TEMPORAL_STATE.UNFASTENING) {
      // DUAL HYSTERESIS (SCHMITT TRIGGER):
      // Retention threshold of 0.22 prevents dropping out during body shifts, head turns, or leaning
      const isRetained = isFrameFastened || (this.smoothedConfidence >= this.retentionThreshold);

      if (isRetained) {
        this.unfastenAccumulatorMs = Math.max(0, this.unfastenAccumulatorMs - dt * 2.0);
        this.currentState = SEATBELT_TEMPORAL_STATE.CONFIRMED_FASTENED;
      } else {
        this.unfastenAccumulatorMs += dt;

        if (this.unfastenAccumulatorMs >= this.unfastenDelayMs) {
          // Sustained unbroken absence for >= 1.5s
          this.currentState = SEATBELT_TEMPORAL_STATE.UNFASTENED;
          this.fastenCreditMs = 0;
          this.unfastenAccumulatorMs = 0;
        } else if (this.unfastenAccumulatorMs > 400) {
          this.currentState = SEATBELT_TEMPORAL_STATE.UNFASTENING;
        }
      }
    } else {
      this.unfastenAccumulatorMs = 0;

      if (isFrameFastened) {
        this.fastenCreditMs = Math.min(this.confirmationWindowMs, this.fastenCreditMs + dt);
      } else {
        const prevCredit = this.fastenCreditMs;
        this.fastenCreditMs = Math.max(0, this.fastenCreditMs - dt * 0.85);
        if (prevCredit > 100 && this.fastenCreditMs === 0) {
          this.blipsSuppressed++;
        }
      }

      if (this.fastenCreditMs >= this.confirmationWindowMs) {
        this.currentState = SEATBELT_TEMPORAL_STATE.CONFIRMED_FASTENED;
      } else if (this.fastenCreditMs > 150) {
        this.currentState = SEATBELT_TEMPORAL_STATE.FASTENING;
      } else {
        this.currentState = SEATBELT_TEMPORAL_STATE.UNFASTENED;
      }
    }

    if (prevState !== this.currentState) {
      this.stateStartTime = now;
      if (this.currentState === SEATBELT_TEMPORAL_STATE.CONFIRMED_FASTENED || this.currentState === SEATBELT_TEMPORAL_STATE.UNFASTENED) {
        this.transitionsCount++;
      }
    }

    return this.getTelemetry(now);
  }

  getTelemetry(now = performance.now()) {
    let progress = 0;
    if (this.currentState === SEATBELT_TEMPORAL_STATE.CONFIRMED_FASTENED) {
      progress = 100;
    } else if (this.currentState === SEATBELT_TEMPORAL_STATE.UNFASTENING) {
      const remain = Math.max(0, this.unfastenDelayMs - this.unfastenAccumulatorMs);
      progress = Math.round((remain / this.unfastenDelayMs) * 100);
    } else {
      progress = Math.min(100, Math.round((this.fastenCreditMs / this.confirmationWindowMs) * 100));
    }

    const durationInState = Math.round(now - this.stateStartTime);

    return {
      state: this.currentState,
      progress,
      durationInState,
      blipsSuppressed: this.blipsSuppressed,
      transitionsCount: this.transitionsCount,
      totalFastenedTimeSec: Math.round(this.totalFastenedTimeMs / 1000),
      totalUnfastenedTimeSec: Math.round(this.totalUnfastenedTimeMs / 1000),
      smoothedConfidence: this.smoothedConfidence,
      fastenCreditMs: Math.round(this.fastenCreditMs),
      unfastenAccumulatorMs: Math.round(this.unfastenAccumulatorMs),
      unfastenDelayMs: this.unfastenDelayMs,
    };
  }

  setConfirmationWindow(ms) {
    this.confirmationWindowMs = Math.max(200, ms);
  }

  reset() {
    this.currentState = SEATBELT_TEMPORAL_STATE.UNFASTENED;
    this.stateStartTime = performance.now();
    this.lastFrameTime = performance.now();
    this.fastenCreditMs = 0;
    this.unfastenAccumulatorMs = 0;
    this.smoothedConfidence = 0.0;
  }
}
