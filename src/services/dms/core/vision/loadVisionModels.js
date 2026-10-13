// core/vision/loadVisionModels.js

const WASM_CDN_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

const FACE_LANDMARKER_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

const EFFICIENTDET_LITE0_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite";

const HAND_LANDMARKER_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

let visionModuleCache = null;

async function getTasksVision() {
  if (typeof window === "undefined") {
    throw new Error("MediaPipe Tasks Vision is only supported in browser environments.");
  }
  if (!visionModuleCache) {
    const dynamicImport = new Function("url", "return import(url)");
    visionModuleCache = await dynamicImport(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21"
    );
  }
  return visionModuleCache;
}

/**
 * Loads FaceLandmarker, ObjectDetector, and HandLandmarker.
 * Includes automatic GPU-to-CPU delegate fallback so model loading never crashes.
 */
export async function loadVisionModels(options = {}) {
  const {
    delegate = "GPU",
    phoneScoreThreshold = 0.30,
  } = options;

  console.log("[DriverAttention] Loading MediaPipe Vision modules...");
  const { FaceLandmarker, ObjectDetector, HandLandmarker, FilesetResolver } = await getTasksVision();

  console.log("[DriverAttention] Initializing WASM vision fileset...");
  const fileset = await FilesetResolver.forVisionTasks(WASM_CDN_URL);

  let faceLandmarker = null;
  let objectDetector = null;
  let handLandmarker = null;

  // 1. Load FaceLandmarker (High-frequency driver attention & drowsiness)
  try {
    console.log(`[DriverAttention] Initializing FaceLandmarker with ${delegate} delegate...`);
    faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_URL,
        delegate,
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  } catch (gpuErr) {
    console.warn(`[DriverAttention] GPU FaceLandmarker failed, retrying with CPU delegate:`, gpuErr);
    try {
      faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_URL,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    } catch (cpuErr) {
      console.error("[DriverAttention] Critical: Failed to create FaceLandmarker on CPU:", cpuErr);
      throw cpuErr;
    }
  }

  // 2. Load ObjectDetector & HandLandmarker concurrently with error tolerance
  try {
    const [objDet, handLand] = await Promise.allSettled([
      ObjectDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: EFFICIENTDET_LITE0_URL,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        scoreThreshold: phoneScoreThreshold,
      }),
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: HAND_LANDMARKER_URL,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
      }),
    ]);

    if (objDet.status === "fulfilled") {
      objectDetector = objDet.value;
    }
    if (handLand.status === "fulfilled") {
      handLandmarker = handLand.value;
    }
  } catch (secondaryErr) {
    console.warn("[DriverAttention] Secondary vision models non-critical error:", secondaryErr);
  }

  console.log("[DriverAttention] Vision models ready. FaceLandmarker active:", Boolean(faceLandmarker));

  return {
    faceLandmarker,
    objectDetector,
    handLandmarker,
  };
}
