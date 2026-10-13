// core/vision/blendshapes.js

export function getCategoryScore(blendshapes, name) {
  if (!blendshapes || !blendshapes.categories) return 0;
  const match = blendshapes.categories.find((c) => c.categoryName === name);
  return match ? match.score : 0;
}

export function extractDriverBlendshapes(blendshapes) {
  if (!blendshapes) {
    return {
      eyeBlinkLeft: 0,
      eyeBlinkRight: 0,
      eyeBlinkAvg: 0,
      eyeOpenness: 1,
      isEyesClosed: false,
      jawOpen: 0,
      isYawningCandidate: false,
      gazeHoriz: 0,
      gazeVert: 0,
    };
  }

  // 1. Raw Eyelid Blink Coefficients
  const eyeBlinkLeft = getCategoryScore(blendshapes, "eyeBlinkLeft");
  const eyeBlinkRight = getCategoryScore(blendshapes, "eyeBlinkRight");
  const eyeBlinkAvg = (eyeBlinkLeft + eyeBlinkRight) / 2;

  // 2. Jaw Open / Yawn Candidate
  const jawOpen = getCategoryScore(blendshapes, "jawOpen");
  const isYawningCandidate = jawOpen >= 0.55;

  // 3. Eye Gaze Directions (Subject's perspective)
  // Left: left eye looks out toward temple + right eye looks in toward nose
  const gazeLookLeft = (getCategoryScore(blendshapes, "eyeLookOutLeft") + getCategoryScore(blendshapes, "eyeLookInRight")) / 2;
  // Right: left eye looks in toward nose + right eye looks out toward temple
  const gazeLookRight = (getCategoryScore(blendshapes, "eyeLookInLeft") + getCategoryScore(blendshapes, "eyeLookOutRight")) / 2;
  // Up / Down
  const gazeLookUp = (getCategoryScore(blendshapes, "eyeLookUpLeft") + getCategoryScore(blendshapes, "eyeLookUpRight")) / 2;
  const gazeLookDown = (getCategoryScore(blendshapes, "eyeLookDownLeft") + getCategoryScore(blendshapes, "eyeLookDownRight")) / 2;

  const gazeHoriz = Math.max(gazeLookLeft, gazeLookRight);
  const gazeVert = Math.max(gazeLookUp, gazeLookDown);

  // Gaze is only meaningful when eyes are open (pupil is visible).
  // When blinking or eyes are closed, descending eyelids produce false downward-gaze artifacts.
  const isEyeOpenForGaze = eyeBlinkAvg < 0.55;

  // Robust gaze deflection thresholds (filtering out minor natural saccades)
  const isGazeDown = isEyeOpenForGaze && gazeLookDown >= 0.42;
  const isGazeLeft = isEyeOpenForGaze && gazeLookLeft >= 0.42;
  const isGazeRight = isEyeOpenForGaze && gazeLookRight >= 0.42;
  const isGazeUp = isEyeOpenForGaze && gazeLookUp >= 0.42;
  const isGazeAway = isGazeDown || isGazeLeft || isGazeRight || isGazeUp;

  let gazeDirection = "FORWARD";
  if (isGazeDown) gazeDirection = "DOWN";
  else if (isGazeLeft) gazeDirection = "LEFT";
  else if (isGazeRight) gazeDirection = "RIGHT";
  else if (isGazeUp) gazeDirection = "UP";

  // 4. Eyelid Closure vs Downward Gaze Compensation:
  // When looking down at a lap/phone, upper eyelids naturally lower over the iris,
  // causing MediaPipe to output moderate eyeBlink (0.40-0.55) even though the eyes are open and looking at a device.
  // When looking down, true eye closure requires higher blink coefficient (>= 0.78).
  let isEyesClosed = false;
  let eyeOpenness = 1;

  if (isGazeDown) {
    // Looking down with eyes open: eyelids are lowered but eyes are actively viewing
    isEyesClosed = eyeBlinkAvg >= 0.78;
    eyeOpenness = isEyesClosed ? 0 : Math.max(0.65, Math.min(1, 1 - Math.max(0, eyeBlinkAvg - 0.25)));
  } else {
    isEyesClosed = eyeBlinkAvg >= 0.45 || (eyeBlinkLeft >= 0.40 && eyeBlinkRight >= 0.40);
    eyeOpenness = Math.max(0, Math.min(1, 1 - eyeBlinkAvg));
  }

  return {
    eyeBlinkLeft: Number(eyeBlinkLeft.toFixed(3)),
    eyeBlinkRight: Number(eyeBlinkRight.toFixed(3)),
    eyeBlinkAvg: Number(eyeBlinkAvg.toFixed(3)),
    eyeOpenness: Number(eyeOpenness.toFixed(3)),
    isEyesClosed,
    jawOpen: Number(jawOpen.toFixed(3)),
    isYawningCandidate,
    gazeLookLeft: Number(gazeLookLeft.toFixed(3)),
    gazeLookRight: Number(gazeLookRight.toFixed(3)),
    gazeLookUp: Number(gazeLookUp.toFixed(3)),
    gazeLookDown: Number(gazeLookDown.toFixed(3)),
    gazeHoriz: Number(gazeHoriz.toFixed(3)),
    gazeVert: Number(gazeVert.toFixed(3)),
    isGazeDown,
    isGazeLeft,
    isGazeRight,
    isGazeUp,
    isGazeAway,
    gazeDirection,
  };
}
