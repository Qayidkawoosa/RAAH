// src/services/dms/nativeUsbDmsBridge.ts
/**
 * Native USB/OTG Camera & MediaPipe DMS Bridge
 * Interfaces with UsbCameraDmsModule on Android and provides
 * landmark telemetry streams and preview surface integration.
 */

import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  requireNativeComponent,
  ViewProps,
  View,
} from 'react-native';
import React from 'react';

const { UsbCameraDmsModule } = NativeModules;

export interface NativeLandmark {
  x: number;
  y: number;
  z: number;
}

export interface NativeBlendshape {
  categoryName: string;
  score: number;
}

export interface NativeHeadPose {
  yaw: number;
  pitch: number;
  roll: number;
  isLookingAway: boolean;
}

export interface NativePhoneDetection {
  isDetected: boolean;
  mode: string;
  confidence: number;
  box?: [number, number, number, number];
}

export interface NativeLandmarkPayload {
  faceLandmarks: NativeLandmark[];
  faceBlendshapes: NativeBlendshape[];
  facialTransformationMatrix: number[];
  hands: any[];
  headPose: NativeHeadPose;
  phoneDetection: NativePhoneDetection;
  timestamp: number;
  fps: number;
  source: 'usb' | 'front';
  frameCount: number;
}

export interface UsbDeviceMetadata {
  deviceName: string;
  productName?: string;
  vendorId: number;
  productId: number;
  isUvc: boolean;
  hasPermission?: boolean;
}

export interface NativeCameraStatus {
  active: boolean;
  source: 'usb' | 'front';
  fps?: number;
  width?: number;
  height?: number;
  error?: string;
}

// Event emitter singleton
const eventEmitter =
  Platform.OS === 'android' && UsbCameraDmsModule
    ? new NativeEventEmitter(UsbCameraDmsModule)
    : null;

/**
 * Check if an external USB/OTG camera is plugged in.
 */
export async function isUsbCameraAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android' || !UsbCameraDmsModule) return false;
  try {
    return await UsbCameraDmsModule.checkUsbCameraAvailable();
  } catch (err) {
    console.warn('[UsbDmsBridge] Error checking USB camera:', err);
    return false;
  }
}

/**
 * Enumerate connected USB devices.
 */
export async function getConnectedUsbDevices(): Promise<UsbDeviceMetadata[]> {
  if (Platform.OS !== 'android' || !UsbCameraDmsModule) return [];
  try {
    return await UsbCameraDmsModule.getConnectedUsbDevices();
  } catch (err) {
    console.warn('[UsbDmsBridge] Error fetching USB devices:', err);
    return [];
  }
}

/**
 * Request runtime permission for USB host device access.
 */
export async function requestUsbPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !UsbCameraDmsModule) return false;
  try {
    return await UsbCameraDmsModule.requestUsbPermission();
  } catch (err) {
    console.warn('[UsbDmsBridge] Error requesting USB permission:', err);
    return false;
  }
}

/**
 * Start native camera ingestion and landmark inference loop at 15 FPS.
 */
export async function startNativeMonitoring(
  source: 'usb' | 'front' = 'usb'
): Promise<boolean> {
  if (Platform.OS !== 'android' || !UsbCameraDmsModule) return false;
  try {
    return await UsbCameraDmsModule.startMonitoring(source);
  } catch (err) {
    console.warn('[UsbDmsBridge] Error starting native monitoring:', err);
    return false;
  }
}

/**
 * Halt native camera loop and release USB device connection.
 */
export async function stopNativeMonitoring(): Promise<boolean> {
  if (Platform.OS !== 'android' || !UsbCameraDmsModule) return false;
  try {
    return await UsbCameraDmsModule.stopMonitoring();
  } catch (err) {
    console.warn('[UsbDmsBridge] Error stopping native monitoring:', err);
    return false;
  }
}

/**
 * Switch between external USB dashcam and built-in front camera.
 */
export async function switchNativeCameraSource(
  source: 'usb' | 'front'
): Promise<boolean> {
  if (Platform.OS !== 'android' || !UsbCameraDmsModule) return false;
  try {
    return await UsbCameraDmsModule.switchCameraSource(source);
  } catch (err) {
    console.warn('[UsbDmsBridge] Error switching camera source:', err);
    return false;
  }
}

/**
 * Subscribe to native 15 FPS landmark packets.
 */
export function onNativeLandmarks(
  listener: (payload: NativeLandmarkPayload) => void
): () => void {
  if (!eventEmitter) return () => {};
  const subscription = eventEmitter.addListener('onDmsLandmarksDetected', listener);
  return () => subscription.remove();
}

/**
 * Subscribe to USB device plug events.
 */
export function onUsbAttached(
  listener: (device: UsbDeviceMetadata) => void
): () => void {
  if (!eventEmitter) return () => {};
  const subscription = eventEmitter.addListener('onUsbDeviceAttached', listener);
  return () => subscription.remove();
}

/**
 * Subscribe to USB device unplug events.
 */
export function onUsbDetached(
  listener: (device: UsbDeviceMetadata) => void
): () => void {
  if (!eventEmitter) return () => {};
  const subscription = eventEmitter.addListener('onUsbDeviceDetached', listener);
  return () => subscription.remove();
}

/**
 * Subscribe to native camera status changes.
 */
export function onCameraStatus(
  listener: (status: NativeCameraStatus) => void
): () => void {
  if (!eventEmitter) return () => {};
  const subscription = eventEmitter.addListener('onCameraStatusChanged', listener);
  return () => subscription.remove();
}

// Native view component registration
let NativePreviewComponent: React.ComponentType<ViewProps> | null = null;

if (Platform.OS === 'android') {
  try {
    NativePreviewComponent = requireNativeComponent<ViewProps>('UsbCameraPreviewView');
  } catch {
    NativePreviewComponent = null;
  }
}

export const UsbCameraPreviewView: React.FC<ViewProps> = (props) => {
  if (NativePreviewComponent) {
    return React.createElement(NativePreviewComponent, props);
  }
  return React.createElement(View, props);
};
