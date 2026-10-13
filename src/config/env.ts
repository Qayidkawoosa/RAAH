interface AppEnv {
  apiUrl: string;
  socketUrl: string;
  googleMapsApiKey: string;
}

const read = (value: string | undefined): string => (value ?? '').trim();

export const env: AppEnv = {
  apiUrl: read(process.env.EXPO_PUBLIC_API_URL),
  socketUrl:
    read(process.env.EXPO_PUBLIC_SOCKET_URL) || read(process.env.EXPO_PUBLIC_API_URL),
  googleMapsApiKey: read(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY),
};

/**
 * When EXPO_PUBLIC_API_URL is not set, the app runs in fully self-contained
 * demo mode: a simulated bus drives the demo route and all dashboards are
 * powered by local demo data. Setting the URL switches every service to the
 * live Express + Socket.IO backend automatically.
 */
export const isLiveBackend: boolean = env.apiUrl.length > 0;
