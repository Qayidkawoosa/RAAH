// core/vision/seatbelt/transectMethod.js

import { generatePerpendicularTransects, calculateBeltCorridor } from "./torsoGeometry.js";

/**
 * Samples pixel luminance along a line segment in an ImageData buffer.
 *
 * @param {ImageData} imageData
 * @param {Object} start - {x, y}
 * @param {Object} end - {x, y}
 * @param {number} numSamples - Number of samples along the line
 * @returns {Float32Array} Luminance values [0..255]
 */
function sampleLineLuminance(imageData, start, end, numSamples = 60) {
  const { data, width, height } = imageData;
  const raw = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1);
    const x = Math.round(start.x + t * (end.x - start.x));
    const y = Math.round(start.y + t * (end.y - start.y));

    if (x >= 0 && x < width && y >= 0 && y < height) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      raw[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    } else {
      raw[i] = 0;
    }
  }

  return raw;
}

/**
 * Computes interior luminance texture variance along the strap axis between two detected edges.
 *
 * Physical reasoning: genuine automotive seatbelt nylon webbing is manufactured with tight,
 * uniform weaving that exhibits flat, low luminance variance along its longitudinal center axis.
 * In contrast, patterned clothing (plaid, houndstooth, stripes, or printed logos) has high
 * periodic texture variance across or along the band.
 *
 * @param {ImageData} imageData - RGBA frame buffer
 * @param {number} frameWidth - Image width in px
 * @param {Object} edgeLeft - Left edge pixel coordinate {x, y}
 * @param {Object} edgeRight - Right edge pixel coordinate {x, y}
 * @param {Object} transectCenter - Center point of the transect probe {x, y}
 * @param {Object} transectNormal - Unit normal vector of the transect probe {x, y}
 * @param {number} [numSamples=18] - Number of samples along the belt direction
 * @returns {{ mean: number, stdDev: number, variance: number }}
 */
function computeInteriorTextureVariance(
  imageData,
  frameWidth,
  edgeLeft,
  edgeRight,
  transectCenter,
  transectNormal,
  numSamples = 18
) {
  if (!imageData || !imageData.data || !edgeLeft || !edgeRight) {
    return { mean: 0, stdDev: 0, variance: 0 };
  }

  const { data, width, height } = imageData;
  const centerX = (edgeLeft.x + edgeRight.x) / 2;
  const centerY = (edgeLeft.y + edgeRight.y) / 2;

  // The belt direction unit vector is perpendicular to transectNormal
  const beltDirX = transectNormal ? transectNormal.y : 0;
  const beltDirY = transectNormal ? -transectNormal.x : 0;

  const sampleSpacingPx = 3.0;
  const halfSpan = ((numSamples - 1) / 2) * sampleSpacingPx;

  let sum = 0;
  let sumSq = 0;
  let validCount = 0;

  for (let s = 0; s < numSamples; s++) {
    const offset = -halfSpan + s * sampleSpacingPx;
    const px = Math.round(centerX + beltDirX * offset);
    const py = Math.round(centerY + beltDirY * offset);

    if (px >= 0 && px < width && py >= 0 && py < height) {
      const idx = (py * width + px) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      sum += lum;
      sumSq += lum * lum;
      validCount++;
    }
  }

  if (validCount < 4) {
    return { mean: 0, stdDev: 0, variance: 0 };
  }

  const mean = sum / validCount;
  const variance = Math.max(0, sumSq / validCount - mean * mean);
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev, variance };
}

/**
 * Analyzes a 1D luminance profile across a full-torso slice for the signature of a seatbelt strap.
 *
 * @param {Float32Array} profile - 1D luminance samples
 * @param {Object} [options={}] - Options including relativeEdgeThreshold, probeLengthPx, torsoWidthPx
 * @returns {Object}
 */
