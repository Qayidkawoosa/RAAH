// core/vision/seatbelt/clahePreprocessor.js

/**
 * Contrast Limited Adaptive Histogram Equalization (CLAHE) for Torso ROI.
 *
 * PURPOSE & AUTOMOTIVE SIGNIFICANCE:
 * In passenger vehicles and school buses, drivers often wear dark clothing (navy, dark maroon,
 * black jackets) where dark seatbelt webbing blends into the fabric under poor in-cabin lighting
 * or heavy shadowing. Standard global equalization washes out bright regions (headlights, windows).
 *
 * CLAHE operates on localized contextual tiles (e.g. 32x32 px) across the torso region, clipping
 * histogram spikes to limit over-amplification of noise, and redistributes contrast locally.
 * Bilinear interpolation between contextual tiles ensures seamless, artifact-free luminance enhancement.
 * By scaling RGB channels proportionally to the enhanced luminance, the driver's clothing hue and
 * fabric texture are strictly preserved while pulling out clear seatbelt boundary gradients.
 */

/**
 * Applies Contrast Limited Adaptive Histogram Equalization (CLAHE) to the torso ROI
 * in an ImageData frame buffer.
 *
 * @param {ImageData} imageData - Full frame RGBA buffer
 * @param {Object} roi - Torso bounding box { x, y, width, height }
 * @param {Object} [options={}]
 * @param {number} [options.tileSize=32] - Grid tile size in pixels
 * @param {number} [options.clipLimit=3.5] - Contrast clip limit multiplier
 * @param {boolean} [options.returnCopy=true] - If true, returns a cloned ImageData; otherwise modifies in-place
 * @returns {ImageData} Enhanced ImageData buffer (same dimensions)
 */
