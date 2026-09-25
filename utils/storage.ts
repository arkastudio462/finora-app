import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

async function read(key: string): Promise<string | null> {
  return isWeb ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
}

async function write(key: string, value: string): Promise<void> {
  if (isWeb) await AsyncStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

async function erase(key: string): Promise<void> {
  if (isWeb) await AsyncStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}

export async function saveData<T>(key: string, data: T): Promise<void> {
  try {
    await write(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

export async function loadData<T>(key: string): Promise<T | null> {
  try {
    const json = await read(key);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Failed to load data:', e);
    return null;
  }
}

export async function removeData(key: string): Promise<void> {
  try {
    await erase(key);
  } catch (e) {
    console.error('Failed to remove data:', e);
  }
}

export const KEYS = {
  user: 'finora_user',
} as const;
