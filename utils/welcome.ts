import { loadData, saveData } from '@/utils/storage';

export const WELCOME_SEEN_KEY = 'finora.welcome.seen';

let seen = false;
let loadPromise: Promise<boolean> | null = null;

export function loadWelcomeSeen(): Promise<boolean> {
  if (!loadPromise) {
    loadPromise = loadData<boolean>(WELCOME_SEEN_KEY)
      .then((value) => {
        seen = value === true;
        return seen;
      })
      .catch(() => {
        seen = false;
        return seen;
      });
  }
  return loadPromise;
}

export function isWelcomeSeen(): boolean {
  return seen;
}

export async function markWelcomeSeen(): Promise<void> {
  seen = true;
  await saveData(WELCOME_SEEN_KEY, true);
}
