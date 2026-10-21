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
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 5000 }
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
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          onPoint({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: pos.timestamp,
            speedKmh: Math.max(0, (pos.coords.speed ?? 0) * 3.6),
          });
        },
        (err) => console.warn('Browser GPS error:', err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 5,
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
