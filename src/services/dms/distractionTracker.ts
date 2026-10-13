/**
 * Driver Distraction, Head Pose, Yawn, and Phone Usage State Machine
 * Decoupled from browser DOM APIs.
 */

import { HeadPose } from './geometry';

export interface GazeDistractionState {
  isDistracted: boolean;
  offRoadDurationMs: number;
  reason: 'looking_left' | 'looking_right' | 'looking_down' | 'looking_up' | 'head_turned' | 'normal';
  severity: 'normal' | 'warn' | 'critical';
}

export interface YawnState {
  isYawning: boolean;
  yawnDurationMs: number;
  yawnCount: number;
  severity: 'normal' | 'warn';
}

export interface PhoneUsageState {
  isUsingPhone: boolean;
  mode: 'none' | 'calling' | 'texting';
  confidence: number;
  severity: 'normal' | 'critical';
}

export class DistractionTracker {
  // Head pose limits (in degrees)
  private readonly YAW_THRESHOLD = 20;         // Looking away left/right (> 20 deg)
  private readonly PITCH_DOWN_THRESHOLD = -15; // Looking down (> 15 deg)
  private readonly PITCH_UP_THRESHOLD = 20;    // Looking up (> 20 deg)
  private readonly DISTRACTION_WARN_MS = 2000;   // Warn after 2 seconds off-road
  private readonly DISTRACTION_CRIT_MS = 3500;   // Critical alert after 3.5 seconds

  // Yawn limits
  private readonly MAR_YAWN_THRESHOLD = 0.65;
  private readonly YAWN_DURATION_MS = 2000;

  private offRoadStartTime: number | null = null;
  private currentDistractionReason: GazeDistractionState['reason'] = 'normal';

  private yawnStartTime: number | null = null;
  private yawnCounter: number = 0;
  private lastYawnRecordedTime: number = 0;

  /**
   * Evaluates gaze and head pose deviation.
   */
  public updateHeadPose(pose: HeadPose, nowMs: number = Date.now()): GazeDistractionState {
    const isLookingAway = Math.abs(pose.yaw) > this.YAW_THRESHOLD;
    const isLookingDown = pose.pitch < this.PITCH_DOWN_THRESHOLD;
    const isLookingUp = pose.pitch > this.PITCH_UP_THRESHOLD;

    const isOffRoad = isLookingAway || isLookingDown || isLookingUp;

    if (isOffRoad) {
      if (this.offRoadStartTime === null) {
        this.offRoadStartTime = nowMs;
        if (isLookingDown) {
          this.currentDistractionReason = 'looking_down';
        } else if (isLookingUp) {
          this.currentDistractionReason = 'looking_up';
        } else if (pose.yaw < -this.YAW_THRESHOLD) {
          this.currentDistractionReason = 'looking_right';
        } else {
          this.currentDistractionReason = 'looking_left';
        }
      }
    } else {
      this.offRoadStartTime = null;
      this.currentDistractionReason = 'normal';
    }

    const offRoadDurationMs = this.offRoadStartTime !== null ? nowMs - this.offRoadStartTime : 0;
    const isDistracted = offRoadDurationMs >= this.DISTRACTION_WARN_MS;

    let severity: 'normal' | 'warn' | 'critical' = 'normal';
    if (offRoadDurationMs >= this.DISTRACTION_CRIT_MS) {
      severity = 'critical';
    } else if (isDistracted) {
      severity = 'warn';
    }

    return {
      isDistracted,
      offRoadDurationMs,
      reason: this.currentDistractionReason,
      severity,
    };
  }

  /**
   * Evaluates mouth aspect ratio for yawning.
   */
  public updateMouth(mar: number, nowMs: number = Date.now()): YawnState {
    const isOpen = mar > this.MAR_YAWN_THRESHOLD;

    if (isOpen) {
      if (this.yawnStartTime === null) {
        this.yawnStartTime = nowMs;
      }
    } else {
      // If mouth closed after being open >= YAWN_DURATION_MS, count as a yawn
      if (this.yawnStartTime !== null) {
        const duration = nowMs - this.yawnStartTime;
        if (duration >= this.YAWN_DURATION_MS && nowMs - this.lastYawnRecordedTime > 3000) {
          this.yawnCounter++;
          this.lastYawnRecordedTime = nowMs;
        }
      }
      this.yawnStartTime = null;
    }

    const yawnDurationMs = this.yawnStartTime !== null ? nowMs - this.yawnStartTime : 0;
    const isYawning = yawnDurationMs >= this.YAWN_DURATION_MS;

    return {
      isYawning,
      yawnDurationMs,
      yawnCount: this.yawnCounter,
      severity: isYawning ? 'warn' : 'normal',
    };
  }

  /**
   * Evaluates phone usage indicators.
   */
  public evaluatePhoneUsage(
    detectedPhone: { isDetected: boolean; nearEar: boolean; nearLap: boolean; confidence: number }
  ): PhoneUsageState {
    if (!detectedPhone.isDetected || detectedPhone.confidence < 0.6) {
      return {
        isUsingPhone: false,
        mode: 'none',
        confidence: 0,
        severity: 'normal',
      };
    }

    const mode = detectedPhone.nearEar ? 'calling' : detectedPhone.nearLap ? 'texting' : 'texting';

    return {
      isUsingPhone: true,
      mode,
      confidence: detectedPhone.confidence,
      severity: 'critical',
    };
  }

  public reset(): void {
    this.offRoadStartTime = null;
    this.currentDistractionReason = 'normal';
    this.yawnStartTime = null;
    this.yawnCounter = 0;
  }
}
