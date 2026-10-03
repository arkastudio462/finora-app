import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { RECEIPTS_BUCKET, removeImageFile, removeStagedFile } from '@/lib/images';
import { useAuth } from '@/hooks/useAuth';
import { formatRupiah } from '@/utils/format';
import { newId } from '@/lib/id';
import { readFinanceCache, writeFinanceCache, type CachedFinance } from '@/lib/offlineCache';
import {
  OFFLINE_MESSAGE,
  enqueueOutbox,
  flushOutbox,
  isNetworkError,
  outboxCount,
  type BudgetPatch,
  type BudgetRow,
  type DebtPatch,
  type DebtPaymentRow,
  type DebtRow,
  type OutboxOp,
  type RecurringPatch,
  type RecurringRow,
  type TxPatch,
  type TxRow,
} from '@/lib/outbox';

export type PaymentMethod = 'cash' | 'non_cash';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  amount: number;
  payment_method: PaymentMethod;
  image_path: string | null;
  date: string;
  local_image_uri?: string | null;
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringTransaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  amount: number;
  payment_method: PaymentMethod;
  frequency: RecurringFrequency;
  next_date: string;
  active: boolean;
}

interface FinanceState {
  income: number;
  expense: number;
  monthIncome: number;
  monthExpense: number;
  transactions: Transaction[];
  budgets: Budget[];
  isLoaded: boolean;
  isLoading: boolean;
  loadError: string | null;
  totalTransactions: number;
  isLoadingMore: boolean;
  recurring: RecurringTransaction[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  stale: boolean;
  lastSyncAt: number | null;
  pendingCount: number;
  syncError: string | null;
}

type FinanceAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'APPEND_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'LOAD_MORE_START' }
  | { type: 'LOAD_MORE_END' }
  | { type: 'LOAD_DATA'; payload: Partial<FinanceState> }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'ADD_BUDGET'; payload: Budget }
  | { type: 'UPDATE_BUDGET'; payload: Budget }
  | { type: 'DELETE_BUDGET'; payload: string }
  | { type: 'SET_RECURRING'; payload: RecurringTransaction[] }
  | { type: 'ADD_RECURRING'; payload: RecurringTransaction }
  | { type: 'UPDATE_RECURRING'; payload: RecurringTransaction }
  | { type: 'DELETE_RECURRING'; payload: string }
  | { type: 'SET_DEBTS'; payload: Debt[] }
  | { type: 'ADD_DEBT'; payload: Debt }
  | { type: 'UPDATE_DEBT'; payload: Debt }
  | { type: 'DELETE_DEBT'; payload: string }
  | { type: 'SET_DEBT_PAYMENTS'; payload: DebtPayment[] }
  | { type: 'ADD_DEBT_PAYMENT'; payload: DebtPayment }
  | { type: 'SET_SYNC'; payload: Partial<Pick<FinanceState, 'stale' | 'lastSyncAt' | 'pendingCount' | 'syncError'>> };

const initialState: FinanceState = {
  income: 0,
  expense: 0,
  monthIncome: 0,
  monthExpense: 0,
  transactions: [],
  budgets: [],
  isLoaded: false,
  isLoading: false,
  loadError: null,
  totalTransactions: 0,
  isLoadingMore: false,
  recurring: [],
  debts: [],
  debtPayments: [],
  stale: false,
  lastSyncAt: null,
  pendingCount: 0,
  syncError: null,
};

const PAGE_SIZE = 100;

