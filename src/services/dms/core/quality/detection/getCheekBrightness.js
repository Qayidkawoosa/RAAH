// core/quality/detection/getCheekBrightness.js

import { getBrightness } from "./getBrightness.js";

export function cheekPoints(faceLM) {
  if (!faceLM?.length) {
    return [
      { x: 0.42, y: 0.58 },
      { x: 0.58, y: 0.58 },
    ];
  }

  return [
    faceLM[205] || faceLM[187] || faceLM[0],
    faceLM[425] || faceLM[411] || faceLM[0],
  ];
}

export const getCheekBrightness = (
  pctx,
  landmarks,
  canvasWidth,
  canvasHeight,
) => {
  // --------------------------------
  // GET CHEEK LANDMARKS
  // --------------------------------
  const [leftCheek, rightCheek] = cheekPoints(landmarks);

  const leftX = Math.floor(leftCheek.x * canvasWidth);
  const leftY = Math.floor(leftCheek.y * canvasHeight);
  const rightX = Math.floor(rightCheek.x * canvasWidth);
  const rightY = Math.floor(rightCheek.y * canvasHeight);

  // --------------------------------
  // SAMPLE REGION
  // --------------------------------
  const boxSize = 18;
  const halfBox = Math.floor(boxSize / 2);

  const leftBoxX = leftX - halfBox;
  const leftBoxY = leftY - halfBox;
  const rightBoxX = rightX - halfBox;
  const rightBoxY = rightY - halfBox;

  // --------------------------------
  // SAFE CLAMPING
  // --------------------------------
  const safeLeftBoxX = Math.max(0, Math.min(leftBoxX, canvasWidth - boxSize));
  const safeLeftBoxY = Math.max(0, Math.min(leftBoxY, canvasHeight - boxSize));
  const safeRightBoxX = Math.max(0, Math.min(rightBoxX, canvasWidth - boxSize));
  const safeRightBoxY = Math.max(0, Math.min(rightBoxY, canvasHeight - boxSize));

  // --------------------------------
  // GET IMAGE REGIONS
  // --------------------------------
  const leftCheekRegion = pctx.getImageData(
    safeLeftBoxX,
    safeLeftBoxY,
    boxSize,
    boxSize,
  );

  const rightCheekRegion = pctx.getImageData(
    safeRightBoxX,
    safeRightBoxY,
    boxSize,
    boxSize,
  );

  // --------------------------------
  // BRIGHTNESS
  // --------------------------------
  const leftBrightness = getBrightness(leftCheekRegion);
  const rightBrightness = getBrightness(rightCheekRegion);

  // --------------------------------
  // STABILIZE EXTREMES
  // --------------------------------
  const adjustedLeft = Math.max(leftBrightness, 25);
  const adjustedRight = Math.max(rightBrightness, 25);

  // --------------------------------
  // DIFFERENCE
  // --------------------------------
  const lightingDifference = Math.abs(adjustedLeft - adjustedRight);
  const avg = (adjustedLeft + adjustedRight) / 2;
  let lightingDifferencePercent = (lightingDifference / avg) * 100;

  // --------------------------------
  // CLAMP
  // --------------------------------
  lightingDifferencePercent = Math.min(lightingDifferencePercent, 100);

  return {
    leftBrightness: adjustedLeft,
    rightBrightness: adjustedRight,
    lightingDifference,
    lightingDifferencePercent,
  };
};
