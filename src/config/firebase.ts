import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import { initializeAuth, getAuth, Auth, Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Present at runtime in Firebase's React Native entrypoint, but missing from
// the public typings (firebase/firebase-js-sdk#7615).
const getReactNativePersistence = (
  firebaseAuth as unknown as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  }
).getReactNativePersistence;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const hasCredentials = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let app: FirebaseApp | undefined;
let authInstance: Auth | null = null;

if (hasCredentials) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    try {
      // AsyncStorage persistence keeps the Firebase session across restarts.
      if (typeof getReactNativePersistence === 'function') {
        authInstance = initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } else {
        authInstance = getAuth(app);
      }
    } catch {
      // initializeAuth throws if already initialized (fast refresh) — reuse it.
      authInstance = getAuth(app);
    }
    console.log('Firebase initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase, falling back to mock mode:', error);
  }
} else {
  console.warn('Firebase environment variables missing. Running in Mock Authentication mode.');
}

export const isMockFirebase = !authInstance;
/** Only valid when isMockFirebase is false — every caller checks that first. */
export const auth = authInstance as Auth;
export default app;
