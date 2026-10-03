import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { RECEIPTS_BUCKET, removeImageFile, removeStagedFile, uploadImageFile } from '@/lib/images';
import type { DebtKind, DebtStatus, PaymentMethod, RecurringFrequency } from '@/context/FinanceContext';

export interface TxRow {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  amount: number;
  payment_method: PaymentMethod;
  image_path: string | null;
  date: string;
}

export interface TxPatch {
  type?: 'income' | 'expense';
  description?: string;
  category?: string;
  amount?: number;
  payment_method?: PaymentMethod;
  image_path?: string | null;
}

export interface BudgetRow {
  id: string;
  user_id: string;
  category: string;
  amount: number;
}

export interface BudgetPatch {
  amount: number;
}

export interface RecurringRow {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  amount: number;
  payment_method: PaymentMethod;
  frequency: RecurringFrequency;
  next_date: string;
  active: boolean;
}

export type RecurringPatch = Omit<RecurringRow, 'id' | 'user_id'>;

export interface DebtRow {
  id: string;
  user_id: string;
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

export type DebtPatch = Omit<DebtRow, 'id' | 'user_id' | 'created_at'>;

export interface DebtPaymentRow {
  id: string;
  user_id: string;
  debt_id: string;
  amount: number;
  transaction_id: string | null;
  note: string | null;
  paid_at: string;
}

export type OutboxOp =
  | { id: string; kind: 'addTransaction'; row: TxRow; localImageUri?: string | null; createdAt: number }
  | {
      id: string;
      kind: 'updateTransaction';
      txId: string;
      patch: TxPatch;
      localImageUri?: string | null;
      oldImagePath?: string | null;
      createdAt: number;
    }
  | { id: string; kind: 'deleteTransaction'; txId: string; imagePath?: string | null; createdAt: number }
  | { id: string; kind: 'addBudget'; row: BudgetRow; createdAt: number }
  | { id: string; kind: 'updateBudget'; budgetId: string; patch: BudgetPatch; createdAt: number }
  | { id: string; kind: 'deleteBudget'; budgetId: string; createdAt: number }
  | { id: string; kind: 'addRecurring'; row: RecurringRow; createdAt: number }
  | { id: string; kind: 'updateRecurring'; recurringId: string; patch: RecurringPatch; createdAt: number }
  | { id: string; kind: 'deleteRecurring'; recurringId: string; createdAt: number }
  | { id: string; kind: 'addDebt'; row: DebtRow; createdAt: number }
  | { id: string; kind: 'updateDebt'; debtId: string; patch: DebtPatch; createdAt: number }
  | { id: string; kind: 'deleteDebt'; debtId: string; txIds: string[]; createdAt: number }
  | {
      id: string;
      kind: 'addDebtPayment';
      tx: TxRow;
      payment: DebtPaymentRow;
      debtId: string;
      status: DebtStatus;
      createdAt: number;
    };

type FlushOk = { ok: true };
type FlushFail = { ok: false; offline: boolean; message: string };
type FlushResult = FlushOk | FlushFail;

export const OFFLINE_MESSAGE = 'Tidak ada koneksi internet.';

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /fetcherror/i,
  /network request failed/i,
  /network error/i,
  /network connection lost/i,
  /econnrefused/i,
  /econnreset/i,
  /econnaborted/i,
  /enetunreach/i,
  /ehostunreach/i,
  /etimedout/i,
  /eai_again/i,
  /enotfound/i,
  /edns/i,
  /getaddrinfo/i,
  /econn/i,
  /socket hang up/i,
  /socket exception/i,
  /load failed/i,
  /operation timed out/i,
  /connection refused/i,
  /connection timed out/i,
  /connection reset/i,
  /could not connect/i,
  /cannot connect/i,
  /unknownhostexception/i,
  /unable to resolve host/i,
  /no address associated with hostname/i,
  /name resolution/i,
  /dns error/i,
  /internet connection appears to be offline/i,
  /network is unreachable/i,
  /host is unreachable/i,
];

const outboxKey = (userId: string) => `finora:outbox:${userId}`;

