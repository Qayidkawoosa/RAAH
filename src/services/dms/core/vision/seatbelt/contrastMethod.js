// core/vision/seatbelt/contrastMethod.js

/**
 * Method C: Dual-Band Color & Texture Contrast Differential.
 *
 * Samples pixels along the expected or observed diagonal belt path and compares them against
 * adjacent "flank" zones on the driver's chest (left and right of candidate strap).
 *
 * @param {ImageData} imageData
 * @param {Object} path - Expected diagonal path {start, end}
 * @param {Object} options - Tuning options
 * @returns {Object} Method C evaluation result
 */
export function evaluateContrastMethod(imageData, path, options = {}) {
  const {
    numStepPoints = 25,
    flankOffsetPx = 52,
    observedPath = null,
  } = options;

  const { data, width, height } = imageData;

  // Use observed strap line from Method A if present and valid; otherwise fall back to torso path
  const targetPath = (observedPath && observedPath.start && observedPath.end) ? observedPath : path;

  const dx = targetPath.end.x - targetPath.start.x;
  const dy = targetPath.end.y - targetPath.start.y;
  const len = Math.hypot(dx, dy);

  if (len < 20) {
    return { confidence: 0, isFastened: false };
  }

  // Normal unit vector perpendicular to strap
  const nx = -dy / len;
  const ny = dx / len;

  // Flank sampling distance (min 48px to stay safely outside 40-50px wide belt)
  const safeFlankOffset = Math.max(48, Math.round(flankOffsetPx || 52));

  // Sweep candidate transverse offsets [-24, 0, +24] if no observed path is locked
  const candidateOffsets = (observedPath && observedPath.start) ? [0] : [0, -24, 24];

  let bestResult = null;

  for (const lateralShift of candidateOffsets) {
    let strapLumSum = 0;
    let flankLeftLumSum = 0;
    let flankRightLumSum = 0;

    let strapRSum = 0, strapGSum = 0, strapBSum = 0;
    let flankLeftRSum = 0, flankLeftGSum = 0, flankLeftBSum = 0;
    let flankRightRSum = 0, flankRightGSum = 0, flankRightBSum = 0;

    const strapLums = [];
    let validPoints = 0;

    for (let i = 0; i < numStepPoints; i++) {
      const t = 0.20 + (i / (numStepPoints - 1)) * 0.60;
      const cx = targetPath.start.x + t * dx + nx * lateralShift;
      const cy = targetPath.start.y + t * dy + ny * lateralShift;

      const sx = Math.round(cx);
      const sy = Math.round(cy);

      const lx = Math.round(cx - nx * safeFlankOffset);
      const ly = Math.round(cy - ny * safeFlankOffset);

      const rx = Math.round(cx + nx * safeFlankOffset);
      const ry = Math.round(cy + ny * safeFlankOffset);

      if (
        sx >= 0 && sx < width && sy >= 0 && sy < height &&
        lx >= 0 && lx < width && ly >= 0 && ly < height &&
        rx >= 0 && rx < width && ry >= 0 && ry < height
      ) {
        const sIdx = (sy * width + sx) * 4;
        const lIdx = (ly * width + lx) * 4;
        const rIdx = (ry * width + rx) * 4;

        const sLum = 0.299 * data[sIdx] + 0.587 * data[sIdx + 1] + 0.114 * data[sIdx + 2];
        const lLum = 0.299 * data[lIdx] + 0.587 * data[lIdx + 1] + 0.114 * data[lIdx + 2];
        const rLum = 0.299 * data[rIdx] + 0.587 * data[rIdx + 1] + 0.114 * data[rIdx + 2];

        strapLumSum += sLum;
        flankLeftLumSum += lLum;
        flankRightLumSum += rLum;

        strapRSum += data[sIdx];
        strapGSum += data[sIdx + 1];
        strapBSum += data[sIdx + 2];

        flankLeftRSum += data[lIdx];
        flankLeftGSum += data[lIdx + 1];
        flankLeftBSum += data[lIdx + 2];

        flankRightRSum += data[rIdx];
        flankRightGSum += data[rIdx + 1];
        flankRightBSum += data[rIdx + 2];

        strapLums.push(sLum);
        validPoints++;
      }
    }

    if (validPoints < 8) continue;

    const avgStrapLum = strapLumSum / validPoints;
    const avgLeftLum = flankLeftLumSum / validPoints;
    const avgRightLum = flankRightLumSum / validPoints;
    const avgFlankLum = (avgLeftLum + avgRightLum) / 2;

    const lumContrastLeft = Math.abs(avgLeftLum - avgStrapLum) / Math.max(20, (avgLeftLum + avgStrapLum) / 2);
    const lumContrastRight = Math.abs(avgRightLum - avgStrapLum) / Math.max(20, (avgRightLum + avgStrapLum) / 2);
    const lumContrast = Math.max(lumContrastLeft, lumContrastRight) * 0.70 + ((lumContrastLeft + lumContrastRight) / 2) * 0.30;

    const dLeftR = (flankLeftRSum / validPoints) - (strapRSum / validPoints);
    const dLeftG = (flankLeftGSum / validPoints) - (strapGSum / validPoints);
    const dLeftB = (flankLeftBSum / validPoints) - (strapBSum / validPoints);
    const deltaELeft = Math.hypot(dLeftR, dLeftG, dLeftB);

    const dRightR = (flankRightRSum / validPoints) - (strapRSum / validPoints);
    const dRightG = (flankRightGSum / validPoints) - (strapGSum / validPoints);
    const dRightB = (flankRightBSum / validPoints) - (strapBSum / validPoints);
    const deltaERight = Math.hypot(dRightR, dRightG, dRightB);

    const deltaE = Math.max(deltaELeft, deltaERight) * 0.70 + ((deltaELeft + deltaERight) / 2) * 0.30;

    let varianceSum = 0;
    for (const l of strapLums) {
      varianceSum += (l - avgStrapLum) * (l - avgStrapLum);
    }
    const strapStdDev = Math.sqrt(varianceSum / validPoints);
    const uniformityScore = Math.max(0.0, Math.min(1.0, 1.25 - strapStdDev / 36));

    if (lumContrast < 0.08 && deltaE < 12) {
      const candidateRes = {
        methodId: "contrast",
        methodName: "Method C: Dual-Band Color & Texture Contrast",
        confidence: 0,
        isFastened: false,
        avgStrapLum: Math.round(avgStrapLum),
        avgFlankLum: Math.round(avgFlankLum),
        lumContrast: Math.round(lumContrast * 100) / 100,
        deltaE: Math.round(deltaE * 10) / 10,
        strapStdDev: Math.round(strapStdDev * 10) / 10,
        uniformityScore: Math.round(uniformityScore * 100) / 100,
      };
      if (!bestResult) bestResult = candidateRes;
      continue;
    }

    const contrastMagnitude = Math.min(1.0, (lumContrast / 0.28) * 0.65 + (deltaE / 45) * 0.35);
    const confidence = Math.min(1.0, contrastMagnitude * (0.45 + 0.55 * uniformityScore));

    const candidateRes = {
      methodId: "contrast",
      methodName: "Method C: Dual-Band Color & Texture Contrast",
      confidence: Math.round(confidence * 100) / 100,
      isFastened: confidence >= 0.32,
      avgStrapLum: Math.round(avgStrapLum),
      avgFlankLum: Math.round(avgFlankLum),
      lumContrast: Math.round(lumContrast * 100) / 100,
      deltaE: Math.round(deltaE * 10) / 10,
      strapStdDev: Math.round(strapStdDev * 10) / 10,
      uniformityScore: Math.round(uniformityScore * 100) / 100,
      lateralShift,
    };

    if (!bestResult || candidateRes.confidence > bestResult.confidence) {
      bestResult = candidateRes;
    }
  }

  return bestResult || {
    methodId: "contrast",
    methodName: "Method C: Dual-Band Color & Texture Contrast",
    confidence: 0,
    isFastened: false,
    avgStrapLum: 0,
    avgFlankLum: 0,
    lumContrast: 0,
    deltaE: 0,
    strapStdDev: 0,
    uniformityScore: 0,
  };
}
