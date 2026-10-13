/**
 * PERCLOS (Percentage of Eye Closure) and Microsleep State Machine
 * Runs sliding window calculations completely decoupled from browser timers and DOM.
 */

export interface EyeClosureSample {
  timestampMs: number;
  isClosed: boolean;
  ear: number;
}

export interface DrowsinessState {
  currentEAR: number;
  isEyesClosed: boolean;
  continuousClosedDurationMs: number;
  perclos: number; // 0.0 to 1.0 (Percentage of time eyes were closed in window)
  isMicrosleeping: boolean;
  isDrowsy: boolean;
  severity: 'normal' | 'warn' | 'critical';
}

export interface PerclosConfig {
  earClosureThreshold: number;       // EAR below this is considered eyes-closed (default ~0.21)
  windowDurationMs: number;          // PERCLOS sliding window (e.g. 30,000ms = 30 seconds)
  perclosWarnThreshold: number;      // e.g. 0.40 (40% eyes closed)
  perclosCriticalThreshold: number;  // e.g. 0.70 (70% eyes closed)
  microsleepDurationMs: number;      // Continuous eye closure triggering immediate critical alert (default 1500ms)
}

export const DEFAULT_PERCLOS_CONFIG: PerclosConfig = {
  earClosureThreshold: 0.21,
  windowDurationMs: 30000,
  perclosWarnThreshold: 0.35,
  perclosCriticalThreshold: 0.65,
  microsleepDurationMs: 1500,
};

export class PerclosTracker {
  private config: PerclosConfig;
  private samples: EyeClosureSample[] = [];
  private closedStartTime: number | null = null;

  constructor(config: Partial<PerclosConfig> = {}) {
    this.config = { ...DEFAULT_PERCLOS_CONFIG, ...config };
  }

  /**
   * Updates state with a new eye aspect ratio (EAR) measurement.
   */
  public update(ear: number, nowMs: number = Date.now()): DrowsinessState {
    const isClosed = ear < this.config.earClosureThreshold;

    // Track continuous closure duration
    if (isClosed) {
      if (this.closedStartTime === null) {
        this.closedStartTime = nowMs;
      }
    } else {
      this.closedStartTime = null;
    }

    const continuousClosedDurationMs = this.closedStartTime !== null ? nowMs - this.closedStartTime : 0;

    // Push sample to window
    this.samples.push({
      timestampMs: nowMs,
      isClosed,
      ear,
    });

    // Prune samples older than windowDurationMs
    const cutoffTime = nowMs - this.config.windowDurationMs;
    while (this.samples.length > 0 && this.samples[0].timestampMs < cutoffTime) {
      this.samples.shift();
    }

    // Calculate PERCLOS
    const totalSamples = this.samples.length;
    const closedCount = this.samples.filter(s => s.isClosed).length;
    const perclos = totalSamples > 0 ? closedCount / totalSamples : 0;

    // Determine state & severity
    const isMicrosleeping = continuousClosedDurationMs >= this.config.microsleepDurationMs;
    const isDrowsy = perclos >= this.config.perclosWarnThreshold || isMicrosleeping;

    let severity: 'normal' | 'warn' | 'critical' = 'normal';
    if (isMicrosleeping || perclos >= this.config.perclosCriticalThreshold) {
      severity = 'critical';
    } else if (perclos >= this.config.perclosWarnThreshold) {
      severity = 'warn';
    }

    return {
      currentEAR: ear,
      isEyesClosed: isClosed,
      continuousClosedDurationMs,
      perclos,
      isMicrosleeping,
      isDrowsy,
      severity,
    };
  }

  public reset(): void {
    this.samples = [];
    this.closedStartTime = null;
  }
}
