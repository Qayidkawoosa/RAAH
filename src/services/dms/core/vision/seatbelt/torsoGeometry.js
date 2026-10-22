// core/vision/seatbelt/torsoGeometry.js

/**
 * Standard MediaPipe Pose Landmark indices
 */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
};

/**
 * Calculates torso geometry, bounding box, and diagonal seatbelt paths from pose landmarks.
 *
 * @param {Array} landmarks - 33 normalized pose landmarks ({x, y, z, visibility})
 * @param {number} canvasWidth - Viewport width in pixels
 * @param {number} canvasHeight - Viewport height in pixels
 * @param {string} [beltSide="AUTO"] - "AUTO", "RHD" (Right Shoulder -> Left Hip), or "LHD" (Left Shoulder -> Right Hip)
 * @returns {Object|null}
 */
export function extractTorsoGeometry(landmarks, canvasWidth, canvasHeight, beltSide = "AUTO") {
  if (!landmarks || landmarks.length < 25) return null;

  // 1. Support MediaPipe FaceLandmarker (468/478 landmarks) fallback
  if (landmarks.length > 50) {
    const chin = landmarks[152];
    const forehead = landmarks[10];
    if (!chin || !forehead) return null;

    const chinPx = { x: chin.x * canvasWidth, y: chin.y * canvasHeight };
    const foreheadPx = { x: forehead.x * canvasWidth, y: forehead.y * canvasHeight };
    const faceHeight = Math.max(30, Math.hypot(chinPx.x - foreheadPx.x, chinPx.y - foreheadPx.y));

    const leftCheek = landmarks[234] || landmarks[33] || { x: chin.x - 0.1, y: chin.y - 0.1 };
    const rightCheek = landmarks[454] || landmarks[263] || { x: chin.x + 0.1, y: chin.y - 0.1 };
    const faceWidth = Math.max(30, Math.hypot(
      (rightCheek.x - leftCheek.x) * canvasWidth,
      (rightCheek.y - leftCheek.y) * canvasHeight
    ));

    const clavicleCenter = {
      x: chinPx.x,
      y: Math.min(canvasHeight - 15, chinPx.y + faceHeight * 0.40),
    };

    const halfShoulderSpan = faceWidth * 1.35;
    const shoulderDist = halfShoulderSpan * 2;

    const leftShoulderPx = {
      x: Math.max(0, chinPx.x - halfShoulderSpan),
      y: clavicleCenter.y + faceHeight * 0.10,
    };
    const rightShoulderPx = {
      x: Math.min(canvasWidth, chinPx.x + halfShoulderSpan),
      y: clavicleCenter.y + faceHeight * 0.10,
    };

    const estimatedTorsoHeight = shoulderDist * 1.35;

    const hipHalfSpan = shoulderDist * 0.58;
    const leftHipPx = {
      x: Math.max(0, clavicleCenter.x - hipHalfSpan),
      y: Math.min(canvasHeight, leftShoulderPx.y + estimatedTorsoHeight),
    };
    const rightHipPx = {
      x: Math.min(canvasWidth, clavicleCenter.x + hipHalfSpan),
      y: Math.min(canvasHeight, rightShoulderPx.y + estimatedTorsoHeight),
    };

    const hipsCenter = {
      x: (leftHipPx.x + rightHipPx.x) / 2,
      y: (leftHipPx.y + rightHipPx.y) / 2,
    };

    const chestHalfWidth = shoulderDist * 0.46;
    const minX = Math.max(0, clavicleCenter.x - chestHalfWidth);
    const maxX = Math.min(canvasWidth, clavicleCenter.x + chestHalfWidth);
    const minY = Math.max(0, Math.min(leftShoulderPx.y, rightShoulderPx.y) + 5);
    const maxY = Math.min(canvasHeight, Math.max(leftHipPx.y, rightHipPx.y) + 15);

    const torsoRoi = {
      x: Math.round(minX),
      y: Math.round(minY),
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
    };

    const rightClavicleAnchor = {
      x: clavicleCenter.x + 0.65 * (rightShoulderPx.x - clavicleCenter.x),
      y: rightShoulderPx.y - 5,
    };
    const leftClavicleAnchor = {
      x: clavicleCenter.x + 0.65 * (leftShoulderPx.x - clavicleCenter.x),
      y: leftShoulderPx.y - 5,
    };

    const pathRHD = {
      start: rightClavicleAnchor,
      end: { ...leftHipPx },
      name: "RHD (Right Clavicle -> Left Hip)",
      side: "RHD",
    };

    const pathLHD = {
      start: leftClavicleAnchor,
      end: { ...rightHipPx },
      name: "LHD (Left Clavicle -> Right Hip)",
      side: "LHD",
    };

    return {
      landmarks,
      leftShoulderPx,
      rightShoulderPx,
      leftHipPx,
      rightHipPx,
      clavicleCenter,
      hipsCenter,
      shoulderDist,
      torsoRoi,
      pathRHD,
      pathLHD,
      selectedSide: beltSide,
      estimatedTorsoHeight,
    };
  }

  // 2. Standard 33 MediaPipe Pose landmarks

  const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const lh = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP];

  // Check visibility of shoulders
  const shouldersVisible = (ls?.visibility ?? 1) > 0.35 && (rs?.visibility ?? 1) > 0.35;
  if (!shouldersVisible) return null;

  // Pixel coordinates
  const leftShoulderPx = { x: ls.x * canvasWidth, y: ls.y * canvasHeight };
  const rightShoulderPx = { x: rs.x * canvasWidth, y: rs.y * canvasHeight };

  // Hip estimation fallback if driver's lap is occluded below steering wheel
  const shoulderDist = Math.hypot(
    rightShoulderPx.x - leftShoulderPx.x,
    rightShoulderPx.y - leftShoulderPx.y
  );

  // Clavicle center (midpoint between shoulders)
  const clavicleCenter = {
    x: (leftShoulderPx.x + rightShoulderPx.x) / 2,
    y: (leftShoulderPx.y + rightShoulderPx.y) / 2,
  };

  // Typical torso height is ~1.2 - 1.4x shoulder width
  const estimatedTorsoHeight = shoulderDist * 1.35;

  const hipHalfSpan = shoulderDist * 0.58;
  const leftHipPx = lh && (lh.visibility ?? 1) > 0.35
    ? { x: lh.x * canvasWidth, y: lh.y * canvasHeight }
    : { x: clavicleCenter.x - hipHalfSpan, y: leftShoulderPx.y + estimatedTorsoHeight };

  const rightHipPx = rh && (rh.visibility ?? 1) > 0.35
    ? { x: rh.x * canvasWidth, y: rh.y * canvasHeight }
    : { x: clavicleCenter.x + hipHalfSpan, y: rightShoulderPx.y + estimatedTorsoHeight };

  const hipsCenter = {
    x: (leftHipPx.x + rightHipPx.x) / 2,
    y: (leftHipPx.y + rightHipPx.y) / 2,
  };

  // Torso bounding box: strictly bounded to driver chest and abdomen
  // Starting slightly below shoulder tops (+5px) excludes headrest, chin, and neck
  // Chest half-width (46% of shoulder span) keeps ROI inside driver fabric, excluding curtains
  const chestHalfWidth = shoulderDist * 0.46;
  const minX = Math.max(0, clavicleCenter.x - chestHalfWidth);
  const maxX = Math.min(canvasWidth, clavicleCenter.x + chestHalfWidth);
  const minY = Math.max(0, Math.min(leftShoulderPx.y, rightShoulderPx.y) + 5);
  const maxY = Math.min(canvasHeight, Math.max(leftHipPx.y, rightHipPx.y) + 15);

  const torsoRoi = {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
  };

  // Anatomical Seatbelt Clavicle Anchors
  // In passenger vehicles and buses, the shoulder strap passes over the mid-to-outer clavicle (~65% out from neck),
  // creating a true 3-point sash across the sternum and ribcage.
  const rightClavicleAnchor = {
    x: clavicleCenter.x + 0.65 * (rightShoulderPx.x - clavicleCenter.x),
    y: rightShoulderPx.y - 5,
  };
  const leftClavicleAnchor = {
    x: clavicleCenter.x + 0.65 * (leftShoulderPx.x - clavicleCenter.x),
    y: leftShoulderPx.y - 5,
  };

  // Diagonal Paths
  // Path 1 (RHD typical / Kashmir Bus): Right Clavicle -> Left Hip
  // Path 2 (LHD typical): Left Clavicle -> Right Hip
  const pathRHD = {
    start: rightClavicleAnchor,
    end: { ...leftHipPx },
    name: "RHD (Right Clavicle → Left Hip)",
    side: "RHD",
  };

  const pathLHD = {
    start: leftClavicleAnchor,
    end: { ...rightHipPx },
    name: "LHD (Left Clavicle → Right Hip)",
    side: "LHD",
  };

  return {
    landmarks,
    leftShoulderPx,
    rightShoulderPx,
    leftHipPx,
    rightHipPx,
    clavicleCenter,
    hipsCenter,
    shoulderDist,
    torsoRoi,
    pathRHD,
    pathLHD,
    selectedSide: beltSide,
    estimatedTorsoHeight,
  };
}

