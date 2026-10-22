export const PHONE_TEMPORAL_STATE = {
  IDLE: "IDLE",
  ACQUIRING: "ACQUIRING",
  CONFIRMED: "CONFIRMED",
};

export const HAND_RELATIONSHIP_STATE = {
  NO_HAND_NEARBY: "NO_HAND_NEARBY",
  HAND_NEAR_PHONE: "HAND_NEAR_PHONE",
  PHONE_HAND_ASSOCIATED: "PHONE_HAND_ASSOCIATED",
};

export const PHONE_REJECTION_REASON = {
  NONE: "ACCEPTED",
  FACE_REGION_OVERLAP: "FACE_REGION_OVERLAP",
};

export const PHONE_INTERACTION_MODE = {
  NONE: "NONE",
  CALLING: "CALLING",
  TEXTING: "TEXTING",
  HOLDING: "HOLDING",
};

/**
 * Calculates Euclidean distance between a 2D point and the nearest edge of an axis-aligned box.
 */
function getDistanceToBox(pt, box) {
  if (!pt || !box) return Infinity;
  const closestX = Math.max(box.originX, Math.min(pt.x, box.originX + box.width));
  const closestY = Math.max(box.originY, Math.min(pt.y, box.originY + box.height));
  const dx = pt.x - closestX;
  const dy = pt.y - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates minimum Euclidean distance from a collection of points to an axis-aligned box.
 * Returns 0 if any point is inside the box.
 */
function getMinDistanceToBox(points, box) {
  if (!points || !Array.isArray(points) || points.length === 0 || !box) return Infinity;
  let minD = Infinity;
  for (const pt of points) {
    if (!pt) continue;
    const d = getDistanceToBox(pt, box);
    if (d < minD) minD = d;
    if (minD === 0) break;
  }
  return minD;
}

/**
 * Calculates rectangular intersection area between two axis-aligned boxes.
 */
function getIntersectionArea(boxA, boxB) {
  const x1 = Math.max(boxA.originX, boxB.originX);
  const y1 = Math.max(boxA.originY, boxB.originY);
  const x2 = Math.min(boxA.originX + boxA.width, boxB.originX + boxB.width);
  const y2 = Math.min(boxA.originY + boxA.height, boxB.originY + boxB.height);

  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

/**
 * Extracts key anatomical face geometry from 478 face landmarks.
 */
function calculateFaceGeometry(landmarks, frameWidth, frameHeight) {
  if (!landmarks || landmarks.length === 0) {
    return {
      hasFace: false,
      faceBox: null,
      eyeBox: null,
      foreheadBox: null,
      centralFaceBox: null,
      midlineX: 0,
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of landmarks) {
    const px = pt.x * frameWidth;
    const py = pt.y * frameHeight;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  const rawHeight = Math.max(1, maxY - minY);
  const faceWidth = Math.max(1, maxX - minX);
  const cranialMargin = rawHeight * 0.25;
  const cranialTopY = Math.max(0, minY - cranialMargin);

  const faceBox = {
    originX: Math.max(0, minX),
    originY: cranialTopY,
    width: faceWidth,
    height: Math.max(1, rawHeight + cranialMargin),
  };

  const getPt = (idx) => {
    const p = landmarks[idx];
    return p ? { x: p.x * frameWidth, y: p.y * frameHeight } : null;
  };

  const noseBridge = getPt(168) || { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const chin = getPt(152) || { x: noseBridge.x, y: maxY };
  const midlineX = noseBridge.x;

  // Eye & Glasses Region
  const eyeIndices = [
    33, 133, 159, 145, 70, 63, 105, 66, 107,
    362, 263, 386, 374, 336, 296, 334, 293, 300,
    168, 6, 197, 195, 5, 4,
  ];

  let eyeMinX = Infinity;
  let eyeMaxX = -Infinity;
  let eyeMinY = Infinity;
  let eyeMaxY = -Infinity;

  for (const idx of eyeIndices) {
    const pt = landmarks[idx];
    if (!pt) continue;
    const px = pt.x * frameWidth;
    const py = pt.y * frameHeight;
    if (px < eyeMinX) eyeMinX = px;
    if (px > eyeMaxX) eyeMaxX = px;
    if (py < eyeMinY) eyeMinY = py;
    if (py > eyeMaxY) eyeMaxY = py;
  }

  const eyePadX = (eyeMaxX - eyeMinX) * 0.08;
  const eyePadY = (eyeMaxY - eyeMinY) * 0.12;

  const eyeBox = {
    originX: Math.max(0, eyeMinX - eyePadX),
    originY: Math.max(0, eyeMinY - eyePadY),
    width: Math.max(1, eyeMaxX - eyeMinX + eyePadX * 2),
    height: Math.max(1, eyeMaxY - eyeMinY + eyePadY * 2),
  };

  // Forehead Cranial Region
  const leftBrowOuter = getPt(70) || { x: eyeMinX, y: eyeMinY };
  const rightBrowOuter = getPt(300) || { x: eyeMaxX, y: eyeMinY };
  const foreheadMinX = Math.min(leftBrowOuter.x, rightBrowOuter.x);
  const foreheadMaxX = Math.max(leftBrowOuter.x, rightBrowOuter.x);

  const foreheadBox = {
    originX: Math.max(0, foreheadMinX),
    originY: cranialTopY,
    width: Math.max(1, foreheadMaxX - foreheadMinX),
    height: Math.max(1, eyeBox.originY + eyeBox.height * 0.35 - cranialTopY),
  };

  // Central Facial Corridor
  const centralHalfWidth = faceWidth * 0.22;
  const centralMinX = Math.max(0, midlineX - centralHalfWidth);
  const centralMaxX = Math.min(frameWidth, midlineX + centralHalfWidth);

  const centralFaceBox = {
    originX: centralMinX,
    originY: eyeBox.originY,
    width: Math.max(1, centralMaxX - centralMinX),
    height: Math.max(1, chin.y - eyeBox.originY),
  };

  // Multi-landmark anatomical ear clusters (covering tragus, preauricular, infra-auricular,
  // helix top, and mandibular angle) on both sides of the face.
  // Left image side (canonical right): tragus 234, preauricular 127, lobule 132, helix 21/54/162, jaw angle 93/58/172/136
  const leftEarIndices = [234, 127, 162, 21, 54, 93, 132, 58, 172, 136];
  // Right image side (canonical left): tragus 454, preauricular 356, lobule 361, helix 251/284/389, jaw angle 323/288/397/365
  const rightEarIndices = [454, 356, 389, 251, 284, 323, 361, 288, 397, 365];

  const leftEarCluster = leftEarIndices.map(getPt).filter(Boolean);
  const rightEarCluster = rightEarIndices.map(getPt).filter(Boolean);

  const leftEar = getPt(234) || leftEarCluster[0] || { x: minX, y: (minY + maxY) / 2 };
  const rightEar = getPt(454) || rightEarCluster[0] || { x: maxX, y: (minY + maxY) / 2 };
  const mouth = getPt(13) || { x: midlineX, y: (minY + maxY) / 2 + rawHeight * 0.25 };

  return {
    hasFace: true,
    faceBox,
    eyeBox,
    foreheadBox,
    centralFaceBox,
    midlineX,
    chin,
    leftEar,
    rightEar,
    leftEarCluster,
    rightEarCluster,
    mouth,
    noseBridge,
  };
}

/**
 * Evaluates spatial relationship between candidate phone box and hands.
 */
function evaluatePhoneHandRelationship(phoneBox, hands, frameDimensions, config = {}) {
  const {
    associationDistThreshold = 0.06,
    proximityDistThreshold = 0.18,
  } = config;

  const frameDiag = Math.sqrt(
    frameDimensions.width * frameDimensions.width +
    frameDimensions.height * frameDimensions.height
  );

  const phoneCenterPx = {
    x: phoneBox.originX + phoneBox.width / 2,
    y: phoneBox.originY + phoneBox.height / 2,
  };

  if (!hands || hands.length === 0) {
    return {
      state: HAND_RELATIONSHIP_STATE.NO_HAND_NEARBY,
      hasHand: false,
      nearestHandedness: null,
      minCenterDistNorm: 1.0,
      landmarksInsideBox: 0,
      phoneCenterPx,
      nearestLandmarkPx: null,
    };
  }

  let minCenterDistPx = Infinity;
  let nearestHandedness = null;
  let nearestLandmarkPx = null;
  let landmarksInsideBox = 0;
  let hasHandBoxIntersection = false;

  for (const hand of hands) {
    // Check bounding box intersection between hand and phone
    if (hand.bbox) {
      const ix1 = Math.max(phoneBox.originX, hand.bbox.originX);
      const iy1 = Math.max(phoneBox.originY, hand.bbox.originY);
      const ix2 = Math.min(phoneBox.originX + phoneBox.width, hand.bbox.originX + hand.bbox.width);
      const iy2 = Math.min(phoneBox.originY + phoneBox.height, hand.bbox.originY + hand.bbox.height);
      if (ix2 > ix1 && iy2 > iy1) {
        hasHandBoxIntersection = true;
      }
    }

    for (const pt of hand.landmarksPx) {
      const dx = pt.x - phoneCenterPx.x;
      const dy = pt.y - phoneCenterPx.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minCenterDistPx) {
        minCenterDistPx = dist;
        nearestHandedness = hand.handedness;
        nearestLandmarkPx = { x: pt.x, y: pt.y };
      }

      if (
        pt.x >= phoneBox.originX &&
        pt.x <= phoneBox.originX + phoneBox.width &&
        pt.y >= phoneBox.originY &&
        pt.y <= phoneBox.originY + phoneBox.height
      ) {
        landmarksInsideBox++;
      }
    }
  }

  const minCenterDistNorm = Number((minCenterDistPx / frameDiag).toFixed(3));

  let state = HAND_RELATIONSHIP_STATE.NO_HAND_NEARBY;
  // A hand is confirmed associated with the phone if:
  // 1. One or more hand landmarks are physically inside the phone box
  // 2. OR the hand bounding box directly overlaps the phone box
  // 3. OR the hand center/wrist is within close grip distance (associationDistThreshold)
  if (landmarksInsideBox >= 1 || (hasHandBoxIntersection && minCenterDistNorm <= 0.14) || minCenterDistNorm <= associationDistThreshold) {
    state = HAND_RELATIONSHIP_STATE.PHONE_HAND_ASSOCIATED;
  } else if (minCenterDistNorm <= proximityDistThreshold) {
    state = HAND_RELATIONSHIP_STATE.HAND_NEAR_PHONE;
  }

  return {
    state,
    hasHand: true,
    nearestHandedness,
    minCenterDistNorm,
    landmarksInsideBox,
    hasHandBoxIntersection,
    phoneCenterPx,
    nearestLandmarkPx,
  };
}

/**
 * Classifies phone interaction into CALLING, TEXTING, or HOLDING.
 * Enforces strict hierarchy: PHONE MUST FIRST BE CONFIRMED IN HAND.
 */
export function evaluatePhoneInteractionMode({
  candidate,
  faceGeom,
  headPose,
  blendshapes,
  handRelationship,
  frameWidth = 640,
  frameHeight = 480,
}) {
  if (!candidate) {
    return {
      mode: PHONE_INTERACTION_MODE.NONE,
      modeReason: "No phone candidate",
      isCalling: false,
      isTexting: false,
      isHandAssociated: false,
      earDistancePx: null,
      activeEar: null,
    };
  }

  // =========================================================================
  // STEP 1: STRICT VERIFICATION — PHONE MUST BE DETECTED IN HAND
  // =========================================================================
  const isHandAssociated = Boolean(
    handRelationship?.hasHand && (
      handRelationship.state === HAND_RELATIONSHIP_STATE.PHONE_HAND_ASSOCIATED ||
      handRelationship.landmarksInsideBox >= 1 ||
      handRelationship.hasHandBoxIntersection ||
      (handRelationship.state === HAND_RELATIONSHIP_STATE.HAND_NEAR_PHONE && handRelationship.minCenterDistNorm <= 0.12)
    )
  );

  // If phone is NOT held in hand (e.g. mounted in phone cradle, on dashboard, or unheld):
  // Strictly prevent CALLING, TEXTING, or HOLDING classification!
  if (!isHandAssociated) {
    return {
      mode: PHONE_INTERACTION_MODE.NONE,
      modeReason: "Phone detected, but not held in hand (in mount or cradle)",
      isCalling: false,
      isTexting: false,
      isHandAssociated: false,
      earDistancePx: null,
      activeEar: null,
    };
  }

  // =========================================================================
  // STEP 2: PHONE IS CONFIRMED IN HAND -> NOW CLASSIFY CALLING vs TEXTING vs HOLDING
  // =========================================================================
  const box = candidate.box;
  const phoneCenterX = box.originX + box.width / 2;
  const phoneCenterY = box.originY + box.height / 2;

  // 1. Evaluate Calling Mode (Phone held in hand against either ear with raised hand)
  if (faceGeom && faceGeom.hasFace) {
    const faceWidth = Math.max(1, faceGeom.faceBox.width);
    const faceHeight = Math.max(1, faceGeom.faceBox.height);

    // Multi-point ear cluster distance: checks distance from candidate box to ANY anatomical ear/jaw landmark
    const distLeft = faceGeom.leftEarCluster && faceGeom.leftEarCluster.length > 0
      ? getMinDistanceToBox(faceGeom.leftEarCluster, box)
      : getDistanceToBox(faceGeom.leftEar, box);

    const distRight = faceGeom.rightEarCluster && faceGeom.rightEarCluster.length > 0
      ? getMinDistanceToBox(faceGeom.rightEarCluster, box)
      : getDistanceToBox(faceGeom.rightEar, box);

    const minEarDist = Math.min(distLeft, distRight);
    // Landmark 234 cluster is image-left; Landmark 454 cluster is image-right.
    const activeEar = distLeft <= distRight ? "LEFT_EAR" : "RIGHT_EAR";

    // Proximity to ear: within 65% of face width or <= 95px (reliable across distances & phone sizes)
    const isCloseToEar = minEarDist <= Math.max(95, faceWidth * 0.65);

    // Vertically aligned between temple/eye level and lower jaw/chin
    const eyeTopY = faceGeom.eyeBox ? faceGeom.eyeBox.originY : (faceGeom.chin.y - faceHeight * 0.75);
    const chinY = faceGeom.chin?.y || (eyeTopY + faceHeight * 0.75);

    const isCenterInBand =
      phoneCenterY >= eyeTopY - faceHeight * 0.35 &&
      phoneCenterY <= chinY + faceHeight * 0.45;
    const isBoxOverlappingEar =
      box.originY <= chinY + faceHeight * 0.35 &&
      box.originY + box.height >= eyeTopY - faceHeight * 0.25;

    const isVerticalEarBand = isCenterInBand && isBoxOverlappingEar;

    // Laterally displaced from face midline OR directly in contact with the ear region
    const isLateral =
      Math.abs(phoneCenterX - faceGeom.midlineX) >= faceWidth * 0.14 ||
      minEarDist <= Math.max(65, faceWidth * 0.40);

    // Verify holding hand is raised to ear/head level (not down at steering wheel/lap)
    const handY = handRelationship.nearestLandmarkPx ? handRelationship.nearestLandmarkPx.y : phoneCenterY;
    const isHandRaisedToEar = handY <= chinY + faceHeight * 0.45;

    if (isCloseToEar && isVerticalEarBand && isLateral && isHandRaisedToEar) {
      return {
        mode: PHONE_INTERACTION_MODE.CALLING,
        modeReason: `Driver holding phone to ${activeEar === "LEFT_EAR" ? "left" : "right"} ear (${Math.round(minEarDist)}px proximity)`,
        isCalling: true,
        isTexting: false,
        isHandAssociated: true,
        earDistancePx: Math.round(minEarDist),
        activeEar,
      };
    }
  }

  // 2. Evaluate Texting / Screen Viewing Mode (Hand holding phone low + Downward Head/Gaze Tilt)
  const chinY = faceGeom?.chin?.y || frameHeight * 0.45;
  const mouthY = faceGeom?.mouth?.y || frameHeight * 0.40;

  // Phone is positioned in chest/steering/lap area (below mouth or chin)
  const isPhoneLow = phoneCenterY >= chinY - 15 || box.originY >= mouthY || phoneCenterY >= frameHeight * 0.50;

  // Downward head pitch (< -5°) or downward eye gaze blendshapes (> 0.20)
  const pitch = headPose?.pitch ?? 0;
  const isDownwardPitch = pitch < -5.0;
  const isDownwardGaze =
    (blendshapes?.eyeLookDownLeft || 0) > 0.20 ||
    (blendshapes?.eyeLookDownRight || 0) > 0.20 ||
    headPose?.direction === "DOWN" ||
    headPose?.direction === "DOWN_LEFT" ||
    headPose?.direction === "DOWN_RIGHT" ||
    headPose?.direction === "GAZE_DOWN";

  if (isPhoneLow && (isDownwardPitch || isDownwardGaze)) {
    return {
      mode: PHONE_INTERACTION_MODE.TEXTING,
      modeReason: `Driver holding phone low with downward head tilt (${pitch.toFixed(1)}°) and gaze off road`,
      isCalling: false,
      isTexting: true,
      isHandAssociated: true,
      earDistancePx: null,
      activeEar: null,
    };
  }

  // 3. Fallback: Phone in Hand (Active grip looking ahead)
  return {
    mode: PHONE_INTERACTION_MODE.HOLDING,
    modeReason: "Driver holding phone in hand (looking ahead)",
    isCalling: false,
    isTexting: false,
    isHandAssociated: true,
    earDistancePx: null,
    activeEar: null,
  };
}

/**
 * Creates the production Phone Detector Engine.
 *
 * @param {Object} [options]
 * @param {number} [options.confirmationTimeMs=1000] - Duration required to confirm phone (ms)
 * @param {number} [options.callingConfirmationMs=1000]
 * @param {number} [options.textingConfirmationMs=1800]
 * @param {number} [options.holdingConfirmationMs=2200]
 * @param {number} [options.dropoutToleranceMs=750] - Duration to bridge single-frame dropouts (ms)
 * @param {number} [options.associationDistThreshold=0.10]
 * @param {number} [options.proximityDistThreshold=0.22]
 */
export function createPhoneDetectorEngine(options = {}) {
  const tieredConfirmationMs = {
    CALLING: options.callingConfirmationMs ?? 1000,
    TEXTING: options.textingConfirmationMs ?? 1800,
    HOLDING: options.holdingConfirmationMs ?? 2200,
  };
  const dropoutToleranceMs = options.dropoutToleranceMs ?? 750;

  const handConfig = {
    associationDistThreshold: options.associationDistThreshold ?? 0.10,
    proximityDistThreshold: options.proximityDistThreshold ?? 0.22,
  };

  // Temporal Tracking State
  let temporalState = PHONE_TEMPORAL_STATE.IDLE;
  let startTimeMs = 0;
  let lastSeenMs = 0;
  let activeDurationMs = 0;
  let isConfirmed = false;
  let lastCandidate = null;

  // Interaction Mode State
  let currentMode = PHONE_INTERACTION_MODE.NONE;
  let modeReason = "";
  let lastModeTimestamp = 0;
  let lastActiveEar = null;
  let lastEarDist = null;

  return {
    processFrame({
      rawPhones = [],
      faceLandmarks = null,
      headPose = null,
      blendshapes = null,
      hands = [],
      frameWidth = 640,
      frameHeight = 480,
      timestamp = performance.now(),
    }) {
      const faceGeom = calculateFaceGeometry(faceLandmarks, frameWidth, frameHeight);

      // 1. Spatial Anatomical Rejection Filtering
      const accepted = [];
      const rejected = [];

      for (const phone of rawPhones) {
        const box = phone.box;
        const phoneArea = Math.max(1, box.width * box.height);
        const phoneCenterX = box.originX + box.width / 2;
        const phoneCenterY = box.originY + box.height / 2;

        const longDim = Math.max(box.width, box.height);
        const shortDim = Math.max(1, Math.min(box.width, box.height));
        const aspectRatio = Number((longDim / shortDim).toFixed(2));

        let observedSizeRatio = 0;
        if (faceGeom.hasFace && faceGeom.faceBox && faceGeom.faceBox.width > 0) {
          observedSizeRatio = Number((box.width / faceGeom.faceBox.width).toFixed(3));
        } else {
          observedSizeRatio = Number((box.width / frameWidth).toFixed(3));
        }

        let rejectionReason = PHONE_REJECTION_REASON.NONE;
        let subReason = null;

        if (faceGeom.hasFace && faceGeom.faceBox) {
          const faceWidth = faceGeom.faceBox.width;
          const distEarL = faceGeom.leftEarCluster?.length
            ? getMinDistanceToBox(faceGeom.leftEarCluster, box)
            : getDistanceToBox(faceGeom.leftEar, box);
          const distEarR = faceGeom.rightEarCluster?.length
            ? getMinDistanceToBox(faceGeom.rightEarCluster, box)
            : getDistanceToBox(faceGeom.rightEar, box);

          const isLateralEarArea =
            phoneCenterX < faceGeom.midlineX - faceWidth * 0.20 ||
            phoneCenterX > faceGeom.midlineX + faceWidth * 0.20 ||
            distEarL <= Math.max(90, faceWidth * 0.60) ||
            distEarR <= Math.max(90, faceWidth * 0.60);

          // Eye / Glasses Region: Only reject if NOT in lateral ear calling area!
          // Glasses sit directly across the eyes centered on the face, not against the ears.
          if (faceGeom.eyeBox && !isLateralEarArea) {
            const eyeIntersection = getIntersectionArea(box, faceGeom.eyeBox);
            const eyeArea = Math.max(1, faceGeom.eyeBox.width * faceGeom.eyeBox.height);
            const eyeOverlapRatio = Number((eyeIntersection / phoneArea).toFixed(3));
            const eyeCoveredRatio = Number((eyeIntersection / eyeArea).toFixed(3));

            const isCenterInEyeBox =
              phoneCenterX >= faceGeom.eyeBox.originX &&
              phoneCenterX <= faceGeom.eyeBox.originX + faceGeom.eyeBox.width &&
              phoneCenterY >= faceGeom.eyeBox.originY &&
              phoneCenterY <= faceGeom.eyeBox.originY + faceGeom.eyeBox.height;

            if (eyeOverlapRatio >= 0.25 || eyeCoveredRatio >= 0.30 || isCenterInEyeBox) {
              rejectionReason = PHONE_REJECTION_REASON.FACE_REGION_OVERLAP;
              subReason = "EYE_GLASSES_REGION";
            }
          }

          // Forehead Cranial Vault
          if (rejectionReason === PHONE_REJECTION_REASON.NONE && faceGeom.foreheadBox) {
            const foreheadIntersection = getIntersectionArea(box, faceGeom.foreheadBox);
            const foreheadOverlapRatio = Number((foreheadIntersection / phoneArea).toFixed(3));

            const isCenterInForeheadBox =
              phoneCenterX >= faceGeom.foreheadBox.originX &&
              phoneCenterX <= faceGeom.foreheadBox.originX + faceGeom.foreheadBox.width &&
              phoneCenterY >= faceGeom.foreheadBox.originY &&
              phoneCenterY <= faceGeom.foreheadBox.originY + faceGeom.foreheadBox.height;

            if (!isLateralEarArea && (foreheadOverlapRatio >= 0.45 || isCenterInForeheadBox)) {
              rejectionReason = PHONE_REJECTION_REASON.FACE_REGION_OVERLAP;
              subReason = "FOREHEAD_CRANIAL_REGION";
            }
          }

          // Central Facial Cylinder
          if (rejectionReason === PHONE_REJECTION_REASON.NONE && faceGeom.centralFaceBox && !isLateralEarArea) {
            const centralIntersection = getIntersectionArea(box, faceGeom.centralFaceBox);
            const centralOverlapRatio = Number((centralIntersection / phoneArea).toFixed(3));

            const isCenterInCentralFace =
              phoneCenterX >= faceGeom.centralFaceBox.originX &&
              phoneCenterX <= faceGeom.centralFaceBox.originX + faceGeom.centralFaceBox.width &&
              phoneCenterY >= faceGeom.centralFaceBox.originY &&
              phoneCenterY <= faceGeom.centralFaceBox.originY + faceGeom.centralFaceBox.height;

            if (centralOverlapRatio >= 0.60 || (isCenterInCentralFace && centralOverlapRatio >= 0.40)) {
              rejectionReason = PHONE_REJECTION_REASON.FACE_REGION_OVERLAP;
              subReason = "CENTRAL_FACIAL_REGION";
            }
          }
        }

        const enrichedPhone = {
          ...phone,
          aspectRatio,
          observedSizeRatio,
          rejectionReason,
          subReason,
        };

        if (rejectionReason === PHONE_REJECTION_REASON.NONE) {
          accepted.push(enrichedPhone);
        } else {
          rejected.push(enrichedPhone);
        }
      }

      // 2. Hand Association for Accepted Candidates
      let primaryCandidate = accepted[0] || null;
      let handRelationship = null;

      if (primaryCandidate) {
        handRelationship = evaluatePhoneHandRelationship(
          primaryCandidate.box,
          hands,
          { width: frameWidth, height: frameHeight },
          handConfig
        );
        primaryCandidate.handRelationship = handRelationship;
      }

      const isHandAssociated = handRelationship?.state === HAND_RELATIONSHIP_STATE.PHONE_HAND_ASSOCIATED;

      // Determine dropout bridging state before mode evaluation
      let isDropoutBridged = false;
      if (!primaryCandidate && temporalState !== PHONE_TEMPORAL_STATE.IDLE) {
        const timeSinceLastSeen = timestamp - lastSeenMs;
        if (timeSinceLastSeen <= dropoutToleranceMs) {
          isDropoutBridged = true;
        }
      }

      // 4. Interaction Mode Classification (Calling vs Texting vs Holding)
      const rawModeResult = evaluatePhoneInteractionMode({
        candidate: primaryCandidate || (isDropoutBridged ? lastCandidate : null),
        faceGeom,
        headPose,
        blendshapes,
        handRelationship,
        frameWidth,
        frameHeight,
      });

      if (rawModeResult.mode !== PHONE_INTERACTION_MODE.NONE) {
        if (rawModeResult.mode === PHONE_INTERACTION_MODE.CALLING || rawModeResult.mode === PHONE_INTERACTION_MODE.TEXTING) {
          currentMode = rawModeResult.mode;
          modeReason = rawModeResult.modeReason;
          lastModeTimestamp = timestamp;
          lastActiveEar = rawModeResult.activeEar;
          lastEarDist = rawModeResult.earDistancePx;
        } else {
          // HOLDING: only transition from CALLING or TEXTING if 400ms hold expired
          if (timestamp - lastModeTimestamp > 400) {
            currentMode = rawModeResult.mode;
            modeReason = rawModeResult.modeReason;
            lastActiveEar = null;
            lastEarDist = null;
          }
        }
      } else {
        currentMode = PHONE_INTERACTION_MODE.NONE;
        modeReason = "";
        lastActiveEar = null;
        lastEarDist = null;
      }

      const effectiveMode = primaryCandidate || isDropoutBridged ? currentMode : PHONE_INTERACTION_MODE.NONE;

      // Tiered Confirmation Threshold (Option A): Calling: 1.5s, Texting: 2.0s, Holding: 2.5s
      const targetConfirmationMs =
        tieredConfirmationMs[effectiveMode] || tieredConfirmationMs.HOLDING;

      // 5. Temporal Windowing Tracking with Tiered Grace Period
      // STRICT REQUIREMENT: Only track confirmation if phone is confirmed in hand!
      const isCandidateInHand = Boolean(
        primaryCandidate &&
        isHandAssociated &&
        effectiveMode !== PHONE_INTERACTION_MODE.NONE
      );

      if (isCandidateInHand) {
        lastCandidate = primaryCandidate;

        if (temporalState === PHONE_TEMPORAL_STATE.IDLE) {
          startTimeMs = timestamp;
          lastSeenMs = timestamp;
          activeDurationMs = 0;
          temporalState = PHONE_TEMPORAL_STATE.ACQUIRING;
          isConfirmed = false;
        } else {
          lastSeenMs = timestamp;
          activeDurationMs = timestamp - startTimeMs;

          if (activeDurationMs >= targetConfirmationMs) {
            temporalState = PHONE_TEMPORAL_STATE.CONFIRMED;
            isConfirmed = true;
          } else {
            temporalState = PHONE_TEMPORAL_STATE.ACQUIRING;
            isConfirmed = false;
          }
        }
      } else {
        // Candidate absent or released from hand
        if (temporalState !== PHONE_TEMPORAL_STATE.IDLE) {
          const timeSinceLastSeen = timestamp - lastSeenMs;

          if (timeSinceLastSeen <= dropoutToleranceMs && isHandAssociated) {
            // Gap bridging active
            isDropoutBridged = true;
            activeDurationMs = timestamp - startTimeMs;
            if (activeDurationMs >= targetConfirmationMs) {
              temporalState = PHONE_TEMPORAL_STATE.CONFIRMED;
              isConfirmed = true;
            }
          } else {
            // Expired or released: reset tracker
            temporalState = PHONE_TEMPORAL_STATE.IDLE;
            startTimeMs = 0;
            lastSeenMs = 0;
            activeDurationMs = 0;
            isConfirmed = false;
            lastCandidate = null;
          }
        }
      }

      return {
        hasPhoneCandidate: !!primaryCandidate,
        isConfirmed: isConfirmed && isHandAssociated,
        isHandAssociated,
        isDropoutBridged,
        state: isHandAssociated ? temporalState : PHONE_TEMPORAL_STATE.IDLE,
        mode: isHandAssociated ? effectiveMode : PHONE_INTERACTION_MODE.NONE,
        modeReason: isHandAssociated
          ? (effectiveMode !== PHONE_INTERACTION_MODE.NONE ? modeReason : "Driver holding phone")
          : (primaryCandidate ? "Phone detected, but not held in hand (in mount/cradle)" : "No phone detected"),
        activeEar: isHandAssociated ? lastActiveEar : null,
        earDistancePx: isHandAssociated ? lastEarDist : null,
        activeDurationMs: isHandAssociated ? Math.round(activeDurationMs) : 0,
        targetConfirmationMs,
        progress: isHandAssociated ? Math.min(1.0, Number((activeDurationMs / targetConfirmationMs).toFixed(2))) : 0,
        candidate: primaryCandidate || (isDropoutBridged ? lastCandidate : null),
        handRelationship,
        rejected,
        faceGeom,
      };
    },

    reset() {
      temporalState = PHONE_TEMPORAL_STATE.IDLE;
      startTimeMs = 0;
      lastSeenMs = 0;
      activeDurationMs = 0;
      isConfirmed = false;
      lastCandidate = null;
      currentMode = PHONE_INTERACTION_MODE.NONE;
      modeReason = "";
      lastModeTimestamp = 0;
      lastActiveEar = null;
      lastEarDist = null;
    },
  };
}
