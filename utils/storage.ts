import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  finance: 'finora_finance',
  transactions: 'finora_transactions',
  budgets: 'finora_budgets',
  user: 'finora_user',
} as const;

export async function saveData<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

export async function loadData<T>(key: string): Promise<T | null> {
  try {
    const json = await AsyncStorage.getItem(key);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Failed to load data:', e);
    return null;
  }
}

export async function removeData(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.error('Failed to remove data:', e);
  }
}

export { KEYS };
