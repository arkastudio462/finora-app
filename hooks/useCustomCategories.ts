import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';

export const MAX_CATEGORY_LENGTH = 24;

function storageKey(userId?: string | null) {
  return `finora:custom_categories:${userId || 'local'}`;
}

function parseCategories(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function mergeCategories(...lists: string[][]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const item of list) {
      const key = item.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(item.trim());
    }
  }
  return result;
}

export function useCustomCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    const key = storageKey(user?.id);
    if (hydratedFor.current === key) return;

    let cancelled = false;

    (async () => {
      let saved: string[] = [];
      try {
        saved = parseCategories(await AsyncStorage.getItem(key));
      } catch {
        saved = [];
      }
      if (cancelled) return;
      hydratedFor.current = key;
      setCategories((prev) => mergeCategories(prev, saved));
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const addCategory = useCallback(
    async (raw: string): Promise<string | null> => {
      const name = raw.trim();
      if (!name) return 'Kategori tidak boleh kosong';
      if (name.length > MAX_CATEGORY_LENGTH) return `Maksimal ${MAX_CATEGORY_LENGTH} karakter`;

      const key = storageKey(user?.id);

      let saved: string[] = [];
      try {
        saved = parseCategories(await AsyncStorage.getItem(key));
      } catch {
        saved = [];
      }

      const exists =
        name.toLowerCase() === 'other' ||
        saved.some((c) => c.toLowerCase() === name.toLowerCase()) ||
        categories.some((c) => c.toLowerCase() === name.toLowerCase());
      if (exists) return 'Kategori sudah ada';

      const next = mergeCategories(saved, [...categories, name]);
      setCategories(next);

      try {
        await AsyncStorage.setItem(key, JSON.stringify(next));
      } catch (e) {
        console.warn('Gagal persist kategori custom:', e);
      }
      return null;
    },
    [categories, user?.id]
  );

  return { categories, addCategory };
}
