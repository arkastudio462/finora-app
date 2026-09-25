import * as SecureStore from 'expo-secure-store';

export async function saveData<T>(key: string, data: T): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

export async function loadData<T>(key: string): Promise<T | null> {
  try {
    const json = await SecureStore.getItemAsync(key);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Failed to load data:', e);
    return null;
  }
}

export async function removeData(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    console.error('Failed to remove data:', e);
  }
}

export const KEYS = {
  user: 'finora_user',
} as const;