export function applyCLAHETorsoROI(imageData, roi, options = {}) {
  if (!imageData || !imageData.data) {
    return imageData;
  }

  const {
    tileSize = 32,
    clipLimit = 3.5,
    returnCopy = true,
  } = options;

  const width = imageData.width;
  const height = imageData.height;

  // Prepare destination ImageData
  let outImageData;
  if (returnCopy) {
    const copiedData = new Uint8ClampedArray(imageData.data);
    if (typeof ImageData !== "undefined") {
      outImageData = new ImageData(copiedData, width, height);
    } else {
      outImageData = {
        data: copiedData,
        width,
        height,
      };
    }
  } else {
    outImageData = imageData;
  }

  if (!roi || roi.width <= 4 || roi.height <= 4) {
    return outImageData;
  }

  // Safe boundary clamping for ROI
  const rx = Math.max(0, Math.min(width - 1, Math.round(roi.x)));
  const ry = Math.max(0, Math.min(height - 1, Math.round(roi.y)));
  const rw = Math.max(1, Math.min(width - rx, Math.round(roi.width)));
  const rh = Math.max(1, Math.min(height - ry, Math.round(roi.height)));

  if (rw <= 4 || rh <= 4) {
    return outImageData;
  }

  const srcData = imageData.data;
  const dstData = outImageData.data;

  // 1. Extract Luminance for ROI
  const roiPixels = rw * rh;
  const lum = new Uint8Array(roiPixels);

  for (let y = 0; y < rh; y++) {
    const srcRowOffset = ((ry + y) * width + rx) * 4;
    const lumRowOffset = y * rw;
    for (let x = 0; x < rw; x++) {
      const idx = srcRowOffset + x * 4;
      const r = srcData[idx];
      const g = srcData[idx + 1];
      const b = srcData[idx + 2];
      // Rec. 601 Luma
      lum[lumRowOffset + x] = (0.299 * r + 0.587 * g + 0.114 * b + 0.5) | 0;
    }
  }

  // 2. Tile Grid Setup
  const tilesX = Math.max(1, Math.ceil(rw / tileSize));
  const tilesY = Math.max(1, Math.ceil(rh / tileSize));

  // Pre-allocate normalized CDFs for all tiles (tilesX * tilesY * 256)
  const cdfs = new Uint8Array(tilesX * tilesY * 256);
  const hist = new Int32Array(256);

  // 3. Compute Clipped CDF for each Tile
  for (let ty = 0; ty < tilesY; ty++) {
    const y0 = ty * tileSize;
    const y1 = Math.min(rh, y0 + tileSize);
    const tileH = y1 - y0;

    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * tileSize;
      const x1 = Math.min(rw, x0 + tileSize);
      const tileW = x1 - x0;
      const tilePixels = tileW * tileH;

      if (tilePixels === 0) continue;

      // 3a. Build 256-bin Histogram
      hist.fill(0);
      for (let y = y0; y < y1; y++) {
        const rowOffset = y * rw;
        for (let x = x0; x < x1; x++) {
          hist[lum[rowOffset + x]]++;
        }
      }

      // 3b. Clip Limiting and Uniform Redistribution
      const clipThreshold = Math.max(1, Math.round(clipLimit * (tilePixels / 256)));
      let excess = 0;

      for (let b = 0; b < 256; b++) {
        if (hist[b] > clipThreshold) {
          excess += hist[b] - clipThreshold;
          hist[b] = clipThreshold;
        }
      }

      const bonusPerBin = (excess / 256) | 0;
      const remainder = excess % 256;

      if (bonusPerBin > 0) {
        for (let b = 0; b < 256; b++) {
          hist[b] += bonusPerBin;
        }
      }
      for (let b = 0; b < remainder; b++) {
        hist[b]++;
      }

      // 3c & 3d. Compute and Normalize CDF
      const cdfOffset = (ty * tilesX + tx) * 256;
      let cumSum = 0;
      const normScale = 255.0 / tilePixels;

      for (let b = 0; b < 256; b++) {
        cumSum += hist[b];
        const normalized = (cumSum * normScale + 0.5) | 0;
        cdfs[cdfOffset + b] = normalized > 255 ? 255 : (normalized < 0 ? 0 : normalized);
      }
    }
  }

  // 4 & 5. Bilinear Interpolation & Color-Preserving RGB Reconstruction
  for (let y = 0; y < rh; y++) {
    // Relative position in tile coordinate space (centered at +0.5)
    const normY = (y / tileSize) - 0.5;
    const ty0 = Math.max(0, Math.min(tilesY - 1, Math.floor(normY)));
    const ty1 = Math.max(0, Math.min(tilesY - 1, ty0 + 1));
    const wy = Math.max(0.0, Math.min(1.0, normY - ty0));
    const invWy = 1.0 - wy;

    const rowOffsetTy0 = ty0 * tilesX;
    const rowOffsetTy1 = ty1 * tilesX;

    const srcRowOffset = ((ry + y) * width + rx) * 4;
    const lumRowOffset = y * rw;

    for (let x = 0; x < rw; x++) {
      const normX = (x / tileSize) - 0.5;
      const tx0 = Math.max(0, Math.min(tilesX - 1, Math.floor(normX)));
      const tx1 = Math.max(0, Math.min(tilesX - 1, tx0 + 1));
      const wx = Math.max(0.0, Math.min(1.0, normX - tx0));
      const invWx = 1.0 - wx;

      const oldL = lum[lumRowOffset + x];

      // 4 surrounding tile CDF lookup offsets
      const cdf00 = (rowOffsetTy0 + tx0) * 256 + oldL;
      const cdf10 = (rowOffsetTy0 + tx1) * 256 + oldL;
      const cdf01 = (rowOffsetTy1 + tx0) * 256 + oldL;
      const cdf11 = (rowOffsetTy1 + tx1) * 256 + oldL;

      // Bilinear interpolation
      const top = invWx * cdfs[cdf00] + wx * cdfs[cdf10];
      const btm = invWx * cdfs[cdf01] + wx * cdfs[cdf11];
      const newL = invWy * top + wy * btm;

      // Hue-preserving RGB scaling
      const scale = newL / Math.max(oldL, 1.0);
      const dstIdx = srcRowOffset + x * 4;

      const r = srcData[dstIdx];
      const g = srcData[dstIdx + 1];
      const b = srcData[dstIdx + 2];

      const newR = (r * scale + 0.5) | 0;
      const newG = (g * scale + 0.5) | 0;
      const newB = (b * scale + 0.5) | 0;

      dstData[dstIdx]     = newR > 255 ? 255 : (newR < 0 ? 0 : newR);
      dstData[dstIdx + 1] = newG > 255 ? 255 : (newG < 0 ? 0 : newG);
      dstData[dstIdx + 2] = newB > 255 ? 255 : (newB < 0 ? 0 : newB);
      // Alpha remains untouched
    }
  }

  return outImageData;
}
