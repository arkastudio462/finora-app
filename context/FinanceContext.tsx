import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { RECEIPTS_BUCKET, removeImageFile } from '@/lib/images';
import { useAuth } from '@/hooks/useAuth';
import { formatRupiah } from '@/utils/format';

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
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
}

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

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
  | { type: 'ADD_DEBT_PAYMENT'; payload: DebtPayment };

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

    default:
      return state;
  }
}

function getWriteErrorMessage(error: { code?: string; message?: string }): string {
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
  loadMoreTransactions: () => Promise<string | null>;
  getAllTransactions: () => Promise<{ rows: Transaction[] } | { error: string }>;
  addTransaction: (t: Omit<Transaction, 'id' | 'date'>) => Promise<string | null>;
  updateTransaction: (t: Transaction) => Promise<string | null>;
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

  useEffect(() => {
    if (!user) {
      dispatch({ type: 'LOAD_DATA', payload: initialState });
      return;
    }

    fetchData();
  }, [user]);

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

    dispatch({ type: 'LOAD_START' });

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
      dispatch({ type: 'LOAD_ERROR', payload: getWriteErrorMessage(readError) });
      return;
    }

    const transactions: Transaction[] = (txResult.data || []).map(mapTransaction);
    const budgets: Budget[] = (budgetResult.data || []).map((b) => ({
      id: b.id,
      category: b.category,
      amount: b.amount,
    }));

    const recurring: RecurringTransaction[] = recurringResult.error
      ? []
      : (recurringResult.data || []).map(mapRecurring);

    const debts: Debt[] = debtsResult.error ? [] : (debtsResult.data || []).map(mapDebt);
    const debtPayments: DebtPayment[] = paymentsResult.error
      ? []
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
      },
    });
  };

  const loadMoreTransactions = async (): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const from = state.transactions.length;
    if (from >= state.totalTransactions) return null;

    dispatch({ type: 'LOAD_MORE_START' });

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      dispatch({ type: 'LOAD_MORE_END' });
      return getWriteErrorMessage(error);
    }

    dispatch({ type: 'APPEND_TRANSACTIONS', payload: (data || []).map(mapTransaction) });
    return null;
  };

  const addTransaction = async (t: Omit<Transaction, 'id' | 'date'>): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: t.type,
        description: t.description,
        category: t.category,
        amount: t.amount,
        payment_method: t.payment_method,
        image_path: t.image_path ?? null,
      })
      .select()
      .single();

    if (error) return getWriteErrorMessage(error);
    if (!data) return 'Transaksi gagal disimpan';

    const newTx: Transaction = {
      id: data.id,
      type: data.type,
      description: data.description,
      category: data.category,
      amount: data.amount,
      payment_method: data.payment_method === 'non_cash' ? 'non_cash' : 'cash',
      image_path: data.image_path ?? null,
      date: data.date,
    };

    dispatch({ type: 'ADD_TRANSACTION', payload: newTx });
    return null;
  };

  const updateTransaction = async (t: Transaction): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const { error } = await supabase
      .from('transactions')
      .update({
        type: t.type,
        description: t.description,
        category: t.category,
        amount: t.amount,
        payment_method: t.payment_method,
        image_path: t.image_path ?? null,
      })
      .eq('id', t.id)
      .eq('user_id', user.id);

    if (error) return getWriteErrorMessage(error);

    dispatch({ type: 'UPDATE_TRANSACTION', payload: t });
    return null;
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;

    const deleted = state.transactions.find((t) => t.id === id);

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (!error) {
      if (deleted && deleted.image_path) {
        removeImageFile(RECEIPTS_BUCKET, deleted.image_path);
      }
      dispatch({ type: 'DELETE_TRANSACTION', payload: id });
    }
  };

  const getAllTransactions = async (): Promise<{ rows: Transaction[] } | { error: string }> => {
    if (!user) return { error: 'Anda belum login' };

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) return { error: getWriteErrorMessage(error) };
    return { rows: (data || []).map(mapTransaction) };
  };

  const addRecurring = async (r: Omit<RecurringTransaction, 'id'>): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const { data, error } = await supabase
      .from('recurring_transactions')
      .insert({
        user_id: user.id,
        type: r.type,
        description: r.description,
        category: r.category,
        amount: r.amount,
        payment_method: r.payment_method,
        frequency: r.frequency,
        next_date: r.next_date,
        active: r.active,
      })
      .select()
      .single();

    if (error) return getWriteErrorMessage(error);
    if (!data) return 'Transaksi berulang gagal disimpan';

    dispatch({ type: 'ADD_RECURRING', payload: mapRecurring(data) });
    return null;
  };

  const updateRecurring = async (r: RecurringTransaction): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const { error } = await supabase
      .from('recurring_transactions')
      .update({
        type: r.type,
        description: r.description,
        category: r.category,
        amount: r.amount,
        payment_method: r.payment_method,
        frequency: r.frequency,
        next_date: r.next_date,
        active: r.active,
      })
      .eq('id', r.id)
      .eq('user_id', user.id);

    if (error) return getWriteErrorMessage(error);

    dispatch({ type: 'UPDATE_RECURRING', payload: r });
    return null;
  };

  const deleteRecurring = async (id: string): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const { error } = await supabase
      .from('recurring_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return getWriteErrorMessage(error);

    dispatch({ type: 'DELETE_RECURRING', payload: id });
    return null;
  };

  const getDebtPaid = (debtId: string): number =>
    state.debtPayments
      .filter((p) => p.debt_id === debtId)
      .reduce((sum, p) => sum + p.amount, 0);

  const addDebt = async (d: Omit<Debt, 'id' | 'created_at'>): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const { data, error } = await supabase
      .from('debts')
      .insert({
        user_id: user.id,
        kind: d.kind,
        counterparty: d.counterparty,
        description: d.description,
        amount: d.amount,
        category: d.category,
        payment_method: d.payment_method,
        due_date: d.due_date,
        status: d.status,
      })
      .select()
      .single();

    if (error) return getWriteErrorMessage(error);
    if (!data) return 'Hutang/tagihan gagal disimpan';

    dispatch({ type: 'ADD_DEBT', payload: mapDebt(data) });
    return null;
  };

  const updateDebt = async (d: Debt): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const status: DebtStatus = getDebtPaid(d.id) >= d.amount - 0.0001 ? 'paid' : 'open';

    const { error } = await supabase
      .from('debts')
      .update({
        kind: d.kind,
        counterparty: d.counterparty,
        description: d.description,
        amount: d.amount,
        category: d.category,
        payment_method: d.payment_method,
        due_date: d.due_date,
        status,
      })
      .eq('id', d.id)
      .eq('user_id', user.id);

    if (error) return getWriteErrorMessage(error);

    dispatch({ type: 'UPDATE_DEBT', payload: { ...d, status } });
    return null;
  };

  const deleteDebt = async (id: string): Promise<string | null> => {
    if (!user) return 'Anda belum login';

    const txIds = state.debtPayments
      .filter((p) => p.debt_id === id && p.transaction_id)
      .map((p) => p.transaction_id as string);

    const { error } = await supabase.from('debts').delete().eq('id', id).eq('user_id', user.id);
    if (error) return getWriteErrorMessage(error);

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
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: isPayable ? 'expense' : 'income',
        description: isPayable
          ? `Bayar hutang ${debt.counterparty}`
          : `Terima tagihan ${debt.counterparty}`,
        category: debt.category,
        amount,
        payment_method: paymentMethod ?? debt.payment_method,
        image_path: null,
      })
      .select()
      .single();

    if (txError) return getWriteErrorMessage(txError);
    if (!tx) return 'Transaksi pembayaran gagal dibuat';

    const { data: payment, error: payError } = await supabase
      .from('debt_payments')
      .insert({
        user_id: user.id,
        debt_id: debtId,
        amount,
        transaction_id: tx.id,
        note: note && note.trim() ? note.trim() : null,
      })
      .select()
      .single();

    if (payError) {
      await supabase.from('transactions').delete().eq('id', tx.id).eq('user_id', user.id);
      return getWriteErrorMessage(payError);
    }

    const nowPaid = paid + amount;
    const status: DebtStatus = nowPaid >= debt.amount - 0.0001 ? 'paid' : 'open';

    if (status !== debt.status) {
      const { error: statusError } = await supabase
        .from('debts')
        .update({ status })
        .eq('id', debtId)
        .eq('user_id', user.id);
      if (statusError) return getWriteErrorMessage(statusError);

      dispatch({ type: 'UPDATE_DEBT', payload: { ...debt, status } });
    }

    dispatch({ type: 'ADD_TRANSACTION', payload: mapTransaction(tx) });
    dispatch({ type: 'ADD_DEBT_PAYMENT', payload: mapDebtPayment(payment) });
    return null;
  };

  const addBudget = async (category: string, amount: number): Promise<string | null> => {
    if (!user) return 'Not authenticated';

    const existing = state.budgets.find((b) => b.category === category);
    if (existing) return 'Budget for this category already exists';

    const { data, error } = await supabase
      .from('budgets')
      .insert({
        user_id: user.id,
        category,
        amount,
      })
      .select()
      .single();

    if (error || !data) return 'Failed to add budget';

    const newBudget: Budget = {
      id: data.id,
      category: data.category,
      amount: data.amount,
    };

    dispatch({ type: 'ADD_BUDGET', payload: newBudget });
    return null;
  };

  const updateBudget = async (b: Budget) => {
    if (!user) return;

    const { error } = await supabase
      .from('budgets')
      .update({ amount: b.amount })
      .eq('id', b.id)
      .eq('user_id', user.id);

    if (!error) {
      dispatch({ type: 'UPDATE_BUDGET', payload: b });
    }
  };

  const deleteBudget = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (!error) {
      dispatch({ type: 'DELETE_BUDGET', payload: id });
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
