const MISSING_FACE_FRAME_LIMIT = 10;

export function missingFaceCheck(ref, { personDetected = false } = {}) {
  if (!ref.current) {
    ref.current = {
      missingFrames: 0,
    };
  }

  ref.current.missingFrames += 1;
  const active = ref.current.missingFrames >= MISSING_FACE_FRAME_LIMIT;
  const issueType = personDetected ? "faceBlocked" : "missingFace";
  const activeStatus = personDetected
    ? "Face blocked - Issue"
    : "Face missing - Issue";
  const activeMessage = personDetected
    ? "Analysis is paused because something is blocking a usable face view."
    : "Analysis is paused because no face is in the camera view.";
  const inactiveStatus = personDetected
    ? "Face blocked"
    : "Face not detected";

  return {
    active,
    issueType,
    blockingIssue: personDetected ? "Face blocked" : "Face missing",
    status: active ? activeStatus : inactiveStatus,
    suggestion: active
      ? personDetected
        ? "Remove the obstruction and look toward the camera."
        : "Move your face into the camera view."
      : personDetected
        ? "Remove anything covering your face."
        : "Keep your face visible to the camera.",
    activePopup: active
      ? {
          title: personDetected ? "Face Blocked" : "Face Missing",
          message: activeMessage,
          suggestion: personDetected
            ? "Remove the obstruction so your eyes, nose, and mouth are visible."
            : "Move your face into view and look toward the camera.",
        }
      : null,
  };
}

export function resetMissingFaceCheck(ref) {
  if (ref.current) {
    ref.current.missingFrames = 0;
  }
}
