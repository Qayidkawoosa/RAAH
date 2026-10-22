// core/vision/detectPose.js

/**
 * Executes PoseLandmarker detection on a video frame.
 *
 * @param {PoseLandmarker} poseLandmarker
 * @param {HTMLVideoElement} video
 * @param {number} [timestampMs=performance.now()]
 * @returns {Array|null} 33 normalized pose landmarks ({x, y, z, visibility})
 */
export function detectPose(poseLandmarker, video, timestampMs = performance.now()) {
  if (!poseLandmarker || !video || video.readyState < 2) {
    return null;
  }

  const result = poseLandmarker.detectForVideo(video, timestampMs);
  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return null;
  }

  return result.landmarks[0];
}
