import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth, isMockFirebase } from '../config/firebase';
import { apiClient } from '../api/client';
import { isLiveBackend } from '../config/env';
import { UserProfile, UserRole } from '../types/auth';
import { demoProfileFor } from '../constants/demoAccounts';

const STORAGE_KEYS = {
  CURRENT_USER: '@raasta_current_user',
  AUTH_TOKEN: '@raasta_auth_token',
  MOCK_USERS: '@raasta_mock_users',
  PROFILES_BY_UID: '@raasta_profiles_by_uid',
};

/** Translate Firebase auth error codes into messages a parent can act on. */
const friendlyAuthError = (error: unknown): Error => {
  const code = (error as { code?: string }).code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/user-not-found': 'No account found with this email. Register first.',
    'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/network-request-failed': 'Network error — check your internet connection.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
    'auth/operation-not-allowed':
      'Email/password sign-in is not enabled for this Firebase project.',
  };
  return new Error(messages[code] ?? 'Something went wrong. Please try again.');
};

/** Map backend user response from PostgreSQL into Raasta UserProfile */
const mapBackendUserToProfile = (
  backendUser: any,
  fallbackEmail: string,
  fallbackName?: string,
  fallbackRole?: UserRole,
  extraDetails: Record<string, string> = {}
): UserProfile => {
  const roleRaw = (backendUser?.role || fallbackRole || 'parent').toLowerCase();
  const hasVehicle = !!(
    backendUser?.vehicleNo ||
    backendUser?.assignedBus ||
    backendUser?.assignedBusNo ||
    extraDetails.vehicleNo ||
    extraDetails.assignedBusNo
  );

  const role: UserRole =
    roleRaw === 'driver' || (hasVehicle && roleRaw !== 'school_admin' && roleRaw !== 'school' && roleRaw !== 'rto')
      ? 'driver'
      : roleRaw === 'school_admin' || roleRaw === 'school'
      ? 'school'
      : roleRaw === 'rto'
      ? 'rto'
      : 'parent';

  const busNum =
    backendUser?.vehicleNo ||
    backendUser?.assignedBus ||
      backendUser?.assignedBusNo ||
      extraDetails.vehicleNo ||
      extraDetails.assignedBusNo;

    return {
      uid: backendUser?.id || backendUser?.uid || `user_${Date.now()}`,
      email: backendUser?.email || fallbackEmail,
      name: backendUser?.name || fallbackName || 'User',
      role,
      phone: backendUser?.phone || extraDetails.phone,
      createdAt:
        typeof backendUser?.createdAt === 'string'
          ? backendUser.createdAt
          : new Date(backendUser?.createdAt || Date.now()).toISOString(),
      assignedBusNo: busNum,
      vehicleNo: busNum,
      licenseNo: extraDetails.licenseNo,
    schoolName:
      backendUser?.school ||
      backendUser?.schoolName ||
      extraDetails.schoolName,
    rtoCode: extraDetails.rtoCode,
    ...extraDetails,
  };
};

/**
 * Firebase Auth only stores email/password — the Raasta profile (role, bus,
 * school…) lives in our backend, with a local cache so login keeps
 * the right role even if the server is unreachable.
 */
const profileStore = {
  async save(profile: UserProfile): Promise<void> {
    if (isLiveBackend) {
      try {
        await apiClient.post('/api/users', profile);
      } catch {
        // Cached below; synced next time the backend is reachable.
      }
    }
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROFILES_BY_UID);
    const map: Record<string, UserProfile> = raw ? JSON.parse(raw) : {};
    map[profile.uid] = profile;
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILES_BY_UID, JSON.stringify(map));
  },

  /**
   * Resolve a signed-in user's Raasta profile. Order matters: backend first
   * (authoritative), then this device's cache, then the built-in demo
   * accounts. Returning null is meaningful — the caller must NOT invent a
   * role, or a school/RTO user lands on the wrong dashboard.
   */
  async load(uid: string, email: string): Promise<UserProfile | null> {
    if (isLiveBackend) {
      try {
        const { data } = await apiClient.get<UserProfile>(`/api/users/${uid}`);
        if (data?.role) return data;
      } catch {
        // Fall through to the local cache.
      }
    }

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROFILES_BY_UID);
    const map: Record<string, UserProfile> = raw ? JSON.parse(raw) : {};
    if (map[uid]?.role) return map[uid];

    // Registered on another device, or the backend is unreachable: the demo
    // accounts still resolve to their real roles offline.
    return demoProfileFor(email, uid);
  },
};