function analyzeTransectProfile(profile, options = {}) {
  const {
    relativeEdgeThreshold = 0.12,
    minAbsEdgeThreshold = 18,
    minNoiseFloor = 4.0,
    probeLengthPx = 190,
    torsoWidthPx = 250,
    imageData = null,
    frameWidth = 640,
    transectCenter = null,
    transectNormal = null,
  } = options;

  const n = profile.length;
  if (n < 12) {
    return {
      hasStrap: false,
      centerOffset: 0,
      edgeScore: 0,
      contrastScore: 0,
      profile,
      diagnostic: null,
      validPairsCount: 0,
    };
  }

  const dirGradients = new Float32Array(n);
  const absGradients = new Float32Array(n);
  const relGradients = new Float32Array(n);
  const localBrightness = new Float32Array(n);

  for (let k = 1; k < n - 1; k++) {
    const dir = profile[k + 1] - profile[k - 1];
    const absG = Math.abs(dir);
    dirGradients[k] = dir;
    absGradients[k] = absG;

    let localSum = 0;
    let localCount = 0;
    for (let m = Math.max(0, k - 2); m <= Math.min(n - 1, k + 2); m++) {
      localSum += profile[m];
      localCount++;
    }
    const localRef = localCount > 0 ? localSum / localCount : 16;
    localBrightness[k] = localRef;
    relGradients[k] = absG / Math.max(localRef, 16);
  }

  const peaks = [];
  for (let k = 2; k < n - 2; k++) {
    const absG = absGradients[k];
    const relG = relGradients[k];

    if (absG >= minNoiseFloor && absG > absGradients[k - 1] && absG >= absGradients[k + 1]) {
      if (relG >= relativeEdgeThreshold || absG >= minAbsEdgeThreshold) {
        peaks.push({
          index: k,
          absGrad: absG,
          relGrad: relG,
          localBrightness: localBrightness[k],
          polarity: Math.sign(dirGradients[k]),
        });
      }
    }
  }

  if (peaks.length < 2) {
    return {
      hasStrap: false,
      centerOffset: 0,
      edgeScore: 0,
      contrastScore: 0,
      profile,
      absGradients,
      relGradients,
      diagnostic: null,
      validPairsCount: 0,
    };
  }

  let bestPair = null;
  let maxScore = 0;
  let validPairsCount = 0;

  const minWidthSamples = Math.max(3, Math.round(n * 0.05));
  const maxWidthSamples = Math.max(minWidthSamples + 3, Math.round(n * 0.35));
  const pxPerSample = probeLengthPx / n;

  for (let i = 0; i < peaks.length; i++) {
    for (let j = i + 1; j < peaks.length; j++) {
      const p1 = peaks[i];
      const p2 = peaks[j];

      const leftPeak = p1.index < p2.index ? p1 : p2;
      const rightPeak = p1.index < p2.index ? p2 : p1;
      const distSamples = rightPeak.index - leftPeak.index;

      if (distSamples >= minWidthSamples && distSamples <= maxWidthSamples) {
        const hasOppositePolarity = leftPeak.polarity * rightPeak.polarity < 0;
        if (!hasOppositePolarity) continue;

        validPairsCount++;

        const leftIdx = leftPeak.index;
        const rightIdx = rightPeak.index;

        const candidateWidthPx = distSamples * pxPerSample;
        const normWidth = candidateWidthPx / Math.max(torsoWidthPx, 100);

        // Torso-Normalized Width Scoring (Anti-Thin Filter)
        // 3a — Close-Up Driver Gaussian Width Broadening
        const closeUp = torsoWidthPx > 200;
        const gaussMu = closeUp ? 0.155 : 0.135;
        const gaussSigma = closeUp ? 0.065 : 0.055;
        const widthScore = Math.exp(-Math.pow(normWidth - gaussMu, 2) / (2 * Math.pow(gaussSigma, 2)));

        // Expected Path Proximity Scoring
        const centerSample = (leftIdx + rightIdx) / 2;
        const offsetFromExpectedCenterPx = Math.abs(centerSample - n / 2) * pxPerSample;
        const pathProximityScore = Math.max(0.0, 1.0 - offsetFromExpectedCenterPx / (0.42 * torsoWidthPx));

        let innerSum = 0;
        let innerCount = 0;
        for (let k = leftIdx; k <= rightIdx; k++) {
          innerSum += profile[k];
          innerCount++;
        }
        const innerAvg = innerCount > 0 ? innerSum / innerCount : 0;

        let outerSum = 0;
        let outerCount = 0;
        for (let k = Math.max(0, leftIdx - 8); k < leftIdx; k++) {
          outerSum += profile[k];
          outerCount++;
        }
        for (let k = rightIdx + 1; k < Math.min(n, rightIdx + 9); k++) {
          outerSum += profile[k];
          outerCount++;
        }
        const outerAvg = outerCount > 0 ? outerSum / outerCount : 0;

        const absContrast = Math.abs(outerAvg - innerAvg);
        const relContrast = absContrast / Math.max(outerAvg, 16);

        if (relContrast >= relativeEdgeThreshold * 0.70 || absContrast >= 8.0) {
          const meanRelGrad = (leftPeak.relGrad + rightPeak.relGrad) / 2;
          const meanAbsGrad = (leftPeak.absGrad + rightPeak.absGrad) / 2;

          const contrastScore = Math.min(1.0, relContrast / 0.32);
          const edgeStrengthScore = Math.min(1.0, meanRelGrad / 0.30) * 0.65 + Math.min(1.0, meanAbsGrad / 25) * 0.35;

          // Physical seatbelt ribbon MUST have real photometric edges and contrast against the shirt
          const photometricEvidence = 0.55 * contrastScore + 0.45 * edgeStrengthScore;
          if (photometricEvidence < 0.22 || (absContrast < 8.0 && relContrast < 0.10)) {
            continue; // Pure uniform cloth texture noise, not a physical seatbelt
          }

          // Interior Texture Variance Gate (Improvement 2)
          let S_uniformity = 0.85;
          let interiorStats = { mean: innerAvg, stdDev: 8, variance: 64 };

          if (imageData && transectCenter && transectNormal) {
            const halfSamples = n > 1 ? (n - 1) / 2 : 1;
            const leftOffsetPx = (leftIdx - halfSamples) * pxPerSample;
            const rightOffsetPx = (rightIdx - halfSamples) * pxPerSample;

            const edgeLeft = {
              x: transectCenter.x + transectNormal.x * leftOffsetPx,
              y: transectCenter.y + transectNormal.y * leftOffsetPx,
            };
            const edgeRight = {
              x: transectCenter.x + transectNormal.x * rightOffsetPx,
              y: transectCenter.y + transectNormal.y * rightOffsetPx,
            };

            interiorStats = computeInteriorTextureVariance(
              imageData,
              frameWidth || imageData.width,
              edgeLeft,
              edgeRight,
              transectCenter,
              transectNormal,
              18
            );

            // Nylon webbing: stdDev < 12 (uniform, flat)
            // Printed text/logos: stdDev 25-50
            // Plaid/houndstooth: stdDev 18-35
            S_uniformity = Math.max(0, Math.min(1.0, 1.0 - Math.max(0, (interiorStats.stdDev - 10) / 30)));
          }

          // Composite Candidate Score rebalanced with S_uniformity
          let candidateScore = 0.30 * widthScore
                             + 0.28 * pathProximityScore
                             + 0.18 * contrastScore
                             + 0.12 * edgeStrengthScore
                             + 0.12 * S_uniformity;

          // Hard gate: high-confidence geometry match but very high texture variance -> patterned fabric
          if (interiorStats.stdDev > 38 && widthScore > 0.5 && pathProximityScore > 0.5) {
            candidateScore = Math.min(candidateScore, 0.15);
          }

          if (candidateScore > maxScore) {
            maxScore = candidateScore;
            const polarityDesc = leftPeak.polarity < 0
              ? "LIGHT→DARK→LIGHT (dark strap)"
              : "DARK→LIGHT→DARK (light strap)";

            bestPair = {
              left: leftIdx,
              right: rightIdx,
              widthSamples: distSamples,
              widthPx: Math.round(candidateWidthPx * 10) / 10,
              normWidth: Math.round(normWidth * 1000) / 10,
              innerAvg,
              outerAvg,
              absContrast,
              relContrast,
              meanRelGrad,
              meanAbsGrad,
              score: candidateScore,
              widthScore,
              pathProximityScore,
              uniformityScore: S_uniformity,
              interiorStdDev: interiorStats.stdDev,
              centerOffset: centerSample - n / 2,
              polarityDescription: polarityDesc,
              leftPeak,
              rightPeak,
            };
          }
        }
      }
    }
  }

  const hasStrap = bestPair !== null && bestPair.score >= 0.42;

  return {
    hasStrap,
    pair: bestPair,
    centerOffset: bestPair ? bestPair.centerOffset : 0,
    edgeScore: bestPair ? Math.min(1.0, bestPair.score) : 0,
    contrastScore: bestPair ? Math.min(1.0, bestPair.relContrast / (relativeEdgeThreshold * 2)) : 0,
    profile,
    absGradients,
    relGradients,
    validPairsCount,
    diagnostic: bestPair ? {
      absoluteGradient: Math.round(bestPair.meanAbsGrad * 10) / 10,
      relativeGradient: Math.round(bestPair.meanRelGrad * 1000) / 10,
      localBrightness: Math.round(bestPair.leftPeak.localBrightness),
      polarity: bestPair.polarityDescription,
      estimatedBeltWidth: bestPair.widthPx,
      normWidthPct: bestPair.normWidth,
      relativeContrast: Math.round(bestPair.relContrast * 1000) / 10,
      uniformityScore: Math.round(bestPair.uniformityScore * 100) / 100,
      interiorStdDev: Math.round(bestPair.interiorStdDev * 10) / 10,
      score: Math.round(bestPair.score * 100) / 100,
    } : null,
  };
}