function isCurrentMonth(dateString: string): boolean {
  const now = new Date();
  const d = new Date(dateString);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function monthStartISO(): string {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function financeReducer(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, isLoading: true, loadError: null };

    case 'LOAD_ERROR':
      return { ...state, isLoading: false, isLoaded: true, loadError: action.payload };

    case 'LOAD_MORE_START':
      return { ...state, isLoadingMore: true };

    case 'LOAD_MORE_END':
      return { ...state, isLoadingMore: false };

    case 'APPEND_TRANSACTIONS':
      return {
        ...state,
        isLoadingMore: false,
        transactions: [...state.transactions, ...action.payload],
      };

    case 'LOAD_DATA':
      return { ...state, ...action.payload, isLoaded: true, isLoading: false, loadError: null };

    case 'ADD_TRANSACTION': {
      const t = action.payload;
      return {
        ...state,
        transactions: [t, ...state.transactions],
        totalTransactions: state.totalTransactions + 1,
        income: t.type === 'income' ? state.income + t.amount : state.income,
        expense: t.type === 'expense' ? state.expense + t.amount : state.expense,
        monthIncome:
          t.type === 'income' && isCurrentMonth(t.date)
            ? state.monthIncome + t.amount
            : state.monthIncome,
        monthExpense:
          t.type === 'expense' && isCurrentMonth(t.date)
            ? state.monthExpense + t.amount
            : state.monthExpense,
      };
    }

    case 'UPDATE_TRANSACTION': {
      const updated = action.payload;
      const old = state.transactions.find((t) => t.id === updated.id);
      if (!old) return state;

      let income = state.income;
      let expense = state.expense;
      let monthIncome = state.monthIncome;
      let monthExpense = state.monthExpense;

      if (old.type === 'income') income -= old.amount;
      else expense -= old.amount;
      if (isCurrentMonth(old.date)) {
        if (old.type === 'income') monthIncome -= old.amount;
        else monthExpense -= old.amount;
      }

      if (updated.type === 'income') income += updated.amount;
      else expense += updated.amount;
      if (isCurrentMonth(updated.date)) {
        if (updated.type === 'income') monthIncome += updated.amount;
        else monthExpense += updated.amount;
      }

      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === updated.id ? updated : t)),
        income,
        expense,
        monthIncome,
        monthExpense,
      };
    }

    case 'DELETE_TRANSACTION': {
      const deleted = state.transactions.find((t) => t.id === action.payload);
      if (!deleted) return state;

      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.payload),
        totalTransactions: Math.max(0, state.totalTransactions - 1),
        income: deleted.type === 'income' ? state.income - deleted.amount : state.income,
        expense: deleted.type === 'expense' ? state.expense - deleted.amount : state.expense,
        monthIncome:
          deleted.type === 'income' && isCurrentMonth(deleted.date)
            ? Math.max(0, state.monthIncome - deleted.amount)
            : state.monthIncome,
        monthExpense:
          deleted.type === 'expense' && isCurrentMonth(deleted.date)
            ? Math.max(0, state.monthExpense - deleted.amount)
            : state.monthExpense,
      };
    }

    case 'ADD_BUDGET':
      return { ...state, budgets: [...state.budgets, action.payload] };

    case 'UPDATE_BUDGET':
      return {
        ...state,
        budgets: state.budgets.map((b) => (b.id === action.payload.id ? action.payload : b)),
      };

    case 'DELETE_BUDGET':
      return { ...state, budgets: state.budgets.filter((b) => b.id !== action.payload) };

    case 'SET_RECURRING':
      return { ...state, recurring: action.payload };

    case 'ADD_RECURRING':
      return { ...state, recurring: [action.payload, ...state.recurring] };

    case 'UPDATE_RECURRING':
      return {
        ...state,
        recurring: state.recurring.map((r) => (r.id === action.payload.id ? action.payload : r)),
      };

    case 'DELETE_RECURRING':
      return { ...state, recurring: state.recurring.filter((r) => r.id !== action.payload) };

    case 'SET_DEBTS':
      return { ...state, debts: action.payload };

    case 'ADD_DEBT':
      return { ...state, debts: [action.payload, ...state.debts] };

    case 'UPDATE_DEBT':
      return {
        ...state,
        debts: state.debts.map((d) => (d.id === action.payload.id ? action.payload : d)),
      };

    case 'DELETE_DEBT':
      return {
        ...state,
        debts: state.debts.filter((d) => d.id !== action.payload),
        debtPayments: state.debtPayments.filter((p) => p.debt_id !== action.payload),
      };

    case 'SET_DEBT_PAYMENTS':
      return { ...state, debtPayments: action.payload };

    case 'ADD_DEBT_PAYMENT':
      return { ...state, debtPayments: [...state.debtPayments, action.payload] };

    case 'SET_SYNC':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

function getWriteErrorMessage(error: { code?: string; message?: string }): string {
  if (isNetworkError(error)) return OFFLINE_MESSAGE;

  const code = error.code || '';
  const message = error.message || '';

  if (message.includes('image_path')) {
    return 'Kolom image_path belum ada di database. Jalankan supabase/upgrade_images.sql di Supabase SQL Editor, lalu coba lagi.';
  }
  if (message.includes('debt_payments') || message.includes('debts')) {
    return 'Tabel hutang & tagihan belum ada di database. Jalankan supabase/debts.sql di Supabase SQL Editor, lalu coba lagi.';
  }
  if (message.includes('recurring_transactions')) {
    return 'Tabel transaksi berulang belum ada di database. Jalankan supabase/recurring_transactions.sql di Supabase SQL Editor, lalu coba lagi.';
  }
  if (message.includes('payment_method')) {
    return 'Kolom payment_method belum ada di database. Jalankan supabase/upgrade_payment_method.sql di Supabase SQL Editor, lalu coba lagi.';
  }
  if (code === '42703' || code === 'PGRST204') {
    return `Kolom tidak ditemukan di database (${message}). Jalankan file SQL upgrade terbaru di Supabase SQL Editor.`;
  }
  if (code === '42P01' || (message.includes('relation') && message.includes('does not exist'))) {
    return 'Tabel belum dibuat. Jalankan supabase/migration.sql di Supabase SQL Editor.';
  }
  if (code === 'PGRST301' || code === '42501') {
    return 'Tidak punya akses menyimpan data. Silakan login ulang.';
  }
  return `Gagal menyimpan: ${message || code || 'unknown error'}`;
}

function getReadErrorMessage(error: { code?: string; message?: string }): string {
  if (isNetworkError(error)) return OFFLINE_MESSAGE;

  const code = error.code || '';
  const message = error.message || '';

  if (code === 'PGRST301' || code === '42501') {
    return 'Tidak punya akses membaca data. Silakan login ulang.';
  }
  if (code === '42P01' || (message.includes('relation') && message.includes('does not exist'))) {
    return 'Tabel belum dibuat. Jalankan supabase/migration.sql di Supabase SQL Editor.';
  }
  if (code === '42703' || code === 'PGRST204') {
    return `Kolom tidak ditemukan di database (${message}). Jalankan file SQL upgrade terbaru di Supabase SQL Editor.`;
  }
  return `Gagal memuat data: ${message || code || 'unknown error'}`;
}

