// core/vision/detectHands.js

export const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm Base
  [5, 9], [9, 13], [13, 17],
];

export const HAND_LANDMARK_NAMES = [
  "WRIST",
  "THUMB_CMC", "THUMB_MCP", "THUMB_IP", "THUMB_TIP",
  "INDEX_MCP", "INDEX_PIP", "INDEX_DIP", "INDEX_TIP",
  "MIDDLE_MCP", "MIDDLE_PIP", "MIDDLE_DIP", "MIDDLE_TIP",
  "RING_MCP", "RING_PIP", "RING_DIP", "RING_TIP",
  "PINKY_MCP", "PINKY_PIP", "PINKY_DIP", "PINKY_TIP"
];

/**
 * Runs hand landmark detection on a video frame and extracts structured geometry.
 *
 * @param {import("@mediapipe/tasks-vision").HandLandmarker} handLandmarker
 * @param {HTMLVideoElement} video
 * @param {number} frameWidth
 * @param {number} frameHeight
 * @param {number} [timestampMs]
 * @returns {Array<{
 *   handIndex: number,
 *   handedness: string,
 *   score: number,
 *   landmarksNorm: Array<{x: number, y: number, z: number}>,
 *   landmarksPx: Array<{x: number, y: number, z: number}>,
 *   wristPx: {x: number, y: number},
 *   fingertipsPx: Array<{index: number, name: string, x: number, y: number}>,
 *   bbox: {originX: number, originY: number, width: number, height: number}
 * }>}
 */
let lastHandTimestamp = -1;

export function detectHands(handLandmarker, video, frameWidth, frameHeight, timestampMs = performance.now()) {
  if (!handLandmarker || !video || video.readyState < 2) {
    return [];
  }

  const ts = Math.max(lastHandTimestamp + 1, Math.round(timestampMs));
  lastHandTimestamp = ts;

  let result = null;
  try {
    result = handLandmarker.detectForVideo(video, ts);
  } catch (err) {
    console.warn("[DriverAttention] HandLandmarker inference error:", err);
    return [];
  }

  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return [];
  }

  const hands = [];

  for (let i = 0; i < result.landmarks.length; i++) {
    const rawLandmarks = result.landmarks[i];
    const handednessCategory = result.handednesses?.[i]?.[0];
    const handedness = handednessCategory?.categoryName || (i === 0 ? "Right" : "Left");
    const score = handednessCategory?.score || 0.8;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const landmarksPx = rawLandmarks.map((pt) => {
      const px = pt.x * frameWidth;
      const py = pt.y * frameHeight;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      return { x: px, y: py, z: pt.z };
    });

    const fingertipIndices = [4, 8, 12, 16, 20];
    const fingertipsPx = fingertipIndices.map((idx) => ({
      index: idx,
      name: HAND_LANDMARK_NAMES[idx],
      x: landmarksPx[idx].x,
      y: landmarksPx[idx].y,
    }));

    hands.push({
      handIndex: i,
      handedness,
      score,
      landmarksNorm: rawLandmarks,
      landmarksPx,
      wristPx: { x: landmarksPx[0].x, y: landmarksPx[0].y },
      fingertipsPx,
      bbox: {
        originX: Math.max(0, minX),
        originY: Math.max(0, minY),
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
      },
    });
  }

  return hands;
}