/**
 * Generates N perpendicular transect segments across a diagonal belt path.
 *
 * @param {Object} startPoint - {x, y}
 * @param {Object} endPoint - {x, y}
 * @param {number} [numTransects=10] - Number of perpendicular scan probes
 * @param {number} [probeLength=180] - Length of each perpendicular probe in pixels
 * @param {number} [startT=0.08] - Start offset percentage (skip near collarbone)
 * @param {number} [endT=0.88] - End offset percentage (skip near buckle/lap)
 * @returns {Array<Object>} Array of transects
 */
export function generatePerpendicularTransects(
  startPoint,
  endPoint,
  numTransects = 10,
  probeLength = 180,
  startT = 0.08,
  endT = 0.88
) {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const len = Math.hypot(dx, dy);

  if (len < 10) return [];

  // Perpendicular unit normal vector: (-uy, ux)
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  const halfProbe = probeLength / 2;
  const transects = [];

  for (let i = 0; i < numTransects; i++) {
    const t = startT + (i / Math.max(1, numTransects - 1)) * (endT - startT);
    const cx = startPoint.x + t * dx;
    const cy = startPoint.y + t * dy;

    transects.push({
      index: i,
      t,
      center: { x: cx, y: cy },
      start: { x: cx - nx * halfProbe, y: cy - ny * halfProbe },
      end: { x: cx + nx * halfProbe, y: cy + ny * halfProbe },
      normal: { x: nx, y: ny },
      probeLength,
    });
  }

  return transects;
}