export function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  const parts: string[] = [];
  if (typeof error === 'string') {
    parts.push(error);
  } else if (typeof error === 'object') {
    const e = error as Record<string, unknown>;
    for (const field of ['message', 'details', 'hint', 'code', 'name']) {
      const value = e[field];
      if (typeof value === 'string') parts.push(value);
    }
    const cause = e.cause;
    if (cause && typeof cause === 'object') {
      const nested = cause as Record<string, unknown>;
      if (typeof nested.message === 'string') parts.push(nested.message);
      if (typeof nested.code === 'string') parts.push(nested.code);
      const deeper = nested.cause;
      if (deeper && typeof deeper === 'object') {
        const deepest = deeper as Record<string, unknown>;
        if (typeof deepest.message === 'string') parts.push(deepest.message);
        if (typeof deepest.code === 'string') parts.push(deepest.code);
      }
    }
    if (Array.isArray(e.errors)) {
      e.errors.forEach((item) => {
        if (typeof item === 'string') parts.push(item);
        else if (item && typeof item === 'object' && typeof (item as any).message === 'string') {
          parts.push((item as any).message);
        }
      });
    }
  }

  const text = parts.join(' ');
  if (!text) return false;
  return NETWORK_PATTERNS.some((pattern) => pattern.test(text));
}

function isDuplicate(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '23505' || /duplicate key value/i.test(error.message ?? '');
}

