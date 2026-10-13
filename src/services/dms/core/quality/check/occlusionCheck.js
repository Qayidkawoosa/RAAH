export function occlusionCheck(metrics, ref) {
  const { handOnFace, areaDrop, occlusionScore, landmarkIntegrityIssue } =
    metrics;

  if (!ref.current) {
    ref.current = {
      scoreHistory: [],
      active: false,
      occlusionFrames: 0,
  clearFrames: 0
    };
  }

  const memory = ref.current;
  memory.scoreHistory = memory.scoreHistory.map((value) => value * 0.9);
  memory.scoreHistory.push(occlusionScore);

  if (memory.scoreHistory.length > 10) {
    memory.scoreHistory.shift();
  }

  const avgScore =
    memory.scoreHistory.reduce((total, value) => total + value, 0) /
    memory.scoreHistory.length;

 if (avgScore >= 0.6) {

  memory.occlusionFrames++;

} else {

  memory.occlusionFrames = 0;
}

// recovery delay
if (avgScore <= 0.3) {

  memory.clearFrames++;

} else {

  memory.clearFrames = 0;
}

// activate after sustained occlusion
if (memory.occlusionFrames >= 15) {

  memory.active = true;
}

// deactivate after stable recovery
if (memory.clearFrames >= 10) {

  memory.active = false;
}

  let occlusionStatus = "Face clearly visible - OK";
  let occlusionSuggestion = "";
  let showOcclusionPopup = false;
  let occlusionSeverity = "excellent";
  let occlusionQualityScore = 100;
  let occlusionType = "none";

  if (memory.active) {
    if (landmarkIntegrityIssue) {
      occlusionSeverity = "poor";
      occlusionQualityScore -= 45;
      showOcclusionPopup = true;
      occlusionType = "occluded";
      occlusionStatus = "Face occluded - Issue";
      occlusionSuggestion = "Keep your full face visible to the camera.";
    } else if (handOnFace) {
      occlusionSeverity = "poor";
      occlusionQualityScore -= 35;
      showOcclusionPopup = true;
      occlusionType = "handOnFace";
      occlusionStatus = "Hand covering face - Issue";
      occlusionSuggestion = "Move your hand away from your eyes, nose, and mouth.";
    } else if (areaDrop) {
      occlusionSeverity = "acceptable";
      occlusionQualityScore -= 10;
      occlusionType = "unstable";
      occlusionStatus = "Face unstable - Warning";
      occlusionSuggestion = "Keep your face steady and centered.";
    } else {
      occlusionSeverity = "acceptable";
      occlusionQualityScore -= 15;
      occlusionType = "partial";
      occlusionStatus = "Face partially occluded - Warning";
      occlusionSuggestion = "Ensure your face is fully visible.";
    }
  }

  return {
    occlusionStatus,
    occlusionSuggestion,
    showOcclusionPopup,
    occlusionSeverity,
    occlusionQualityScore,
    occlusionType,
  };
}
