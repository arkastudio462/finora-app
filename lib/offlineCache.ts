import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Budget,
  Debt,
  DebtPayment,
  RecurringTransaction,
  Transaction,
} from '@/context/FinanceContext';

export interface CachedFinance {
  savedAt: number;
  income: number;
  expense: number;
  monthIncome: number;
  monthExpense: number;
  transactions: Transaction[];
  totalTransactions: number;
  budgets: Budget[];
  recurring: RecurringTransaction[];
  debts: Debt[];
  debtPayments: DebtPayment[];
}

export interface CachedTrendRow {
  type: string;
  amount: number | string;
  date: string;
}

const financeKey = (userId: string) => `finora:cache:${userId}:finance`;
const trendKey = (userId: string) => `finora:cache:${userId}:trend`;

export async function readFinanceCache(userId: string): Promise<CachedFinance | null> {
  try {
    const raw = await AsyncStorage.getItem(financeKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedFinance;
    if (!parsed || typeof parsed.savedAt !== 'number' || !Array.isArray(parsed.transactions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeFinanceCache(userId: string, data: CachedFinance): Promise<void> {
  try {
    await AsyncStorage.setItem(financeKey(userId), JSON.stringify(data));
  } catch {
  }
}

export async function readTrendCache(userId: string): Promise<CachedTrendRow[] | null> {
  try {
    const raw = await AsyncStorage.getItem(trendKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedTrendRow[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeTrendCache(userId: string, rows: CachedTrendRow[]): Promise<void> {
  try {
    await AsyncStorage.setItem(trendKey(userId), JSON.stringify(rows));
  } catch {
  }
}