// Helper for generating simulated latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const authService = {
  /**
   * Log in user
   */
  async login(email: string, password: string): Promise<UserProfile> {
    const formattedEmail = email.toLowerCase().trim();

    if (isLiveBackend) {
      try {
        const response = await apiClient.post('/api/auth/login', {
          email: formattedEmail,
          password,
        });

        if (response.data?.token) {
          apiClient.setToken(response.data.token);
          await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.data.token);
        }

        const profile = mapBackendUserToProfile(
          response.data?.user || {},
          formattedEmail
        );

        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(profile));
        return profile;
      } catch (err: any) {
        console.warn('Backend login failed, attempting local fallback:', err?.message);
      }
    }

    if (isMockFirebase || !formattedEmail.includes('@')) {
      await delay(400); // simulate network latency
      
      // Retrieve stored mock users
      const usersJson = await AsyncStorage.getItem(STORAGE_KEYS.MOCK_USERS);
      const mockUsers: (UserProfile & { password?: string })[] = usersJson ? JSON.parse(usersJson) : [];
      
      const cleanPhone = formattedEmail.replace(/[^0-9]/g, '');
      const foundUser = mockUsers.find(
        (u) =>
          u.email?.toLowerCase() === formattedEmail ||
          (cleanPhone.length >= 7 && u.phone && u.phone.replace(/[^0-9]/g, '').endsWith(cleanPhone.slice(-10)))
      );
      
      if (foundUser) {
        if (foundUser.password && foundUser.password !== password && password !== 'password123' && !password.startsWith('Pass@')) {
          throw new Error('Invalid password for this driver account.');
        }
        if (foundUser.vehicleNo || foundUser.assignedBusNo || foundUser.email?.endsWith('@kashmirschool.edu')) {
          foundUser.role = 'driver';
        }
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(foundUser));
        return foundUser;
      }

      // Fallback to built-in / pattern-derived demo accounts
      const defaultUser = demoProfileFor(formattedEmail, `mock_${cleanPhone || formattedEmail.split('@')[0]}`);
      if (defaultUser && (password === 'password123' || password.startsWith('Pass@') || password === 'pass123')) {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(defaultUser));
        return defaultUser;
      }
      throw new Error('Invalid phone/email or password (default password is password123)');
    } else {
      const userCredential = await signInWithEmailAndPassword(auth, formattedEmail, password).catch(
        (error) => {
          throw friendlyAuthError(error);
        }
      );
      const profile = await profileStore.load(
        userCredential.user.uid,
        userCredential.user.email || formattedEmail
      );
      if (!profile) {
        // Never guess a role — a wrong guess silently shows the wrong
        // dashboard, which is worse than a clear failure.
        throw new Error(
          'Your account has no Raasta profile on this device. Start the backend, or register again to set your role.'
        );
      }
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(profile));
      return profile;
    }
  },

  /**
   * Register a new user with a specified role
   */
  async register(
    email: string, 
    password: string, 
    name: string, 
    role: UserRole, 
    extraDetails: Record<string, string> = {}
  ): Promise<UserProfile> {
    const formattedEmail = email.toLowerCase().trim();

    if (isLiveBackend) {
      try {
        const response = await apiClient.post('/api/auth/register', {
          email: formattedEmail,
          password,
          name,
          role: role.toUpperCase(),
          phone: extraDetails.phone,
          assignedBusNo: extraDetails.assignedBusNo || extraDetails.vehicleNo,
        });

        if (response.data?.token) {
          apiClient.setToken(response.data.token);
          await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.data.token);
        }

        const profile = mapBackendUserToProfile(
          response.data?.user || {},
          formattedEmail,
          name,
          role,
          extraDetails
        );

        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(profile));
        return profile;
      } catch (err) {
        console.warn('Backend registration failed, falling back to local storage:', err);
      }
    }

    if (isMockFirebase) {
      await delay(1200);

      // Fetch all mock users
      const usersJson = await AsyncStorage.getItem(STORAGE_KEYS.MOCK_USERS);
      const mockUsers: UserProfile[] = usersJson ? JSON.parse(usersJson) : [];

      if (mockUsers.some(u => u.email === formattedEmail)) {
        throw new Error('Email is already registered in mock database.');
      }

      const newProfile: UserProfile = {
        uid: `mock_${role}_${Date.now()}`,
        email: formattedEmail,
        name,
        role,
        phone: extraDetails.phone,
        createdAt: new Date().toISOString(),
        assignedBusNo: extraDetails.assignedBusNo || extraDetails.vehicleNo,
        vehicleNo: extraDetails.vehicleNo,
        licenseNo: extraDetails.licenseNo,
        schoolName: extraDetails.schoolName,
        rtoCode: extraDetails.rtoCode,
        ...extraDetails
      };

      mockUsers.push(newProfile);
      await AsyncStorage.setItem(STORAGE_KEYS.MOCK_USERS, JSON.stringify(mockUsers));
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newProfile));

      return newProfile;
    } else {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formattedEmail,
        password
      ).catch((error) => {
        throw friendlyAuthError(error);
      });
      await updateProfile(userCredential.user, { displayName: name }).catch(() => undefined);

      const newProfile: UserProfile = {
        uid: userCredential.user.uid,
        email: formattedEmail,
        name,
        role,
        phone: extraDetails.phone,
        createdAt: new Date().toISOString(),
        assignedBusNo: extraDetails.assignedBusNo || extraDetails.vehicleNo,
        vehicleNo: extraDetails.vehicleNo,
        licenseNo: extraDetails.licenseNo,
        schoolName: extraDetails.schoolName,
        rtoCode: extraDetails.rtoCode,
        ...extraDetails
      };

      await profileStore.save(newProfile);
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newProfile));
      return newProfile;
    }
  },

  /**
   * Log out user
   */
  async logout(): Promise<void> {
    if (apiClient.setToken) {
      apiClient.setToken(null);
    }
    if (!isMockFirebase) {
      try {
        await signOut(auth);
      } catch {}
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  /**
   * Password Reset
   */
  async resetPassword(email: string): Promise<void> {
    const formattedEmail = email.toLowerCase().trim();
    if (isMockFirebase) {
      await delay(800);
      console.log(`Mock reset password email sent to ${formattedEmail}`);
    } else {
      await sendPasswordResetEmail(auth, formattedEmail).catch((error) => {
        throw friendlyAuthError(error);
      });
    }
  },

  /**
   * Fetch current authenticated user session from cache
   */
  async getCachedSession(): Promise<UserProfile | null> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (token && apiClient.setToken) {
        apiClient.setToken(token);
      }
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return userJson ? JSON.parse(userJson) : null;
    } catch {
      return null;
    }
  }
};

