// core/interpretation/yawnTracker.js

export function createYawnTracker(options = {}) {
  const {
    yawnMinDurationMs = 5000, // sustained jaw open for >= 5.0s
    jawOpenThreshold = 0.55,  // blendshape threshold
    yawnWindowMs = 300000,    // 5-minute rolling window for frequent yawns
  } = options;

  let yawnStartTime = null;
  let currentYawnDurationMs = 0;
  let yawnCount = 0;
  let lastYawnDuration = 0;
  const yawnTimestamps = [];

  return {
    update(blendshapes, timestamp = performance.now()) {
      const { jawOpen } = blendshapes;
      const isOpen = jawOpen >= jawOpenThreshold;

      if (isOpen) {
        if (!yawnStartTime) {
          yawnStartTime = timestamp;
        }
        currentYawnDurationMs = Math.round(timestamp - yawnStartTime);
      } else {
        if (yawnStartTime) {
          const duration = timestamp - yawnStartTime;
          if (duration >= yawnMinDurationMs) {
            yawnCount++;
            lastYawnDuration = duration;
            yawnTimestamps.push(timestamp);
          }
        }
        yawnStartTime = null;
        currentYawnDurationMs = 0;
      }

      // Prune yawn timestamps older than 5 minutes
      const cutoff = timestamp - yawnWindowMs;
      while (yawnTimestamps.length > 0 && yawnTimestamps[0] < cutoff) {
        yawnTimestamps.shift();
      }

      const isYawningNow = currentYawnDurationMs >= yawnMinDurationMs;
      const recentYawnCount = yawnTimestamps.length;
      const isFrequentYawning = recentYawnCount >= 3;

      return {
        jawOpen,
        currentYawnDurationMs,
        isYawningNow,
        yawnCount,
        lastYawnDuration,
        recentYawnCount,
        isFrequentYawning,
      };
    },
    reset() {
      yawnStartTime = null;
      currentYawnDurationMs = 0;
      yawnCount = 0;
      lastYawnDuration = 0;
      yawnTimestamps.length = 0;
    },
  };
}
