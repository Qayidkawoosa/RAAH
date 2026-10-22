interface AppEnv {
  apiUrl: string;
  socketUrl: string;
  googleMapsApiKey: string;
}

const read = (value: string | undefined): string => (value ?? '').trim();

const DEFAULT_BACKEND_URL = 'http://103.14.120.52:4260';

export const env: AppEnv = {
  apiUrl: read(process.env.EXPO_PUBLIC_API_URL) || DEFAULT_BACKEND_URL,
  socketUrl:
    read(process.env.EXPO_PUBLIC_SOCKET_URL) ||
    read(process.env.EXPO_PUBLIC_API_URL) ||
    DEFAULT_BACKEND_URL,
  googleMapsApiKey: read(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY),
};

/**
 * Always live — the app connects to the production Socket.IO / Express
 * backend. The offline bus simulator is permanently disabled.
 */
export const isLiveBackend: boolean = true;
