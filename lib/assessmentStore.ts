import AsyncStorage from '@react-native-async-storage/async-storage';

export type Athlete = { name: string; age: string; gender: string; weight: string };
export type TestResult = {
  id: string; test: string; value: number; unit: string;
  date: string; details?: Record<string, string | number>;
};
const PROFILE_KEY = '@sai/profile';
const RESULTS_KEY = '@sai/results';

export async function saveProfile(profile: Athlete) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
export async function getProfile(): Promise<Athlete | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
}
export async function getResults(): Promise<TestResult[]> {
  const raw = await AsyncStorage.getItem(RESULTS_KEY);
  return raw ? JSON.parse(raw) : [];
}
export async function saveResult(input: Omit<TestResult, 'id' | 'date'> & { date?: string }) {
  const existing = await getResults();
  const result: TestResult = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: input.date || new Date().toISOString(),
  };
  await AsyncStorage.setItem(RESULTS_KEY, JSON.stringify([result, ...existing]));
  return result;
}
export async function clearResults() {
  await AsyncStorage.removeItem(RESULTS_KEY);
}