/**
 * Computes a full-torso tolerance corridor (bounding polygon) around a diagonal belt path.
 *
 * @param {Object} path - { start: {x,y}, end: {x,y} }
 * @param {number} [corridorWidth=180] - Total width of the corridor in pixels
 * @param {Object} [torso=null] - Full torso geometry reference
 * @returns {Object|null}
 */
export function calculateBeltCorridor(path, corridorWidth = 180, torso = null) {
  if (!path || !path.start || !path.end) return null;
  const dx = path.end.x - path.start.x;
  const dy = path.end.y - path.start.y;
  const len = Math.hypot(dx, dy);

  if (len < 10) return null;

  const nx = -dy / len;
  const ny = dx / len;

  const effectiveWidth = torso && torso.shoulderDist
    ? Math.max(corridorWidth, Math.round(torso.shoulderDist * 0.95))
    : corridorWidth;

  const halfW = effectiveWidth / 2;

  const polygon = [
    { x: path.start.x - nx * halfW, y: path.start.y - ny * halfW - 25 },
    { x: path.start.x + nx * halfW, y: path.start.y + ny * halfW - 25 },
    { x: path.end.x + nx * halfW, y: path.end.y + ny * halfW + 20 },
    { x: path.end.x - nx * halfW, y: path.end.y - ny * halfW + 20 },
  ];

  const isPointInside = (px, py) => {
    const dist = Math.abs(dy * px - dx * py + path.end.x * path.start.y - path.end.y * path.start.x) / len;
    if (dist > halfW) return false;

    const t = ((px - path.start.x) * dx + (py - path.start.y) * dy) / (len * len);
    return t >= -0.15 && t <= 1.02;
  };

  return {
    width: effectiveWidth,
    polygon,
    normal: { x: nx, y: ny },
    start: path.start,
    end: path.end,
    isPointInside,
  };
}
