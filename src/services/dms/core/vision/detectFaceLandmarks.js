// core/vision/detectFaceLandmarks.js

let lastFaceTimestamp = -1;

export function detectFaceLandmarks(faceLandmarker, video, timestampMs = performance.now()) {
  if (!faceLandmarker || !video || video.readyState < 2) {
    return null;
  }

  const ts = Math.max(lastFaceTimestamp + 1, Math.round(timestampMs));
  lastFaceTimestamp = ts;

  try {
    const result = faceLandmarker.detectForVideo(video, ts);

    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      return {
        faceLandmarks: null,
        allFaceLandmarks: [],
        faceBlendshapes: null,
        facialTransformationMatrix: null,
      };
    }

    return {
      faceLandmarks: result.faceLandmarks[0],
      allFaceLandmarks: result.faceLandmarks,
      faceBlendshapes: result.faceBlendshapes?.[0] || null,
      facialTransformationMatrix: result.facialTransformationMatrixes?.[0]?.data || null,
    };
  } catch (err) {
    console.warn('[detectFaceLandmarks] Error in detectForVideo:', err);
    return null;
  }
}