/**
 * Method A: Full-Torso Multi-Transect Scanning & Trajectory Fitting.
 *
 * @param {ImageData} imageData - Full frame or torso image data
 * @param {Object} path - Belt trajectory { start: {x,y}, end: {x,y}, side: "RHD"|"LHD" }
 * @param {Object} options - Tuning parameters
 * @returns {Object} Method A evaluation result
 */
export function evaluateTransectMethod(imageData, path, options = {}) {
  const {
    numTransects = 10,
    probeLength = 190,
    minEdgeThreshold = 18,
    relativeEdgeThreshold = 0.12,
    corridorWidth = 180,
    torso = null,
  } = options;

  const corridor = calculateBeltCorridor(path, corridorWidth, torso);
  const effectiveProbeLength = Math.max(probeLength, Math.round(corridor.width * 1.05));

  const transects = generatePerpendicularTransects(
    path.start,
    path.end,
    numTransects,
    effectiveProbeLength,
    0.05,
    0.92
  );

  if (transects.length === 0 || !corridor) {
    return {
      confidence: 0,
      isFastened: false,
      matchedTransects: 0,
      totalTransects: 0,
      corridor: null,
      details: "No valid torso transects",
      validEdgePairsCount: 0,
      meanRelativeGradient: 0,
      meanAbsoluteGradient: 0,
      meanBeltWidth: 0,
      representativeEdge: null,
      relativeEdgeThreshold,
    };
  }

  let matchedInCorridorCount = 0;
  let totalEdgeScore = 0;
  let totalContrastScore = 0;
  let totalValidEdgePairs = 0;
  let sumRelGrad = 0;
  let sumAbsGrad = 0;
  let sumBeltWidth = 0;
  let bestDiagTransect = null;
  let maxDiagScore = 0;

  const analyzedTransects = [];
  const candidateStrapPoints = [];

  const torsoWidthPx = torso && torso.shoulderDist ? torso.shoulderDist : 250;

  for (const t of transects) {
    const profile = sampleLineLuminance(imageData, t.start, t.end, 100);
    const analysis = analyzeTransectProfile(profile, {
      relativeEdgeThreshold,
      minAbsEdgeThreshold: minEdgeThreshold,
      probeLengthPx: effectiveProbeLength,
      torsoWidthPx,
      imageData,
      frameWidth: imageData ? imageData.width : 640,
      transectCenter: t.center,
      transectNormal: t.normal,
    });

    totalValidEdgePairs += analysis.validPairsCount || 0;

    const halfSamples = profile.length > 0 ? profile.length / 2 : 50;
    const normalScale = (analysis.centerOffset / halfSamples) * (effectiveProbeLength / 2);
    const strapPoint = {
      x: t.center.x + t.normal.x * normalScale,
      y: t.center.y + t.normal.y * normalScale,
      t: t.t,
      score: analysis.edgeScore,
    };

    const inCorridor = analysis.hasStrap && corridor.isPointInside(strapPoint.x, strapPoint.y);

    analyzedTransects.push({
      ...t,
      analysis,
      strapPoint,
      inCorridor,
    });

    if (inCorridor) {
      matchedInCorridorCount++;
      totalEdgeScore += analysis.edgeScore;
      totalContrastScore += analysis.contrastScore;
      candidateStrapPoints.push(strapPoint);

      if (analysis.diagnostic) {
        sumRelGrad += analysis.diagnostic.relativeGradient;
        sumAbsGrad += analysis.diagnostic.absoluteGradient;
        sumBeltWidth += analysis.diagnostic.estimatedBeltWidth;
        if (analysis.diagnostic.score > maxDiagScore) {
          maxDiagScore = analysis.diagnostic.score;
          bestDiagTransect = analysis.diagnostic;
        }
      }
    }
  }

  // Linear Regression & Trajectory Verification across the Torso
  let linearityScore = 0.0;
  let observedStrapLine = null;
  let validSlope = false;

  if (candidateStrapPoints.length >= 3) {
    candidateStrapPoints.sort((a, b) => a.y - b.y);

    let sumX = 0, sumY = 0, sumXY = 0, sumY2 = 0;
    const n = candidateStrapPoints.length;
    for (const p of candidateStrapPoints) {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumY2 += p.y * p.y;
    }
    const denom = n * sumY2 - sumY * sumY;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumX - slope * sumY) / n;

    const expectedSlope = (path.end.x - path.start.x) / (path.end.y - path.start.y);
    // Real 3-point sash is diagonal across the torso:
    // 1. Slope sign must match expected sash angle
    // 2. Must not be nearly vertical (|slope| < 0.25) which matches vertical shirt plackets, zippers, or button rows
    // 3. Slope magnitude must be plausible for diagonal torso geometry (0.25 <= |slope| <= 2.2)
    const signMatches = Math.sign(slope) === Math.sign(expectedSlope);
    const isDiagonal = Math.abs(slope) >= 0.15 && Math.abs(slope) <= 2.5;
    validSlope = signMatches && isDiagonal;

    let totalErrorSq = 0;
    for (const p of candidateStrapPoints) {
      const predX = slope * p.y + intercept;
      totalErrorSq += (p.x - predX) * (p.x - predX);
    }
    const rmsError = Math.sqrt(totalErrorSq / n);

    // Vertical span covered by candidate points
    const minY = candidateStrapPoints[0].y;
    const maxY = candidateStrapPoints[n - 1].y;
    const ySpan = maxY - minY;

    // Calculate span relative to the VISIBLE portion of the path in the camera frame
    const canvasH = imageData && imageData.height ? imageData.height : 480;
    const visibleEndY = Math.min(path.end.y, canvasH - 5);
    const visiblePathHeight = Math.max(80, visibleEndY - path.start.y);
    const visibleSpanRatio = visiblePathHeight > 0 ? ySpan / visiblePathHeight : 0;

    // Longitudinal spread: candidate points must have reasonable span across the visible torso
    const minT = candidateStrapPoints[0].t;
    const maxT = candidateStrapPoints[n - 1].t;
    const tSpread = maxT - minT;

    if (validSlope && visibleSpanRatio >= 0.20 && tSpread >= 0.14 && n >= 3) {
      let baseLinearity = Math.max(0.0, Math.min(1.0, 1.4 - (rmsError / 28))) * Math.min(1.0, visibleSpanRatio / 0.45);
      if (n === 3) baseLinearity *= 0.85;
      linearityScore = baseLinearity;

      observedStrapLine = {
        start: { x: slope * minY + intercept, y: minY },
        end: { x: slope * maxY + intercept, y: maxY },
      };
    }
  }

  const matchRatio = matchedInCorridorCount / numTransects;
  const avgEdgeScore = matchedInCorridorCount > 0 ? totalEdgeScore / matchedInCorridorCount : 0;
  const avgContrastScore = matchedInCorridorCount > 0 ? totalContrastScore / matchedInCorridorCount : 0;

  const countFactor = matchedInCorridorCount >= 3
    ? Math.min(1.0, matchedInCorridorCount / (numTransects * 0.40))
    : 0;

  let confidence = (matchRatio * 0.40 + avgEdgeScore * 0.30 + avgContrastScore * 0.30) * linearityScore * countFactor;
  confidence = Math.min(1.0, Math.max(0.0, confidence));

  const middleTransect = analyzedTransects[Math.floor(analyzedTransects.length / 2)] || null;

  return {
    methodId: "transect",
    methodName: "Method A: Full-Torso Multi-Transect Scanning",
    confidence: Math.round(confidence * 100) / 100,
    isFastened: confidence >= 0.28 && matchedInCorridorCount >= 3 && observedStrapLine !== null,
    matchedTransects: matchedInCorridorCount,
    totalTransects: numTransects,
    matchRatio: Math.round(matchRatio * 100),
    avgEdgeScore: Math.round(avgEdgeScore * 100) / 100,
    avgContrastScore: Math.round(avgContrastScore * 100) / 100,
    collinearityScore: Math.round(linearityScore * 100) / 100,
    analyzedTransects,
    middleTransect,
    strapCenters: candidateStrapPoints,
    corridor,
    observedStrapLine,
    hasCorridorDetection: matchedInCorridorCount >= 3 && linearityScore >= 0.28 && observedStrapLine !== null,
    validEdgePairsCount: totalValidEdgePairs,
    meanRelativeGradient: matchedInCorridorCount > 0 ? Math.round((sumRelGrad / matchedInCorridorCount) * 10) / 10 : 0,
    meanAbsoluteGradient: matchedInCorridorCount > 0 ? Math.round((sumAbsGrad / matchedInCorridorCount) * 10) / 10 : 0,
    meanBeltWidth: matchedInCorridorCount > 0 ? Math.round((sumBeltWidth / matchedInCorridorCount) * 10) / 10 : 0,
    representativeEdge: bestDiagTransect,
    relativeEdgeThreshold,
  };
}
