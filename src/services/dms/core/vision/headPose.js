// core/vision/headPose.js

/**
 * Extracts head pose (yaw, pitch, roll) and gaze direction from:
 * 1. facialTransformationMatrix (if available from MediaPipe delegate)
 * 2. 3D Facial Landmarks (geometrical calculation fallback when matrix is null)
 * 3. Blendshapes (eye gaze deflection)
 */
export function extractHeadPose(matrix, landmarks = null, blendshapes = null) {
  let yaw = 0;
  let pitch = 0;
  let roll = 0;
  let hasValidData = false;

  // 1. Try Euler angles from transformation matrix first
  if (matrix && matrix.length >= 16 && (matrix[2] !== 0 || matrix[6] !== 0 || matrix[10] !== 0)) {
    const yawRad = Math.atan2(matrix[2], matrix[10]);
    const pitchRad = Math.asin(Math.max(-1, Math.min(1, -matrix[6])));
    const rollRad = Math.atan2(matrix[4], matrix[5]);

    yaw = (yawRad * 180) / Math.PI;
    pitch = (pitchRad * 180) / Math.PI;
    roll = (rollRad * 180) / Math.PI;
    hasValidData = true;
  }
  // 2. Geometrical computation fallback directly from 3D face mesh landmarks
  else if (landmarks && landmarks.length >= 264) {
    const nose = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const chin = landmarks[152];
    const forehead = landmarks[10];

    if (nose && leftEye && rightEye && chin && forehead) {
      // Eye horizontal span
      const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y) || 0.001;
      const midEyeX = (leftEye.x + rightEye.x) / 2;
      
      // Yaw calculation from nose deviation relative to eyes
      const noseOffset = nose.x - midEyeX;
      const rawYawRatio = noseOffset / (eyeDist * 0.48);
      // Mirrored webcams show looking right as nose moving positive X
      yaw = Math.max(-80, Math.min(80, -rawYawRatio * 55));

      // Pitch calculation from nose vertical position relative to forehead & chin
      const faceHeight = Math.abs(chin.y - forehead.y) || 0.001;
      const midFaceY = forehead.y + faceHeight * 0.52;
      const noseVertOffset = nose.y - midFaceY;
      const rawPitchRatio = noseVertOffset / (faceHeight * 0.45);
      pitch = Math.max(-75, Math.min(75, -rawPitchRatio * 65));

      // Roll calculation from eye inclination angle
      const rollRad = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
      roll = (rollRad * 180) / Math.PI;

      hasValidData = true;
    }
  }

  if (!hasValidData) {
    return {
      yaw: 0,
      pitch: 0,
      roll: 0,
      isLookingAway: false,
      isLookingDown: false,
      isLookingUp: false,
      direction: "NO_FACE",
      hasDriverFace: false,
    };
  }

  const isLookingLeft = yaw > 20;
  const isLookingRight = yaw < -20;
  const isLookingDown = pitch < -15;
  const isLookingUp = pitch > 20;
  const isLookingAway = isLookingLeft || isLookingRight || isLookingDown || isLookingUp;

  let direction = "FORWARD";
  if (isLookingLeft) direction = "LEFT";
  else if (isLookingRight) direction = "RIGHT";
  else if (isLookingDown) direction = "DOWN";
  else if (isLookingUp) direction = "UP";

  return {
    yaw: Number(yaw.toFixed(1)),
    pitch: Number(pitch.toFixed(1)),
    roll: Number(roll.toFixed(1)),
    isLookingAway,
    isLookingDown,
    isLookingUp,
    direction,
    hasDriverFace: true,
  };
}
