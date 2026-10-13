// core/quality/detection/getFaceBrightness.js

import { getBrightness } from "./getBrightness.js";

export const getFaceBrightness = (pctx, x, y, width, height) => {
  if (!pctx || width <= 0 || height <= 0) return 100;
  try {
    const faceRegion = pctx.getImageData(x, y, width, height);
    return getBrightness(faceRegion);
  } catch {
    return 100;
  }
};
