import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface TrendPoint {
  key: string;
  label: string;
  year: number;
  month: number;
  income: number;
  expense: number;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function useMonthlyTrend(months = 6, refreshToken = 0) {
  const { user } = useAuth();
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const buckets: TrendPoint[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: MONTH_LABELS[d.getMonth()],
        year: d.getFullYear(),
        month: d.getMonth(),
        income: 0,
        expense: 0,
      });
    }

    (async () => {
      if (user) {
        const { data: rows, error } = await supabase
          .from('transactions')
          .select('type, amount, date')
          .eq('user_id', user.id)
          .gte('date', start.toISOString());

        if (!error && rows) {
          for (const row of rows) {
            const d = new Date(row.date);
            const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
            if (!bucket) continue;
            const amount = Number(row.amount) || 0;
            if (row.type === 'income') bucket.income += amount;
            else bucket.expense += amount;
          }
        }
      }

      if (!cancelled) {
        setData(buckets);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, months, refreshToken]);

  return { data, loading };
}
