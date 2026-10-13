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

  const leftEar = getPt(234) || { x: minX, y: (minY + maxY) / 2 };
  const rightEar = getPt(454) || { x: maxX, y: (minY + maxY) / 2 };
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

  for (const hand of hands) {
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
  if (landmarksInsideBox >= 2 || minCenterDistNorm <= associationDistThreshold) {
    state = HAND_RELATIONSHIP_STATE.PHONE_HAND_ASSOCIATED;
  } else if (landmarksInsideBox >= 1 || minCenterDistNorm <= proximityDistThreshold) {
    state = HAND_RELATIONSHIP_STATE.HAND_NEAR_PHONE;
  }

  return {
    state,
    hasHand: true,
    nearestHandedness,
    minCenterDistNorm,
    landmarksInsideBox,
    phoneCenterPx,
    nearestLandmarkPx,
  };
}

/**
 * Classifies phone interaction into CALLING, TEXTING, or HOLDING.
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
      earDistancePx: null,
      activeEar: null,
    };
  }

  const box = candidate.box;
  const phoneCenterX = box.originX + box.width / 2;
  const phoneCenterY = box.originY + box.height / 2;

  // 1. Evaluate Calling Mode (Phone held to ear, lateral offset, ear-to-jaw height)
  if (faceGeom && faceGeom.hasFace) {
    const faceWidth = Math.max(1, faceGeom.faceBox.width);
    const faceHeight = Math.max(1, faceGeom.faceBox.height);

    const distLeft = getDistanceToBox(faceGeom.leftEar, box);
    const distRight = getDistanceToBox(faceGeom.rightEar, box);
    const minEarDist = Math.min(distLeft, distRight);
    const activeEar = distLeft < distRight ? "LEFT_EAR" : "RIGHT_EAR";

    // Proximity to ear: within 55% of face width or <= 80px
    const isCloseToEar = minEarDist <= Math.max(80, faceWidth * 0.55);

    // Vertically aligned between eye level and lower jaw
    const isVerticalEarBand =
      phoneCenterY >= faceGeom.eyeBox.originY - faceHeight * 0.25 &&
      phoneCenterY <= faceGeom.chin.y + faceHeight * 0.35;

    // Laterally displaced from face midline
    const isLateral = Math.abs(phoneCenterX - faceGeom.midlineX) >= faceWidth * 0.18;

    if (isCloseToEar && isVerticalEarBand && isLateral) {
      return {
        mode: PHONE_INTERACTION_MODE.CALLING,
        modeReason: `Phone held to ${activeEar === "LEFT_EAR" ? "left" : "right"} ear (${Math.round(minEarDist)}px proximity)`,
        isCalling: true,
        isTexting: false,
        earDistancePx: Math.round(minEarDist),
        activeEar,
      };
    }
  }

  // 2. Evaluate Texting / Screen Viewing Mode (Low Phone Position + Downward Head/Gaze Tilt)
  const isHandAssociated = handRelationship?.state === HAND_RELATIONSHIP_STATE.PHONE_HAND_ASSOCIATED;
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

  if (isPhoneLow && (isDownwardPitch || isDownwardGaze) && isHandAssociated) {
    return {
      mode: PHONE_INTERACTION_MODE.TEXTING,
      modeReason: `Phone held low with downward head tilt (${pitch.toFixed(1)}°) and gaze off road`,
      isCalling: false,
      isTexting: true,
      earDistancePx: null,
      activeEar: null,
    };
  }

  // 3. Fallback: In-Hand Holding (Active grip without calling or downward texting posture)
  if (isHandAssociated) {
    return {
      mode: PHONE_INTERACTION_MODE.HOLDING,
      modeReason: "Driver holding phone in hand (looking ahead)",
      isCalling: false,
      isTexting: false,
      earDistancePx: null,
      activeEar: null,
    };
  }

  return {
    mode: PHONE_INTERACTION_MODE.HOLDING,
    modeReason: "Phone candidate present without confirmed hand grip",
    isCalling: false,
    isTexting: false,
    earDistancePx: null,
    activeEar: null,
  };
}

/**
 * Creates the production Phone Detector Engine.
 *
 * @param {Object} [options]
 * @param {number} [options.confirmationTimeMs=1000] - Duration required to confirm phone (ms)
 * @param {number} [options.dropoutToleranceMs=400] - Duration to bridge single-frame dropouts (ms)
 * @param {number} [options.associationDistThreshold=0.06]
 * @param {number} [options.proximityDistThreshold=0.18]
 */
export function createPhoneDetectorEngine(options = {}) {
  const tieredConfirmationMs = {
    CALLING: options.callingConfirmationMs ?? 1500,
    TEXTING: options.textingConfirmationMs ?? 2000,
    HOLDING: options.holdingConfirmationMs ?? 2500,
  };
  const dropoutToleranceMs = options.dropoutToleranceMs ?? 400;

  const handConfig = {
    associationDistThreshold: options.associationDistThreshold ?? 0.06,
    proximityDistThreshold: options.proximityDistThreshold ?? 0.18,
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
          const isLateralEarArea =
            phoneCenterX < faceGeom.midlineX - faceWidth * 0.25 ||
            phoneCenterX > faceGeom.midlineX + faceWidth * 0.25;

          // Eye / Glasses Region
          if (faceGeom.eyeBox) {
            const eyeIntersection = getIntersectionArea(box, faceGeom.eyeBox);
            const eyeArea = Math.max(1, faceGeom.eyeBox.width * faceGeom.eyeBox.height);
            const eyeOverlapRatio = Number((eyeIntersection / phoneArea).toFixed(3));
            const eyeCoveredRatio = Number((eyeIntersection / eyeArea).toFixed(3));

            const isCenterInEyeBox =
              phoneCenterX >= faceGeom.eyeBox.originX &&
              phoneCenterX <= faceGeom.eyeBox.originX + faceGeom.eyeBox.width &&
              phoneCenterY >= faceGeom.eyeBox.originY &&
              phoneCenterY <= faceGeom.eyeBox.originY + faceGeom.eyeBox.height;

            if (eyeOverlapRatio >= 0.20 || eyeCoveredRatio >= 0.25 || isCenterInEyeBox) {
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
      if (primaryCandidate) {
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
        // Candidate absent in current frame
        if (temporalState !== PHONE_TEMPORAL_STATE.IDLE) {
          const timeSinceLastSeen = timestamp - lastSeenMs;

          if (timeSinceLastSeen <= dropoutToleranceMs) {
            // Gap bridging active
            isDropoutBridged = true;
            activeDurationMs = timestamp - startTimeMs;
            if (activeDurationMs >= targetConfirmationMs) {
              temporalState = PHONE_TEMPORAL_STATE.CONFIRMED;
              isConfirmed = true;
            }
          } else {
            // Expired: reset tracker
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
        isConfirmed,
        isHandAssociated,
        isDropoutBridged,
        state: temporalState,
        mode: effectiveMode,
        modeReason: effectiveMode !== PHONE_INTERACTION_MODE.NONE ? modeReason : "No phone candidate",
        activeEar: lastActiveEar,
        earDistancePx: lastEarDist,
        activeDurationMs: Math.round(activeDurationMs),
        targetConfirmationMs,
        progress: Math.min(1.0, Number((activeDurationMs / targetConfirmationMs).toFixed(2))),
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
