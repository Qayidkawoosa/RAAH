// core/vision/loadFaceModel.js

export async function loadFaceModel() {
  if (typeof window === "undefined") {
    throw new Error("FaceLandmarker is only supported in browser environments.");
  }
  const dynamicImport = new Function("url", "return import(url)");
  const { FaceLandmarker, FilesetResolver } = await dynamicImport(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21"
  );

  const fileset = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  const faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
    },
    runningMode: "VIDEO",
    numFaces: 5,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });

  return faceLandmarker;
}