export async function readOutbox(userId: string): Promise<OutboxOp[]> {
  try {
    const raw = await AsyncStorage.getItem(outboxKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboxOp[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeOutbox(userId: string, ops: OutboxOp[]): Promise<void> {
  try {
    if (ops.length === 0) await AsyncStorage.removeItem(outboxKey(userId));
    else await AsyncStorage.setItem(outboxKey(userId), JSON.stringify(ops));
  } catch {
  }
}

export async function outboxCount(userId: string): Promise<number> {
  return (await readOutbox(userId)).length;
}

export async function enqueueOutbox(userId: string, op: OutboxOp): Promise<void> {
  const ops = await readOutbox(userId);

  if (op.kind === 'deleteTransaction') {
    const pendingAdd = ops.find(
      (item) => item.kind === 'addTransaction' && item.row.id === op.txId
    ) as Extract<OutboxOp, { kind: 'addTransaction' }> | undefined;

    if (pendingAdd) {
      const remaining = ops.filter(
        (item) =>
          !(item.kind === 'addTransaction' && item.row.id === op.txId) &&
          !(item.kind === 'updateTransaction' && item.txId === op.txId)
      );
      await writeOutbox(userId, remaining);
      await removeStagedFile(pendingAdd.localImageUri);
      return;
    }

    const remaining = ops.filter(
      (item) => !(item.kind === 'updateTransaction' && item.txId === op.txId)
    );
    await writeOutbox(userId, [...remaining, op]);
    return;
  }

  await writeOutbox(userId, [...ops, op]);
}

async function runQuery(
  run: () => PromiseLike<{ data: unknown; error: unknown }>
): Promise<FlushResult> {
  try {
    const { error } = await run();
    if (!error) return { ok: true };

    const err = error as { message?: string; code?: string };
    if (isNetworkError(err)) return { ok: false, offline: true, message: OFFLINE_MESSAGE };
    if (isDuplicate(err)) return { ok: true };
    return { ok: false, offline: false, message: err.message ?? 'Gagal menyinkronkan perubahan' };
  } catch (e) {
    if (isNetworkError(e)) return { ok: false, offline: true, message: OFFLINE_MESSAGE };
    return { ok: false, offline: false, message: e instanceof Error ? e.message : String(e) };
  }
}

async function uploadStaged(
  localUri: string,
  userId: string,
  filename: string
): Promise<{ ok: true; path: string } | FlushFail> {
  try {
    const result = await uploadImageFile(RECEIPTS_BUCKET, localUri, userId, filename);
    if ('error' in result) {
      if (isNetworkError(result.error)) return { ok: false, offline: true, message: OFFLINE_MESSAGE };
      return { ok: false, offline: false, message: result.error };
    }
    return { ok: true, path: result.path };
  } catch (e) {
    if (isNetworkError(e)) return { ok: false, offline: true, message: OFFLINE_MESSAGE };
    return { ok: false, offline: false, message: e instanceof Error ? e.message : String(e) };
  }
}

async function flushOp(userId: string, op: OutboxOp): Promise<FlushResult> {
  switch (op.kind) {
    case 'addTransaction': {
      let imagePath = op.row.image_path;
      if (op.localImageUri) {
        const upload = await uploadStaged(op.localImageUri, userId, `tx-${op.row.id}`);
        if (!upload.ok) return upload;
        imagePath = upload.path;
      }

      const result = await runQuery(() =>
        supabase.from('transactions').insert({ ...op.row, image_path: imagePath })
      );
      if (result.ok && op.localImageUri) await removeStagedFile(op.localImageUri);
      return result;
    }

    case 'updateTransaction': {
      const patch = { ...op.patch };
      if (op.localImageUri) {
        const upload = await uploadStaged(op.localImageUri, userId, `tx-${op.txId}`);
        if (!upload.ok) return upload;
        patch.image_path = upload.path;
      }

      const result = await runQuery(() =>
        supabase.from('transactions').update(patch).eq('id', op.txId).eq('user_id', userId)
      );
      if (!result.ok) return result;

      if (op.localImageUri) await removeStagedFile(op.localImageUri);
      if (op.oldImagePath && patch.image_path !== op.oldImagePath) {
        await removeImageFile(RECEIPTS_BUCKET, op.oldImagePath);
      }
      return result;
    }

    case 'deleteTransaction': {
      const result = await runQuery(() =>
        supabase.from('transactions').delete().eq('id', op.txId).eq('user_id', userId)
      );
      if (result.ok && op.imagePath) await removeImageFile(RECEIPTS_BUCKET, op.imagePath);
      return result;
    }

    case 'addBudget':
      return runQuery(() => supabase.from('budgets').insert(op.row));

    case 'updateBudget':
      return runQuery(() =>
        supabase.from('budgets').update(op.patch).eq('id', op.budgetId).eq('user_id', userId)
      );

    case 'deleteBudget':
      return runQuery(() =>
        supabase.from('budgets').delete().eq('id', op.budgetId).eq('user_id', userId)
      );

    case 'addRecurring':
      return runQuery(() => supabase.from('recurring_transactions').insert(op.row));

    case 'updateRecurring':
      return runQuery(() =>
        supabase
          .from('recurring_transactions')
          .update(op.patch)
          .eq('id', op.recurringId)
          .eq('user_id', userId)
      );

    case 'deleteRecurring':
      return runQuery(() =>
        supabase.from('recurring_transactions').delete().eq('id', op.recurringId).eq('user_id', userId)
      );

    case 'addDebt':
      return runQuery(() => supabase.from('debts').insert(op.row));

    case 'updateDebt':
      return runQuery(() =>
        supabase.from('debts').update(op.patch).eq('id', op.debtId).eq('user_id', userId)
      );

    case 'deleteDebt': {
      const result = await runQuery(() =>
        supabase.from('debts').delete().eq('id', op.debtId).eq('user_id', userId)
      );
      if (!result.ok) return result;

      if (op.txIds.length > 0) {
        await runQuery(() =>
          supabase.from('transactions').delete().in('id', op.txIds).eq('user_id', userId)
        );
      }
      return result;
    }

    case 'addDebtPayment': {
      const txResult = await runQuery(() => supabase.from('transactions').insert(op.tx));
      if (!txResult.ok) return txResult;

      const paymentResult = await runQuery(() => supabase.from('debt_payments').insert(op.payment));
      if (!paymentResult.ok) return paymentResult;

      return runQuery(() =>
        supabase.from('debts').update({ status: op.status }).eq('id', op.debtId).eq('user_id', userId)
      );
    }

    default:
      return { ok: false, offline: false, message: 'Perubahan tidak dikenal di antrean sinkronisasi' };
  }
}

export interface FlushOutcome {
  empty: boolean;
  error: string | null;
}

export async function flushOutbox(userId: string): Promise<FlushOutcome> {
  const ops = await readOutbox(userId);
  if (ops.length === 0) return { empty: true, error: null };

  for (let index = 0; index < ops.length; index += 1) {
    const result = await flushOp(userId, ops[index]);
    if (!result.ok) {
      await writeOutbox(userId, ops.slice(index));
      return { empty: false, error: result.offline ? null : result.message };
    }
    await writeOutbox(userId, ops.slice(index + 1));
  }

  return { empty: true, error: null };
}
