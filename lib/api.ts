import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// IMPORTANT:
// - Android emulator: http://10.0.2.2:5000
// - iOS simulator: http://localhost:5000
// - Physical phone: http://YOUR_COMPUTER_IPV4:5000
// Replace the value below with your computer's IPv4 address when testing on a phone.
export const API_BASE_URL = 'http://192.168.88.7:8082';

const TOKEN_KEY = '@sai/authToken';
const USER_KEY = '@sai/authUser';

export type AccountRole = 'athlete' | 'coach';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  age?: number;
  gender?: string;
  weight?: number;
  discoverable?: boolean;
  organization?: string;
  specialization?: string;
  bio?: string;
};

export async function saveAuth(token: string, user: AuthUser) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function getAuthToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearAuth() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    body?: unknown;
    authenticated?: boolean;
  } = {}
): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.authenticated !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (_error) {
    throw new Error(
      `Cannot reach the SAI server at ${API_BASE_URL}. Check that the backend is running and that your phone and computer are on the same Wi-Fi.`
    );
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data as T;
}