type NetOk<T> = { ok: true; data: T };
type NetFail = { ok: false; offline: boolean; message: string };

async function net<T>(
  run: () => PromiseLike<{ data: unknown; error: unknown }>,
  kind: 'read' | 'write' = 'write'
): Promise<NetOk<T> | NetFail> {
  try {
    const { data, error } = await run();
    if (error) {
      const err = error as { code?: string; message?: string };
      if (isNetworkError(err)) return { ok: false, offline: true, message: OFFLINE_MESSAGE };
      if (err.code === '23505' || /duplicate key value/i.test(err.message || '')) {
        return { ok: true, data: null as unknown as T };
      }
      const message = kind === 'read' ? getReadErrorMessage(err) : getWriteErrorMessage(err);
      return { ok: false, offline: false, message };
    }
    return { ok: true, data: data as T };
  } catch (e) {
    if (isNetworkError(e)) return { ok: false, offline: true, message: OFFLINE_MESSAGE };
    return { ok: false, offline: false, message: e instanceof Error ? e.message : String(e) };
  }
}

function cacheToPayload(cache: CachedFinance, stale: boolean): Partial<FinanceState> {
  return {
    income: cache.income,
    expense: cache.expense,
    monthIncome: cache.monthIncome,
    monthExpense: cache.monthExpense,
    transactions: cache.transactions,
    totalTransactions: cache.totalTransactions,
    budgets: cache.budgets,
    recurring: cache.recurring,
    debts: cache.debts,
    debtPayments: cache.debtPayments,
    stale,
    lastSyncAt: cache.savedAt,
  };
}

function mapTransaction(t: Record<string, unknown>): Transaction {
  return {
    id: String(t.id),
    type: t.type === 'income' ? 'income' : 'expense',
    description: String(t.description ?? ''),
    category: String(t.category ?? 'Other'),
    amount: Number(t.amount) || 0,
    payment_method: t.payment_method === 'non_cash' ? 'non_cash' : 'cash',
    image_path: (t.image_path as string | null) ?? null,
    date: String(t.date ?? ''),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y || 2000, (m || 1) - 1, d || 1);
}

function addFrequency(d: Date, frequency: RecurringFrequency): Date {
  if (frequency === 'daily') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  if (frequency === 'weekly') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
  if (frequency === 'yearly') return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate());
  return new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function nextDueDate(currentKey: string, frequency: RecurringFrequency): string {
  const today = dateKey(new Date());
  let d = parseDateKey(currentKey);
  let guard = 0;
  while (dateKey(d) <= today && guard < 1000) {
    d = addFrequency(d, frequency);
    guard += 1;
  }
  return dateKey(d);
}

function mapRecurring(r: Record<string, unknown>): RecurringTransaction {
  return {
    id: String(r.id),
    type: r.type === 'income' ? 'income' : 'expense',
    description: String(r.description ?? ''),
    category: String(r.category ?? 'Other'),
    amount: Number(r.amount) || 0,
    payment_method: r.payment_method === 'non_cash' ? 'non_cash' : 'cash',
    frequency:
      r.frequency === 'weekly' ? 'weekly' : r.frequency === 'yearly' ? 'yearly' : 'monthly',
    next_date: String(r.next_date ?? ''),
    active: r.active !== false,
  };
}

export type DebtKind = 'payable' | 'receivable';
export type DebtStatus = 'open' | 'paid';

export interface Debt {
  id: string;
  kind: DebtKind;
  counterparty: string;
  description: string;
  amount: number;
  category: string;
  payment_method: PaymentMethod;
  due_date: string | null;
  status: DebtStatus;
  created_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  transaction_id: string | null;
  note: string | null;
  paid_at: string;
}

function mapDebt(d: Record<string, unknown>): Debt {
  return {
    id: String(d.id),
    kind: d.kind === 'receivable' ? 'receivable' : 'payable',
    counterparty: String(d.counterparty ?? ''),
    description: String(d.description ?? ''),
    amount: Number(d.amount) || 0,
    category: String(d.category ?? 'Other'),
    payment_method: d.payment_method === 'non_cash' ? 'non_cash' : 'cash',
    due_date: (d.due_date as string | null) ?? null,
    status: d.status === 'paid' ? 'paid' : 'open',
    created_at: String(d.created_at ?? ''),
  };
}

function mapDebtPayment(p: Record<string, unknown>): DebtPayment {
  return {
    id: String(p.id),
    debt_id: String(p.debt_id),
    amount: Number(p.amount) || 0,
    transaction_id: (p.transaction_id as string | null) ?? null,
    note: (p.note as string | null) ?? null,
    paid_at: String(p.paid_at ?? ''),
  };
}

