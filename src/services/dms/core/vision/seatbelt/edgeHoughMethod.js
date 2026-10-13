// core/vision/seatbelt/edgeHoughMethod.js

/**
 * Method B: Torso ROI Sobel Edge Orientation & Parallel Edge-Pair Hough Transform.
 *
 * @param {ImageData} imageData - Full frame image data
 * @param {Object} torsoRoi - {x, y, width, height}
 * @param {Object} path - Expected diagonal path {start, end, side}
 * @param {Object} options - Tuning options
 * @returns {Object} Method B evaluation result
 */
export function evaluateEdgeHoughMethod(imageData, torsoRoi, path, options = {}) {
  const {
    edgeThreshold = 28,
    angleToleranceDeg = 18,
    downsample = 2,
  } = options;

  if (!torsoRoi || torsoRoi.width < 40 || torsoRoi.height < 40) {
    return {
      confidence: 0,
      isFastened: false,
      evidenceType: "NO_COHERENT_EDGES",
      details: "Invalid torso ROI",
    };
  }

  const { data, width: fullW, height: fullH } = imageData;

  // Expected diagonal angle in degrees
  const dx = path.end.x - path.start.x;
  const dy = path.end.y - path.start.y;
  const expectedBeltAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  // The gradient of the edge is perpendicular to the line:
  const expectedGradientAngleDeg = (expectedBeltAngleDeg + 90 + 360) % 180;

  // Sample Torso ROI with downsampling for performance
  const roiW = Math.floor(torsoRoi.width / downsample);
  const roiH = Math.floor(torsoRoi.height / downsample);

  if (roiW < 15 || roiH < 15) {
    return {
      confidence: 0,
      isFastened: false,
      evidenceType: "NO_COHERENT_EDGES",
    };
  }

  // Extract luminance grid for ROI
  const lum = new Float32Array(roiW * roiH);
  for (let ry = 0; ry < roiH; ry++) {
    const srcY = Math.min(fullH - 1, torsoRoi.y + ry * downsample);
    for (let rx = 0; rx < roiW; rx++) {
      const srcX = Math.min(fullW - 1, torsoRoi.x + rx * downsample);
      const idx = (srcY * fullW + srcX) * 4;
      lum[ry * roiW + rx] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
  }

  // Hough Accumulator Setup
  const thetaBins = 21;
  const maxRho = Math.hypot(roiW, roiH);
  const rhoStep = 2.0;
  const rhoBins = Math.ceil((2 * maxRho) / rhoStep);

  const accumulator = new Int32Array(thetaBins * rhoBins);
  const accPosPolarity = new Int16Array(thetaBins * rhoBins);
  const accNegPolarity = new Int16Array(thetaBins * rhoBins);

  const normalAngleDeg = expectedGradientAngleDeg;
  const minTheta = (normalAngleDeg - angleToleranceDeg) * (Math.PI / 180);
  const maxTheta = (normalAngleDeg + angleToleranceDeg) * (Math.PI / 180);
  const thetaStep = (maxTheta - minTheta) / (thetaBins - 1 || 1);

  const cosTable = new Float32Array(thetaBins);
  const sinTable = new Float32Array(thetaBins);
  for (let tb = 0; tb < thetaBins; tb++) {
    const theta = minTheta + tb * thetaStep;
    cosTable[tb] = Math.cos(theta);
    sinTable[tb] = Math.sin(theta);
  }

  const expectedLineLength = Math.min(roiW, roiH) * 0.72;

  let matchingEdgeCount = 0;
  let totalEdgeCount = 0;
  const edgePoints = [];

  for (let y = 1; y < roiH - 1; y++) {
    for (let x = 1; x < roiW - 1; x++) {
      const gx =
        -lum[(y - 1) * roiW + (x - 1)] + lum[(y - 1) * roiW + (x + 1)] +
        -2 * lum[y * roiW + (x - 1)]   + 2 * lum[y * roiW + (x + 1)] +
        -lum[(y + 1) * roiW + (x - 1)] + lum[(y + 1) * roiW + (x + 1)];

      const gy =
        -lum[(y - 1) * roiW + (x - 1)] - 2 * lum[(y - 1) * roiW + x] - lum[(y - 1) * roiW + (x + 1)] +
         lum[(y + 1) * roiW + (x - 1)] + 2 * lum[(y + 1) * roiW + x] +  lum[(y + 1) * roiW + (x + 1)];

      const mag = Math.hypot(gx, gy);

      if (mag > edgeThreshold) {
        totalEdgeCount++;
        let gAngle = (Math.atan2(gy, gx) * 180) / Math.PI;
        if (gAngle < 0) gAngle += 180;

        let angleDiff = Math.abs(gAngle - expectedGradientAngleDeg);
        if (angleDiff > 90) angleDiff = Math.abs(angleDiff - 180);

        if (angleDiff <= angleToleranceDeg) {
          matchingEdgeCount++;
          edgePoints.push({ x: x * downsample, y: y * downsample, mag });

          for (let tb = 0; tb < thetaBins; tb++) {
            const rho = x * cosTable[tb] + y * sinTable[tb];
            const rhoBin = Math.floor((rho + maxRho) / rhoStep);
            if (rhoBin >= 0 && rhoBin < rhoBins) {
              const binIdx = tb * rhoBins + rhoBin;
              accumulator[binIdx]++;

              const proj = gx * cosTable[tb] + gy * sinTable[tb];
              if (proj > 0) {
                accPosPolarity[binIdx]++;
              } else {
                accNegPolarity[binIdx]++;
              }
            }
          }
        }
      }
    }
  }

  const MIN_PEAK_VOTES = Math.max(20, Math.round(expectedLineLength * 0.22));
  const workAcc = new Int32Array(accumulator);
  const detectedPeaks = [];
  const MAX_PEAKS = 10;

  for (let k = 0; k < MAX_PEAKS; k++) {
    let bestV = 0;
    let bestTb = -1;
    let bestRb = -1;

    for (let tb = 0; tb < thetaBins; tb++) {
      for (let rb = 0; rb < rhoBins; rb++) {
        const v = workAcc[tb * rhoBins + rb];
        if (v > bestV) {
          bestV = v;
          bestTb = tb;
          bestRb = rb;
        }
      }
    }

    if (bestV < MIN_PEAK_VOTES) break;

    const pTheta = minTheta + bestTb * thetaStep;
    const pRho = bestRb * rhoStep - maxRho;
    const binIdx = bestTb * rhoBins + bestRb;
    const posV = accPosPolarity[binIdx];
    const negV = accNegPolarity[binIdx];
    const netPolarity = posV >= negV ? 1 : -1;
    const polarityPurity = Math.abs(posV - negV) / Math.max(1, posV + negV);

    detectedPeaks.push({
      theta: pTheta,
      thetaDeg: (pTheta * 180) / Math.PI,
      rho: pRho,
      votes: bestV,
      tb: bestTb,
      rb: bestRb,
      netPolarity,
      polarityPurity,
    });

    const tbMin = Math.max(0, bestTb - 1);
    const tbMax = Math.min(thetaBins - 1, bestTb + 1);
    const rbMin = Math.max(0, bestRb - 4);
    const rbMax = Math.min(rhoBins - 1, bestRb + 4);

    for (let t = tbMin; t <= tbMax; t++) {
      for (let r = rbMin; r <= rbMax; r++) {
        workAcc[t * rhoBins + r] = 0;
      }
    }
  }

  let totalVotes = 0;
  let nonZeroBins = 0;
  for (let i = 0; i < accumulator.length; i++) {
    if (accumulator[i] > 0) {
      totalVotes += accumulator[i];
      nonZeroBins++;
    }
  }
  const avgBinVotes = nonZeroBins > 0 ? totalVotes / nonZeroBins : 0;
  const primaryPeak = detectedPeaks[0] || null;
  const peakVotes = primaryPeak ? primaryPeak.votes : 0;
  const snr = avgBinVotes > 0 && primaryPeak ? primaryPeak.votes / avgBinVotes : 0;

  const primaryLineCoherence = primaryPeak
    ? Math.min(1.0, primaryPeak.votes / (expectedLineLength * 0.45))
    : 0;

  const pathMidX = ((path.start.x + path.end.x) / 2 - torsoRoi.x) / downsample;
  const pathMidY = ((path.start.y + path.end.y) / 2 - torsoRoi.y) / downsample;

  let bestBand = null;
  let bestBandScore = -1;
  let validPairsCount = 0;

  const maxAngleDiffDeg = 11.0;
  const minNormWidth = 0.085;
  const maxNormWidth = 0.22;
  const idealNormWidth = 0.135;

  const minPairLineVotes = Math.max(20, Math.round(expectedLineLength * 0.22));

  for (let i = 0; i < detectedPeaks.length; i++) {
    for (let j = i + 1; j < detectedPeaks.length; j++) {
      const p1 = detectedPeaks[i];
      const p2 = detectedPeaks[j];

      if (p1.votes < minPairLineVotes || p2.votes < minPairLineVotes) continue;

      const angleDiffDeg = Math.abs(p1.thetaDeg - p2.thetaDeg);
      if (angleDiffDeg > maxAngleDiffDeg) continue;

      const sepDownsampled = Math.abs(p1.rho - p2.rho);
      const bandWidthPx = sepDownsampled * downsample;
      const normBandWidth = bandWidthPx / torsoRoi.width;

      if (normBandWidth < minNormWidth || normBandWidth > maxNormWidth) continue;

      if (p1.polarityPurity < 0.38 || p2.polarityPurity < 0.38) continue;

      const hasOppositePolarity = p1.netPolarity !== p2.netPolarity;
      if (!hasOppositePolarity) continue;

      validPairsCount++;

      const widthScore = Math.exp(-Math.pow(normBandWidth - idealNormWidth, 2) / (2 * 0.050 * 0.050));

      const midTheta = (p1.theta + p2.theta) / 2;
      const midRho = (p1.rho + p2.rho) / 2;
      const distFromExpectedPathDownsampled = Math.abs(
        pathMidX * Math.cos(midTheta) + pathMidY * Math.sin(midTheta) - midRho
      );
      const pathDistPx = distFromExpectedPathDownsampled * downsample;
      const normPathDist = pathDistPx / torsoRoi.width;
      const pathProximityScore = Math.max(0, 1 - normPathDist / 0.38);

      const c1 = Math.min(1.0, p1.votes / (expectedLineLength * 0.45));
      const c2 = Math.min(1.0, p2.votes / (expectedLineLength * 0.45));
      const pairCoherence = Math.min(c1, c2) * 0.6 + ((c1 + c2) / 2) * 0.4;

      if (pairCoherence < 0.26) continue;

      let interiorSum = 0;
      let interiorSumSq = 0;
      let interiorSamples = 0;
      const sampleCount = 9;

      for (let s = 1; s < sampleCount; s++) {
        const frac = s / sampleCount;
        const lineDirX = -Math.sin(midTheta);
        const lineDirY = Math.cos(midTheta);

        const cx = midRho * Math.cos(midTheta) + (frac - 0.5) * roiW * 0.8 * lineDirX;
        const cy = midRho * Math.sin(midTheta) + (frac - 0.5) * roiH * 0.8 * lineDirY;

        const ix = Math.round(cx);
        const iy = Math.round(cy);

        if (ix >= 0 && ix < roiW && iy >= 0 && iy < roiH) {
          const lVal = lum[iy * roiW + ix];
          interiorSum += lVal;
          interiorSumSq += lVal * lVal;
          interiorSamples++;
        }
      }

      let interiorUniformity = 0.5;
      if (interiorSamples >= 4) {
        const meanLum = interiorSum / interiorSamples;
        const variance = (interiorSumSq / interiorSamples) - (meanLum * meanLum);
        const stdDev = Math.sqrt(Math.max(0, variance));
        interiorUniformity = Math.max(0, Math.min(1.0, 1 - (stdDev - 12) / 28));
      }

      const bandScore =
        pairCoherence *
        (0.40 * widthScore + 0.35 * pathProximityScore + 0.25 * interiorUniformity);

      if (bandScore > bestBandScore) {
        bestBandScore = bandScore;
        bestBand = {
          p1,
          p2,
          angleDiffDeg,
          bandWidthPx: Math.round(bandWidthPx),
          normBandWidth: Math.round(normBandWidth * 1000) / 1000,
          pathDistPx: Math.round(pathDistPx),
          bandScore,
          pairCoherence,
          widthScore,
          pathProximityScore,
          interiorUniformity,
          centerRho: midRho,
          centerThetaDeg: Math.round((midTheta * 180) / Math.PI),
        };
      }
    }
  }

  let evidenceType = "NO_COHERENT_EDGES";
  let confidence = 0;
  let isFastened = false;

  if (bestBand && bestBand.bandScore >= 0.36 && validPairsCount > 0) {
    evidenceType = "DUAL_PARALLEL_BAND";
    confidence = Math.min(0.92, Math.max(0.40, bestBand.bandScore * 1.10));
    isFastened = confidence >= 0.40;
  } else if (primaryPeak && primaryPeak.votes >= 20 && snr >= 1.8) {
    evidenceType = "SINGLE_EDGE_WEAK";
    confidence = Math.min(0.12, primaryLineCoherence * 0.12);
    isFastened = false;
  } else {
    evidenceType = "NO_COHERENT_EDGES";
    confidence = 0;
    isFastened = false;
  }

  const edgeRatio = totalEdgeCount > 0 ? matchingEdgeCount / totalEdgeCount : 0;

  return {
    methodId: "edgeHough",
    methodName: "Method B: Torso ROI Edge Orientation & Hough Transform",
    confidence: Math.round(confidence * 100) / 100,
    isFastened,
    evidenceType,
    parallelPairsCount: validPairsCount,
    bandWidthPx: bestBand ? bestBand.bandWidthPx : 0,
    normBandWidth: bestBand ? bestBand.normBandWidth : 0,
    angleDeviationDeg: bestBand ? Math.round(bestBand.angleDiffDeg * 10) / 10 : 0,
    pathDistancePx: bestBand ? bestBand.pathDistPx : 0,
    peakVotes,
    secondaryVotes: bestBand ? bestBand.p2.votes : 0,
    lineCoherence: Math.round(primaryLineCoherence * 100) / 100,
    edgeRatio: Math.round(edgeRatio * 100) / 100,
    peakThetaDeg: primaryPeak ? Math.round(primaryPeak.thetaDeg) : 0,
    edgePointsSample: edgePoints.slice(0, 100),
  };
}
