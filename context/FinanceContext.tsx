import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export type PaymentMethod = 'cash' | 'non_cash';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  amount: number;
  payment_method: PaymentMethod;
  date: string;
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
}

interface FinanceState {
  income: number;
  expense: number;
  transactions: Transaction[];
  budgets: Budget[];
  isLoaded: boolean;
}

type FinanceAction =
  | { type: 'LOAD_DATA'; payload: Partial<FinanceState> }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'ADD_BUDGET'; payload: Budget }
  | { type: 'UPDATE_BUDGET'; payload: Budget }
  | { type: 'DELETE_BUDGET'; payload: string };

const initialState: FinanceState = {
  income: 0,
  expense: 0,
  transactions: [],
  budgets: [],
  isLoaded: false,
};

function financeReducer(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case 'LOAD_DATA':
      return { ...state, ...action.payload, isLoaded: true };

    case 'ADD_TRANSACTION': {
      const t = action.payload;
      return {
        ...state,
        transactions: [t, ...state.transactions],
        income: t.type === 'income' ? state.income + t.amount : state.income,
        expense: t.type === 'expense' ? state.expense + t.amount : state.expense,
      };
    }

    case 'UPDATE_TRANSACTION': {
      const updated = action.payload;
      const old = state.transactions.find((t) => t.id === updated.id);
      if (!old) return state;

      let income = state.income;
      let expense = state.expense;

      if (old.type === 'income') income -= old.amount;
      else expense -= old.amount;

      if (updated.type === 'income') income += updated.amount;
      else expense += updated.amount;

      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === updated.id ? updated : t)),
        income,
        expense,
      };
    }

    case 'DELETE_TRANSACTION': {
      const deleted = state.transactions.find((t) => t.id === action.payload);
      if (!deleted) return state;

      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.payload),
        income: deleted.type === 'income' ? state.income - deleted.amount : state.income,
        expense: deleted.type === 'expense' ? state.expense - deleted.amount : state.expense,
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

    default:
      return state;
  }
}

function getWriteErrorMessage(error: { code?: string; message?: string }): string {
  const code = error.code || '';
  const message = error.message || '';
  if (code === '42703' || code === 'PGRST204' || message.includes('payment_method')) {
    return 'Kolom payment_method belum ada di database. Jalankan supabase/upgrade_payment_method.sql di Supabase SQL Editor, lalu coba lagi.';
  }
  if (code === '42P01' || message.includes('relation') && message.includes('does not exist')) {
    return 'Tabel belum dibuat. Jalankan supabase/migration.sql di Supabase SQL Editor.';
  }
  if (code === 'PGRST301' || code === '42501') {
    return 'Tidak punya akses menyimpan data. Silakan login ulang.';
  }
  return `Gagal menyimpan: ${message || code || 'unknown error'}`;
}

interface FinanceContextType {
  state: FinanceState;
  addTransaction: (t: Omit<Transaction, 'id' | 'date'>) => Promise<string | null>;
  updateTransaction: (t: Transaction) => Promise<string | null>;
  deleteTransaction: (id: string) => Promise<void>;
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

  const fetchData = async () => {
    if (!user) return;

    const [txResult, budgetResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false }),
      supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id),
    ]);

    const transactions: Transaction[] = (txResult.data || []).map((t) => ({
      id: t.id,
      type: t.type,
      description: t.description,
      category: t.category,
      amount: t.amount,
      payment_method: t.payment_method === 'non_cash' ? 'non_cash' : 'cash',
      date: t.date,
    }));

    const budgets: Budget[] = (budgetResult.data || []).map((b) => ({
      id: b.id,
      category: b.category,
      amount: b.amount,
    }));

    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    dispatch({
      type: 'LOAD_DATA',
      payload: { income, expense, transactions, budgets },
    });
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
      })
      .eq('id', t.id)
      .eq('user_id', user.id);

    if (error) return getWriteErrorMessage(error);

    dispatch({ type: 'UPDATE_TRANSACTION', payload: t });
    return null;
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (!error) {
      dispatch({ type: 'DELETE_TRANSACTION', payload: id });
    }
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
    return state.transactions
      .filter((t) => t.type === 'expense' && t.category === category)
      .reduce((sum, t) => sum + t.amount, 0);
  };

  return (
    <FinanceContext.Provider
      value={{
        state,
        addTransaction,
        updateTransaction,
        deleteTransaction,
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
