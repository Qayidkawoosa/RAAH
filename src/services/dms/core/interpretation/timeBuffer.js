// core/interpretation/timeBuffer.js

export class TimeBuffer {
  constructor(maxDurationMs = 60000) {
    this.maxDurationMs = maxDurationMs;
    this.samples = [];
  }

  push(value, timestamp = performance.now()) {
    this.samples.push({ t: timestamp, v: value });
    this.prune(timestamp);
  }

  prune(currentTimestamp = performance.now()) {
    const cutoff = currentTimestamp - this.maxDurationMs;
    while (this.samples.length > 0 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }
  }

  getSamples() {
    return this.samples;
  }

  getDuration() {
    if (this.samples.length < 2) return 0;
    return this.samples[this.samples.length - 1].t - this.samples[0].t;
  }

  clear() {
    this.samples = [];
  }
}
