import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/hooks/useAuth';
import { loadData, saveData } from '@/utils/storage';
import { formatRupiah } from '@/utils/format';
import { RecurringFrequency } from '@/context/FinanceContext';

export type NotificationTone = 'info' | 'warning' | 'danger';

export interface AppNotification {
  id: string;
  icon: string;
  tone: NotificationTone;
  title: string;
  body: string;
}

const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  yearly: 'Tahunan',
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function seenKey(userId?: string | null): string {
  return `finora.notif.seen.${userId ?? 'anon'}`;
}

export function useNotifications() {
  const { state, getBudgetSpent } = useFinance();
  const { user } = useAuth();
  const [seen, setSeen] = useState<string | null>(null);

  const items = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];
    const today = todayKey();

    for (const r of state.recurring) {
      if (!r.active || !r.next_date || r.next_date > today) continue;
      const overdue = r.next_date < today;
      list.push({
        id: `recurring-${r.id}`,
        icon: 'repeat-variant',
        tone: overdue ? 'danger' : 'warning',
        title: overdue
          ? `Berulang terlewat: ${r.description}`
          : `Berulang jatuh tempo: ${r.description}`,
        body: `${r.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} ${formatRupiah(
          r.amount
        )} · ${FREQUENCY_LABEL[r.frequency]} · ${r.next_date}`,
      });
    }

    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    const limitKey = `${limit.getFullYear()}-${pad2(limit.getMonth() + 1)}-${pad2(limit.getDate())}`;

    for (const d of state.debts) {
      if (d.status !== 'open' || !d.due_date || d.due_date > limitKey) continue;
      const paidSum = state.debtPayments
        .filter((p) => p.debt_id === d.id)
        .reduce((sum, p) => sum + p.amount, 0);
      const remainingAmount = Math.max(0, d.amount - paidSum);
      const overdue = d.due_date < today;
      const label = d.kind === 'payable' ? 'Hutang' : 'Tagihan';
      list.push({
        id: `debt-${d.id}`,
        icon: 'hand-coin-outline',
        tone: overdue ? 'danger' : 'warning',
        title: overdue
          ? `${label} terlewat jatuh tempo: ${d.counterparty}`
          : d.due_date === today
          ? `${label} jatuh tempo hari ini: ${d.counterparty}`
          : `${label} jatuh tempo ${d.due_date}: ${d.counterparty}`,
        body: `Sisa ${formatRupiah(remainingAmount)} dari ${formatRupiah(d.amount)} · pembayaran otomatis jadi transaksi.`,
      });
    }

    for (const b of state.budgets) {
      if (b.amount <= 0) continue;
      const spent = getBudgetSpent(b.category);
      const pct = Math.round((spent / b.amount) * 100);
      if (pct >= 100) {
        list.push({
          id: `budget-over-${b.category}`,
          icon: 'wallet',
          tone: 'danger',
          title: `Budget ${b.category} lewat limit`,
          body: `Terpakai ${formatRupiah(spent)} dari ${formatRupiah(b.amount)} bulan ini (${pct}%).`,
        });
      } else if (pct >= 80) {
        list.push({
          id: `budget-warn-${b.category}`,
          icon: 'wallet',
          tone: 'warning',
          title: `Budget ${b.category} hampir habis`,
          body: `Sisa ${formatRupiah(b.amount - spent)} dari ${formatRupiah(b.amount)} bulan ini (${pct}% terpakai).`,
        });
      }
    }

    const now = new Date();
    const monthIncome = state.transactions
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === 'income' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, t) => sum + t.amount, 0);
    const monthExpense = state.transactions
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, t) => sum + t.amount, 0);

    if (monthExpense > monthIncome) {
      list.push({
        id: 'balance-month',
        icon: 'chart-line-variant',
        tone: 'info',
        title: 'Pengeluaran melebihi pemasukan',
        body: `Bulan ini kamu rugi ${formatRupiah(monthExpense - monthIncome)}.`,
      });
    }

    return list;
  }, [state.recurring, state.debts, state.debtPayments, state.budgets, state.transactions, getBudgetSpent]);

  const signature = items.map((item) => `${item.id}|${item.title}`).join('\n');
  const unread = seen !== null && signature.length > 0 && signature !== seen;

  useEffect(() => {
    let alive = true;
    loadData<string>(seenKey(user?.id))
      .then((value) => {
        if (alive) setSeen(value ?? '');
      })
      .catch(() => {
        if (alive) setSeen('');
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const markSeen = useCallback(async () => {
    setSeen(signature);
    try {
      await saveData(seenKey(user?.id), signature);
    } catch {
      // ignore storage failure
    }
  }, [signature, user?.id]);

  return { items, unread, markSeen };
}
