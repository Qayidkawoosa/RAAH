import * as Location from 'expo-location';
import { TripPoint } from '../types/trip';

export type LocationUnsubscribe = () => void;

/**
 * Wraps expo-location for driver GPS tracking. If permission is denied (or
 * the emulator has no GPS fix), the TripContext falls back to the demo
 * simulator so the demo always works.
 */
export const locationService = {
  async requestPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  async getCurrentLocation(): Promise<TripPoint | null> {
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
