// core/vision/detectPhone.js

let lastPhoneTimestamp = -1;

/**
 * Executes object detection on a video frame using MediaPipe ObjectDetector.
 * Enforces unconstrained COCO competition so that non-phone objects (e.g. cups,
 * water bottles, books) are recognized and not misclassified as phones.
 */
export function detectPhone(detector, video, timestampMs = performance.now()) {
  if (!detector || !video || video.readyState < 2) {
    return { hasPhone: false, phones: [], otherDetections: [], rawResult: null };
  }

  const ts = Math.max(lastPhoneTimestamp + 1, Math.round(timestampMs));
  lastPhoneTimestamp = ts;

  let result = null;
  try {
    result = detector.detectForVideo(video, ts);
  } catch (err) {
    console.warn('[detectPhone] Detection error:', err);
    return { hasPhone: false, phones: [], otherDetections: [], rawResult: null };
  }

  if (!result || !result.detections || result.detections.length === 0) {
    return { hasPhone: false, phones: [], otherDetections: [], rawResult: result };
  }

  const phones = [];
  const otherDetections = [];

  for (const detection of result.detections) {
    const topCategory = detection.categories?.[0];
    if (!topCategory) continue;

    const allCategories = (detection.categories || []).map((c) => ({
      name: c.categoryName,
      score: Number(c.score.toFixed(2)),
    }));

    const phoneCat = detection.categories?.find(
      (c) => c.categoryName === "cell phone" || c.categoryName === "telephone"
    );

    // Genuine cell phone candidate selection:
    // Requires verified 'cell phone' category match
    const isCellPhone =
      topCategory.categoryName === "cell phone" ||
      (phoneCat && phoneCat.score >= 0.28);

    const item = {
      categoryName: isCellPhone ? "cell phone" : topCategory.categoryName,
      score: phoneCat ? Math.max(topCategory.score, phoneCat.score) : topCategory.score,
      allCategories,
      box: detection.boundingBox || {
        originX: 0,
        originY: 0,
        width: 0,
        height: 0,
      },
    };

    if (isCellPhone) {
      phones.push(item);
    } else {
      otherDetections.push(item);
    }
  }

  return {
    hasPhone: phones.length > 0,
    phones,
    otherDetections,
    rawResult: result,
  };
}
