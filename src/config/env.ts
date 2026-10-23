import { Platform } from 'react-native';

interface AppEnv {
  apiUrl: string;
  socketUrl: string;
  googleMapsApiKey: string;
}

const read = (value: string | undefined): string => (value ?? '').trim();

const resolveBackendUrl = (): string => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:4000`;
    }
    return 'http://localhost:4000';
  }
  return read(process.env.EXPO_PUBLIC_API_URL) || 'http://192.168.2.245:4000';
};

const resolvedUrl = resolveBackendUrl();

export const env: AppEnv = {
  apiUrl: resolvedUrl,
  socketUrl:
    read(process.env.EXPO_PUBLIC_SOCKET_URL) ||
    resolvedUrl,
  googleMapsApiKey: read(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY),
};

/**
 * Always live — the app connects to the production Socket.IO / Express
 * backend. The offline bus simulator is permanently disabled.
 */
export const isLiveBackend: boolean = true;
