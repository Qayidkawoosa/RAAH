import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';

export interface ApiClientInstance extends AxiosInstance {
  setToken: (token: string | null) => void;
}

const baseClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Shared axios instance for the Raasta backend. Only used when
 * EXPO_PUBLIC_API_URL is configured (isLiveBackend === true).
 */
export const apiClient: ApiClientInstance = Object.assign(baseClient, {
  setToken(token: string | null) {
    if (token) {
      baseClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete baseClient.defaults.headers.common['Authorization'];
    }
  },
});

export const extractApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Unexpected network error';
};