interface FinanceContextType {
  state: FinanceState;
  reload: () => Promise<void>;
  syncNow: () => Promise<void>;
  loadMoreTransactions: () => Promise<string | null>;
  getAllTransactions: () => Promise<{ rows: Transaction[]; partial?: boolean } | { error: string }>;
  addTransaction: (
    t: Omit<Transaction, 'id' | 'date'> & { localImageUri?: string | null }
  ) => Promise<string | null>;
  updateTransaction: (t: Transaction & { localImageUri?: string | null }) => Promise<string | null>;
  deleteTransaction: (id: string) => Promise<void>;
  addRecurring: (r: Omit<RecurringTransaction, 'id'>) => Promise<string | null>;
  updateRecurring: (r: RecurringTransaction) => Promise<string | null>;
  deleteRecurring: (id: string) => Promise<string | null>;
  addDebt: (d: Omit<Debt, 'id' | 'created_at'>) => Promise<string | null>;
  updateDebt: (d: Debt) => Promise<string | null>;
  deleteDebt: (id: string) => Promise<string | null>;
  addDebtPayment: (
    debtId: string,
    amount: number,
    note?: string,
    paymentMethod?: PaymentMethod
  ) => Promise<string | null>;
  getDebtPaid: (debtId: string) => number;
  addBudget: (category: string, amount: number) => Promise<string | null>;
  updateBudget: (b: Budget) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  getSpendingByCategory: () => Record<string, number>;
  getBudgetSpent: (category: string) => number;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(financeReducer, initialState);
  const { user } = useAuth();

  const hydratedRef = useRef(false);
  const syncingRef = useRef(false);
  const staleRef = useRef(false);

  useEffect(() => {
    staleRef.current = state.stale;
  }, [state.stale]);

  useEffect(() => {
    if (!user) {
      hydratedRef.current = false;
      dispatch({ type: 'LOAD_DATA', payload: initialState });
      return;
    }

    fetchData()
      .catch(() => undefined)
      .then(() => syncNow());
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncNow();
    });

