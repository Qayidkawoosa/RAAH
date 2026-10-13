/**
 * DMS Geometry & Computer Vision Math Utilities
 * Pure TypeScript implementation without DOM dependencies (no HTMLVideoElement or HTMLCanvasElement).
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

/**
 * Calculates Euclidean distance between two 2D points.
 */
export function euclideanDistance(p1: Point2D, p2: Point2D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates Eye Aspect Ratio (EAR) based on 6 standardized eye landmarks.
 * 
 * Standard formula:
 * EAR = (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)
 * 
 * p1, p4: horizontal eye corners
 * p2, p6: upper/lower eyelid top-left
 * p3, p5: upper/lower eyelid top-right
 */
export function calculateEAR(landmarks: Point2D[]): number {
  if (!landmarks || landmarks.length < 6) return 0.3;

  const [p1, p2, p3, p4, p5, p6] = landmarks;
  const vertical1 = euclideanDistance(p2, p6);
  const vertical2 = euclideanDistance(p3, p5);
  const horizontal = euclideanDistance(p1, p4);

  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Calculates Mouth Aspect Ratio (MAR) for yawn detection.
 * 
 * MAR = (|upper_lip - lower_lip|) / (|lip_left - lip_right|)
 */
export function calculateMAR(
  topLip: Point2D,
  bottomLip: Point2D,
  leftCorner: Point2D,
  rightCorner: Point2D
): number {
  const vertical = euclideanDistance(topLip, bottomLip);
  const horizontal = euclideanDistance(leftCorner, rightCorner);

  if (horizontal === 0) return 0;
  return vertical / horizontal;
}

/**
 * Approximates Head Pose (Yaw, Pitch, Roll in degrees) from facial keypoints.
 * 
 * Keypoints expected:
 * - noseTip
 * - chin
 * - leftEyeOuter
 * - rightEyeOuter
 * - mouthLeft
 * - mouthRight
 */
export interface HeadPose {
  yaw: number;   // Turning head left (-) / right (+)
  pitch: number; // Looking up (+) / down (-)
  roll: number;  // Tilting head side to side
}

export function estimateHeadPose(
  noseTip: Point3D,
  chin: Point3D,
  leftEye: Point3D,
  rightEye: Point3D
): HeadPose {
  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  };

  const eyeSpan = euclideanDistance(leftEye, rightEye);
  if (eyeSpan === 0) return { yaw: 0, pitch: 0, roll: 0 };

  // Yaw: horizontal displacement of nose tip relative to eye center
  const yawOffset = (noseTip.x - eyeCenter.x) / eyeSpan;
  const yaw = yawOffset * 90; // approximate degree mapping

  // Pitch: vertical displacement of nose relative to eye center vs chin
  const faceHeight = euclideanDistance(eyeCenter, chin);
  const pitchOffset = faceHeight > 0 ? (noseTip.y - eyeCenter.y) / faceHeight : 0.5;
  // Natural neutral ratio is around 0.45; deviation maps to pitch
  const pitch = (0.45 - pitchOffset) * 120;

  // Roll: slope of eye line
  const dY = rightEye.y - leftEye.y;
  const dX = rightEye.x - leftEye.x;
  const roll = (Math.atan2(dY, dX) * 180) / Math.PI;

  return { yaw, pitch, roll };
}
