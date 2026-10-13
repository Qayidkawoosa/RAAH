// core/events/safetyEventTypes.js

export const EVENT_SEVERITY = {
  INFO: "INFO",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
};

export const SAFETY_EVENT_TYPES = {
  MICROSLEEP_DETECTED: {
    type: "MICROSLEEP_DETECTED",
    severity: EVENT_SEVERITY.CRITICAL,
    title: "Microsleep Warning",
    description: "Driver eyes closed for a dangerous continuous duration.",
  },
  DRIVER_DISTRACTION: {
    type: "DRIVER_DISTRACTION",
    severity: EVENT_SEVERITY.WARNING,
    title: "Driver Distraction",
    description: "Driver looking away from the forward road corridor.",
  },
  FATIGUE_INDICATOR: {
    type: "FATIGUE_INDICATOR",
    severity: EVENT_SEVERITY.WARNING,
    title: "Driver Fatigue",
    description: "Sustained yawning or elevated PERCLOS drowsiness detected.",
  },
  CAMERA_OBSTRUCTED: {
    type: "CAMERA_OBSTRUCTED",
    severity: EVENT_SEVERITY.WARNING,
    title: "Camera Feed Obstructed",
    description: "Driver face partially blocked or hand covering critical facial regions.",
  },
  DRIVER_OUT_OF_POSITION: {
    type: "DRIVER_OUT_OF_POSITION",
    severity: EVENT_SEVERITY.WARNING,
    title: "Driver Out of Position",
    description: "Driver leaning or physically shifted away from the central driving corridor for a prolonged duration.",
  },
  POOR_MONITORING_CONDITIONS: {
    type: "POOR_MONITORING_CONDITIONS",
    severity: EVENT_SEVERITY.INFO,
    title: "Suboptimal Camera Feed",
    description: "Lighting or focus conditions may reduce monitoring reliability.",
  },
  PHONE_USE_DETECTED: {
    type: "PHONE_USE_DETECTED",
    severity: EVENT_SEVERITY.CRITICAL,
    title: "Mobile Phone Distraction",
    description: "Driver actively holding or interacting with a mobile phone while operating vehicle.",
  },
  PHONE_CALL_DETECTED: {
    type: "PHONE_CALL_DETECTED",
    severity: EVENT_SEVERITY.CRITICAL,
    title: "Phone Call to Ear",
    description: "Driver holding mobile phone to ear while operating vehicle.",
  },
  PHONE_TEXTING_DETECTED: {
    type: "PHONE_TEXTING_DETECTED",
    severity: EVENT_SEVERITY.CRITICAL,
    title: "Texting / Screen Viewing",
    description: "Driver looking down and interacting with mobile phone screen while operating vehicle.",
  },
};