    const timer = setInterval(() => {
      if (state.pendingCount > 0 || state.stale) void syncNow();
    }, 30000);

    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [user, state.pendingCount, state.stale]);

  const recurringBusyRef = useRef(false);

  const processRecurring = async () => {
    if (!user || recurringBusyRef.current) return;
    recurringBusyRef.current = true;

    try {
      const today = dateKey(new Date());
      const { data: due, error: dueError } = await supabase
        .from('recurring_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .lte('next_date', today);

      if (dueError || !due || due.length === 0) return;

      const inserts = due.map((r) => {
        const when = parseDateKey(String(r.next_date));
        when.setHours(12, 0, 0, 0);
        return {
          user_id: user.id,
          type: r.type,
          description: r.description,
          category: r.category,
          amount: r.amount,
          payment_method: r.payment_method,
          image_path: null,
          date: when.toISOString(),
        };
      });

      const { error: insertError } = await supabase.from('transactions').insert(inserts);
      if (insertError) return;

      await Promise.all(
        due.map(async (r) => {
          const next = nextDueDate(String(r.next_date), r.frequency as RecurringFrequency);
          await supabase
            .from('recurring_transactions')
            .update({ next_date: next })
            .eq('id', r.id)
            .eq('user_id', user.id);
        })
      );
    } catch {
      // auto-create is best-effort; never block the dashboard
    } finally {
      recurringBusyRef.current = false;
    }
  };

  const fetchData = async () => {
    if (!user) return;

    const cached = await readFinanceCache(user.id);

    dispatch({ type: 'LOAD_START' });

    if (cached && !hydratedRef.current) {
      hydratedRef.current = true;
      dispatch({ type: 'LOAD_DATA', payload: cacheToPayload(cached, false) });
      dispatch({ type: 'LOAD_START' });
    }

    await processRecurring();

    const [sumResult, monthSumResult, txResult, budgetResult, recurringResult, debtsResult, paymentsResult] = await Promise.all([
      supabase.from('transactions').select('type, amount').eq('user_id', user.id),
      supabase
        .from('transactions')
        .select('type, amount')
        .eq('user_id', user.id)
        .gte('date', monthStartISO()),
      supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .range(0, PAGE_SIZE - 1),
      supabase.from('budgets').select('*').eq('user_id', user.id),
      supabase
        .from('recurring_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('next_date', { ascending: true }),
      supabase
        .from('debts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('debt_payments')
        .select('*')
        .eq('user_id', user.id)
        .order('paid_at', { ascending: false }),
    ]);

    const readError = sumResult.error || txResult.error || budgetResult.error;
    if (readError) {
      const offline = isNetworkError(readError);
      const fallback = cached ?? (await readFinanceCache(user.id));
      if (fallback) {
        dispatch({ type: 'LOAD_DATA', payload: cacheToPayload(fallback, offline) });
      } else {
        dispatch({ type: 'LOAD_ERROR', payload: getReadErrorMessage(readError) });
        dispatch({ type: 'SET_SYNC', payload: { stale: offline } });
      }
      dispatch({ type: 'SET_SYNC', payload: { pendingCount: await outboxCount(user.id) } });
      return;
    }

    const partialOffline = [recurringResult.error, debtsResult.error, paymentsResult.error].some(
      (error) => !!error && isNetworkError(error)
    );

    const transactions: Transaction[] = (txResult.data || []).map(mapTransaction);
    const budgets: Budget[] = (budgetResult.data || []).map((b) => ({
      id: b.id,
      category: b.category,
      amount: b.amount,
    }));

    const recurring: RecurringTransaction[] = recurringResult.error
      ? (cached?.recurring ?? [])
      : (recurringResult.data || []).map(mapRecurring);

    const debts: Debt[] = debtsResult.error
      ? (cached?.debts ?? [])
      : (debtsResult.data || []).map(mapDebt);

    const debtPayments: DebtPayment[] = paymentsResult.error
      ? (cached?.debtPayments ?? [])
      : (paymentsResult.data || []).map(mapDebtPayment);

    let income = 0;
    let expense = 0;
    for (const row of sumResult.data || []) {
      if (row.type === 'income') income += Number(row.amount) || 0;
      else expense += Number(row.amount) || 0;
    }

    let monthIncome = 0;
    let monthExpense = 0;
    for (const row of monthSumResult.data || []) {
      if (row.type === 'income') monthIncome += Number(row.amount) || 0;
      else monthExpense += Number(row.amount) || 0;
    }

    const syncedAt = partialOffline ? (cached?.savedAt ?? null) : Date.now();

    dispatch({
      type: 'LOAD_DATA',
      payload: {
        income,
        expense,
        monthIncome,
        monthExpense,
        transactions,
        budgets,
        totalTransactions: txResult.count ?? transactions.length,
        recurring,
        debts,
        debtPayments,
        stale: partialOffline,
        lastSyncAt: syncedAt,
      },
    });

    dispatch({ type: 'SET_SYNC', payload: { pendingCount: await outboxCount(user.id) } });

    if (!partialOffline) {
      hydratedRef.current = true;
      await writeFinanceCache(user.id, {
        savedAt: syncedAt ?? Date.now(),
        income,
        expense,
        monthIncome,
        monthExpense,
        transactions,
        totalTransactions: txResult.count ?? transactions.length,
        budgets,
        recurring,
        debts,
        debtPayments,
      });
    }
  };

  const syncNow = async () => {
    if (!user || syncingRef.current) return;

    syncingRef.current = true;
    try {
      const pending = await outboxCount(user.id);
      if (pending > 0) {
        const outcome = await flushOutbox(user.id);
        const remaining = await outboxCount(user.id);
        dispatch({ type: 'SET_SYNC', payload: { pendingCount: remaining, syncError: outcome.error } });

        if (outcome.empty) {
          await fetchData();
          return;
        }
      }

      if (staleRef.current) await fetchData();
    } finally {
      syncingRef.current = false;
    }
  };

  const loadMoreTransactions = async (): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const from = state.transactions.length;
    if (from >= state.totalTransactions) return null;

    dispatch({ type: 'LOAD_MORE_START' });

    const result = await net(
      () =>
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .range(from, from + PAGE_SIZE - 1),
      'read'
    );

    if (!result.ok) {
      dispatch({ type: 'LOAD_MORE_END' });
      return result.message;
    }

    dispatch({ type: 'APPEND_TRANSACTIONS', payload: ((result.data as Record<string, unknown>[]) || []).map(mapTransaction) });
    return null;
  };

  const queueOutbox = async (op: OutboxOp, optimistic: () => void): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    await enqueueOutbox(user.id, op);
    optimistic();
    dispatch({
      type: 'SET_SYNC',
      payload: { pendingCount: await outboxCount(user.id), syncError: null },
    });
    return null;
  };

  const addTransaction = async (
    t: Omit<Transaction, 'id' | 'date'> & { localImageUri?: string | null }
  ): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const txId = newId();
    const row: TxRow = {
      id: txId,
      user_id: user.id,
      type: t.type,
      description: t.description,
      category: t.category,
      amount: t.amount,
      payment_method: t.payment_method,
      image_path: t.image_path ?? null,
      date: new Date().toISOString(),
    };

    const queued: OutboxOp = {
      id: newId(),
      kind: 'addTransaction',
      row,
      localImageUri: t.localImageUri ?? null,
      createdAt: Date.now(),
    };

    const optimistic = () =>
      dispatch({
        type: 'ADD_TRANSACTION',
        payload: { ...row, local_image_uri: t.localImageUri ?? null },
      });

    if (t.localImageUri) {
      return queueOutbox(queued, optimistic);
    }

    const result = await net(() => supabase.from('transactions').insert(row).select().single());
    if (!result.ok) {
      if (result.offline) return queueOutbox(queued, optimistic);
      return result.message;
    }

    const data = result.data as Record<string, unknown> | null;
    if (!data) return 'Transaksi gagal disimpan';

    dispatch({ type: 'ADD_TRANSACTION', payload: mapTransaction(data) });
    return null;
  };

  const updateTransaction = async (
    t: Transaction & { localImageUri?: string | null }
  ): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const old = state.transactions.find((item) => item.id === t.id);

    const patch: TxPatch = {
      type: t.type,
      description: t.description,
      category: t.category,
      amount: t.amount,
      payment_method: t.payment_method,
      image_path: t.image_path ?? null,
    };

    const updatedTx: Transaction = { ...t, local_image_uri: t.localImageUri ?? t.local_image_uri ?? null };

    const optimistic = () => dispatch({ type: 'UPDATE_TRANSACTION', payload: updatedTx });

    if (t.localImageUri) {
      return queueOutbox(
        {
          id: newId(),
          kind: 'updateTransaction',
          txId: t.id,
          patch,
          localImageUri: t.localImageUri,
          oldImagePath: old?.image_path ?? null,
          createdAt: Date.now(),
        },
        optimistic
      );
    }

    const result = await net(() =>
      supabase.from('transactions').update(patch).eq('id', t.id).eq('user_id', user.id)
    );

    if (!result.ok) {
      if (result.offline) {
        return queueOutbox(
          {
            id: newId(),
            kind: 'updateTransaction',
            txId: t.id,
            patch,
            oldImagePath: old?.image_path ?? null,
            createdAt: Date.now(),
          },
          optimistic
        );
      }
      return result.message;
    }

    if (old?.image_path && old.image_path !== (t.image_path ?? null)) {
      removeImageFile(RECEIPTS_BUCKET, old.image_path);
    }

    if (old?.local_image_uri && !t.localImageUri) {
      removeStagedFile(old.local_image_uri);
    }

    dispatch({ type: 'UPDATE_TRANSACTION', payload: updatedTx });
    return null;
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;

    const deleted = state.transactions.find((t) => t.id === id);

    const result = await net(() =>
      supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id)
    );

    if (result.ok) {
      if (deleted && deleted.image_path) {
        removeImageFile(RECEIPTS_BUCKET, deleted.image_path);
      }
      dispatch({ type: 'DELETE_TRANSACTION', payload: id });
      return;
    }

    if (result.offline) {
      await queueOutbox(
        {
          id: newId(),
          kind: 'deleteTransaction',
          txId: id,
          imagePath: deleted?.image_path ?? null,
          createdAt: Date.now(),
        },
        () => dispatch({ type: 'DELETE_TRANSACTION', payload: id })
      );
    }
  };

  const getAllTransactions = async (): Promise<
    { rows: Transaction[]; partial?: boolean } | { error: string }
  > => {
    if (!user) return { error: 'Anda belum login' };

    const result = await net(
      () =>
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false }),
      'read'
    );

    if (!result.ok) {
      if (result.offline) return { rows: state.transactions, partial: true };
      return { error: result.message };
    }

    return { rows: ((result.data as Record<string, unknown>[]) || []).map(mapTransaction) };
  };

  const addRecurring = async (r: Omit<RecurringTransaction, 'id'>): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const row: RecurringRow = {
      id: newId(),
      user_id: user.id,
      type: r.type,
      description: r.description,
      category: r.category,
      amount: r.amount,
      payment_method: r.payment_method,
      frequency: r.frequency,
      next_date: r.next_date,
      active: r.active,
    };

    const optimistic = () =>
      dispatch({
        type: 'ADD_RECURRING',
        payload: {
          id: row.id,
          type: row.type,
          description: row.description,
          category: row.category,
          amount: row.amount,
          payment_method: row.payment_method,
          frequency: row.frequency,
          next_date: row.next_date,
          active: row.active,
        },
      });

    const result = await net(() => supabase.from('recurring_transactions').insert(row).select().single());
    if (!result.ok) {
      if (result.offline) {
        return queueOutbox({ id: newId(), kind: 'addRecurring', row, createdAt: Date.now() }, optimistic);
      }
      return result.message;
    }

    const data = result.data as Record<string, unknown> | null;
    if (!data) return 'Transaksi berulang gagal disimpan';

    dispatch({ type: 'ADD_RECURRING', payload: mapRecurring(data) });
    return null;
  };

  const updateRecurring = async (r: RecurringTransaction): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const patch: RecurringPatch = {
      type: r.type,
      description: r.description,
      category: r.category,
      amount: r.amount,
      payment_method: r.payment_method,
      frequency: r.frequency,
      next_date: r.next_date,
      active: r.active,
    };

    const optimistic = () => dispatch({ type: 'UPDATE_RECURRING', payload: r });

    const result = await net(() =>
      supabase
        .from('recurring_transactions')
        .update(patch)
        .eq('id', r.id)
        .eq('user_id', user.id)
    );

    if (!result.ok) {
      if (result.offline) {
        return queueOutbox(
          { id: newId(), kind: 'updateRecurring', recurringId: r.id, patch, createdAt: Date.now() },
          optimistic
        );
      }
      return result.message;
    }

    dispatch({ type: 'UPDATE_RECURRING', payload: r });
    return null;
  };

  const deleteRecurring = async (id: string): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const result = await net(() =>
      supabase.from('recurring_transactions').delete().eq('id', id).eq('user_id', user.id)
    );

    if (!result.ok) {
      if (result.offline) {
        return queueOutbox(
          { id: newId(), kind: 'deleteRecurring', recurringId: id, createdAt: Date.now() },
          () => dispatch({ type: 'DELETE_RECURRING', payload: id })
        );
      }
      return result.message;
    }

    dispatch({ type: 'DELETE_RECURRING', payload: id });
    return null;
  };

  const getDebtPaid = (debtId: string): number =>
    state.debtPayments
      .filter((p) => p.debt_id === debtId)
      .reduce((sum, p) => sum + p.amount, 0);

  const addDebt = async (d: Omit<Debt, 'id' | 'created_at'>): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const row: DebtRow = {
      id: newId(),
      user_id: user.id,
      kind: d.kind,
      counterparty: d.counterparty,
      description: d.description,
      amount: d.amount,
      category: d.category,
      payment_method: d.payment_method,
      due_date: d.due_date,
      status: d.status,
      created_at: new Date().toISOString(),
    };

    const optimistic = () =>
      dispatch({
        type: 'ADD_DEBT',
        payload: {
          id: row.id,
          kind: row.kind,
          counterparty: row.counterparty,
          description: row.description,
          amount: row.amount,
          category: row.category,
          payment_method: row.payment_method,
          due_date: row.due_date,
          status: row.status,
          created_at: row.created_at,
        },
      });

    const result = await net(() => supabase.from('debts').insert(row).select().single());
    if (!result.ok) {
      if (result.offline) {
        return queueOutbox({ id: newId(), kind: 'addDebt', row, createdAt: Date.now() }, optimistic);
      }
      return result.message;
    }

    const data = result.data as Record<string, unknown> | null;
    if (!data) return 'Hutang/tagihan gagal disimpan';

    dispatch({ type: 'ADD_DEBT', payload: mapDebt(data) });
    return null;
  };

  const updateDebt = async (d: Debt): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const status: DebtStatus = getDebtPaid(d.id) >= d.amount - 0.0001 ? 'paid' : 'open';

    const patch: DebtPatch = {
      kind: d.kind,
      counterparty: d.counterparty,
      description: d.description,
      amount: d.amount,
      category: d.category,
      payment_method: d.payment_method,
      due_date: d.due_date,
      status,
    };

    const optimistic = () => dispatch({ type: 'UPDATE_DEBT', payload: { ...d, status } });

    const result = await net(() =>
      supabase.from('debts').update(patch).eq('id', d.id).eq('user_id', user.id)
    );

    if (!result.ok) {
      if (result.offline) {
        return queueOutbox(
          { id: newId(), kind: 'updateDebt', debtId: d.id, patch, createdAt: Date.now() },
          optimistic
        );
      }
      return result.message;
    }

    dispatch({ type: 'UPDATE_DEBT', payload: { ...d, status } });
    return null;
  };

  const deleteDebt = async (id: string): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const txIds = state.debtPayments
      .filter((p) => p.debt_id === id && p.transaction_id)
      .map((p) => p.transaction_id as string);

    const removeLinked = () => {
      txIds.forEach((txId) => dispatch({ type: 'DELETE_TRANSACTION', payload: txId }));
      dispatch({ type: 'DELETE_DEBT', payload: id });
    };

    const result = await net(() => supabase.from('debts').delete().eq('id', id).eq('user_id', user.id));
    if (!result.ok) {
      if (result.offline) {
        return queueOutbox(
          { id: newId(), kind: 'deleteDebt', debtId: id, txIds, createdAt: Date.now() },
          removeLinked
        );
      }
      return result.message;
    }

    if (txIds.length > 0) {
      await supabase.from('transactions').delete().in('id', txIds).eq('user_id', user.id);
      txIds.forEach((txId) => dispatch({ type: 'DELETE_TRANSACTION', payload: txId }));
    }

    dispatch({ type: 'DELETE_DEBT', payload: id });
    return null;
  };

  const addDebtPayment = async (
    debtId: string,
    amount: number,
    note?: string,
    paymentMethod?: PaymentMethod
  ): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const debt = state.debts.find((d) => d.id === debtId);
    if (!debt) return 'Hutang/tagihan tidak ditemukan';
    if (!amount || Number.isNaN(amount) || amount <= 0) return 'Jumlah pembayaran tidak valid';

    const paid = getDebtPaid(debtId);
    if (paid + amount > debt.amount + 0.0001) {
      return `Pembayaran melebihi sisa tagihan (sisa ${formatRupiah(Math.max(0, debt.amount - paid))})`;
    }

    const isPayable = debt.kind === 'payable';
    const now = new Date().toISOString();

    const txRow: TxRow = {
      id: newId(),
      user_id: user.id,
      type: isPayable ? 'expense' : 'income',
      description: isPayable
        ? `Bayar hutang ${debt.counterparty}`
        : `Terima tagihan ${debt.counterparty}`,
      category: debt.category,
      amount,
      payment_method: paymentMethod ?? debt.payment_method,
      image_path: null,
      date: now,
    };

    const paymentRow: DebtPaymentRow = {
      id: newId(),
      user_id: user.id,
      debt_id: debtId,
      amount,
      transaction_id: txRow.id,
      note: note && note.trim() ? note.trim() : null,
      paid_at: now,
    };

    const nowPaid = paid + amount;
    const status: DebtStatus = nowPaid >= debt.amount - 0.0001 ? 'paid' : 'open';

    const paymentPayload: DebtPayment = {
      id: paymentRow.id,
      debt_id: paymentRow.debt_id,
      amount: paymentRow.amount,
      transaction_id: paymentRow.transaction_id,
      note: paymentRow.note,
      paid_at: paymentRow.paid_at,
    };

    const dispatchPayment = () => {
      dispatch({ type: 'ADD_TRANSACTION', payload: { ...txRow, local_image_uri: null } });
      dispatch({ type: 'ADD_DEBT_PAYMENT', payload: paymentPayload });
    };

    const queued: OutboxOp = {
      id: newId(),
      kind: 'addDebtPayment',
      tx: txRow,
      payment: paymentRow,
      debtId,
      status,
      createdAt: Date.now(),
    };

    const txResult = await net(() =>
      supabase.from('transactions').insert(txRow).select().single()
    );
    if (!txResult.ok) {
      if (txResult.offline) {
        return queueOutbox(queued, () => {
          if (status !== debt.status) {
            dispatch({ type: 'UPDATE_DEBT', payload: { ...debt, status } });
          }
          dispatchPayment();
        });
      }
      return txResult.message;
    }

    const txData = txResult.data as Record<string, unknown> | null;
    if (!txData) return 'Transaksi pembayaran gagal dibuat';

    const payResult = await net(() =>
      supabase
        .from('debt_payments')
        .insert({ ...paymentRow, transaction_id: txData.id })
        .select()
        .single()
    );

    if (!payResult.ok) {
      if (payResult.offline) {
        return queueOutbox(queued, () => {
          if (status !== debt.status) {
            dispatch({ type: 'UPDATE_DEBT', payload: { ...debt, status } });
          }
          dispatchPayment();
        });
      }

      await supabase.from('transactions').delete().eq('id', txData.id).eq('user_id', user.id);
      return payResult.message;
    }

    const paymentData = payResult.data as Record<string, unknown> | null;
    if (!paymentData) return 'Pembayaran gagal disimpan';

    if (status !== debt.status) {
      const statusResult = await net(() =>
        supabase.from('debts').update({ status }).eq('id', debtId).eq('user_id', user.id)
      );

      if (!statusResult.ok && !statusResult.offline) {
        await supabase.from('transactions').delete().eq('id', txData.id).eq('user_id', user.id);
        await supabase.from('debt_payments').delete().eq('id', paymentData.id).eq('user_id', user.id);
        return statusResult.message;
      }

      if (!statusResult.ok) {
        await enqueueOutbox(user.id, queued);
        dispatch({
          type: 'SET_SYNC',
          payload: { pendingCount: await outboxCount(user.id), syncError: null },
        });
      }

      dispatch({ type: 'UPDATE_DEBT', payload: { ...debt, status } });
    }

    dispatch({ type: 'ADD_TRANSACTION', payload: mapTransaction(txData) });
    dispatch({ type: 'ADD_DEBT_PAYMENT', payload: mapDebtPayment(paymentData) });
    return null;
  };

  const addBudget = async (category: string, amount: number): Promise<string | null> => {
    if (!user) return 'Not authenticated';

    const existing = state.budgets.find((b) => b.category === category);
    if (existing) return 'Budget for this category already exists';

    const row: BudgetRow = { id: newId(), user_id: user.id, category, amount };
    const optimistic = () => dispatch({ type: 'ADD_BUDGET', payload: { id: row.id, category, amount } });

    const result = await net(() => supabase.from('budgets').insert(row).select().single());
    if (!result.ok) {
      if (result.offline) {
        return queueOutbox({ id: newId(), kind: 'addBudget', row, createdAt: Date.now() }, optimistic);
      }
      return result.message || 'Failed to add budget';
    }

    const data = result.data as Record<string, unknown> | null;
    if (!data) {
      optimistic();
      return null;
    }

    const newBudget: Budget = {
      id: String(data.id),
      category: String(data.category),
      amount: Number(data.amount) || 0,
    };

    dispatch({ type: 'ADD_BUDGET', payload: newBudget });
    return null;
  };

  const updateBudget = async (b: Budget) => {
    if (!user) return;

    const patch: BudgetPatch = { amount: b.amount };
    const optimistic = () => dispatch({ type: 'UPDATE_BUDGET', payload: b });

    const result = await net(() =>
      supabase.from('budgets').update(patch).eq('id', b.id).eq('user_id', user.id)
    );

    if (result.ok) {
      dispatch({ type: 'UPDATE_BUDGET', payload: b });
      return;
    }

    if (result.offline) {
      await queueOutbox(
        { id: newId(), kind: 'updateBudget', budgetId: b.id, patch, createdAt: Date.now() },
        optimistic
      );
    }
  };

  const deleteBudget = async (id: string) => {
    if (!user) return;

    const result = await net(() =>
      supabase.from('budgets').delete().eq('id', id).eq('user_id', user.id)
    );

    if (result.ok) {
      dispatch({ type: 'DELETE_BUDGET', payload: id });
      return;
    }

    if (result.offline) {
      await queueOutbox(
        { id: newId(), kind: 'deleteBudget', budgetId: id, createdAt: Date.now() },
        () => dispatch({ type: 'DELETE_BUDGET', payload: id })
      );
    }
  };

  const getSpendingByCategory = (): Record<string, number> => {
    const result: Record<string, number> = {};
    state.transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        result[t.category] = (result[t.category] || 0) + t.amount;
      });
    return result;
  };

  const getBudgetSpent = (category: string): number => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return state.transactions
      .filter((t) => t.type === 'expense' && t.category === category)
      .filter((t) => {
        const d = new Date(t.date);
        return d >= startOfMonth && d < endOfMonth;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  };

  return (
    <FinanceContext.Provider
      value={{
        state,
        reload: fetchData,
        syncNow,
        loadMoreTransactions,
        getAllTransactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addRecurring,
        updateRecurring,
        deleteRecurring,
        addDebt,
        updateDebt,
        deleteDebt,
        addDebtPayment,
        getDebtPaid,
        addBudget,
        updateBudget,
        deleteBudget,
        getSpendingByCategory,
        getBudgetSpent,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance(): FinanceContextType {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
