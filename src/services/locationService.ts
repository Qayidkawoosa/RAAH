import * as Location from 'expo-location';
import { TripPoint } from '../types/trip';

export type LocationUnsubscribe = () => void;

/**
 * Wraps expo-location and browser navigator.geolocation for 100% real driver GPS tracking.
 */
export const locationService = {
  async requestPermission(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          (err) => {
            console.warn('Browser GPS permission error or denied:', err);
            resolve(false);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  async getCurrentLocation(): Promise<TripPoint | null> {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              timestamp: pos.timestamp,
              speedKmh: Math.max(0, (pos.coords.speed ?? 0) * 3.6),
            });
          },
          (err) => {
            if (err.code === 1) {
              alert('Please allow location access in your browser settings to track this bus.');
            }
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
        );
      });
    }
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
        speedKmh: Math.max(0, (location.coords.speed ?? 0) * 3.6),
      };
    } catch {
      return null;
    }
  },

  async watchPosition(
    onPoint: (point: TripPoint) => void
  ): Promise<LocationUnsubscribe> {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      let lastTickTime = 0;
      const deliverFix = (pos: GeolocationPosition) => {
        lastTickTime = Date.now();
        onPoint({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: pos.timestamp || Date.now(),
          speedKmh: Math.max(0, (pos.coords.speed ?? 0) * 3.6),
        });
      };

      const watchId = navigator.geolocation.watchPosition(
        deliverFix,
        (err) => {
          console.warn('Browser GPS watch warning:', err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
      );

      // Periodic 1-second check to guarantee smooth 1 Hz tick broadcast even when device is stationary
      const intervalId = setInterval(() => {
        if (Date.now() - lastTickTime >= 1000) {
          navigator.geolocation.getCurrentPosition(
            deliverFix,
            () => {},
            { enableHighAccuracy: true, timeout: 3000, maximumAge: 1000 }
          );
        }
      }, 1000);

      return () => {
        navigator.geolocation.clearWatch(watchId);
        clearInterval(intervalId);
      };
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (location) => {
        onPoint({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: location.timestamp,
          speedKmh: Math.max(0, (location.coords.speed ?? 0) * 3.6),
        });
      }
    );
    return () => subscription.remove();
  },
};
