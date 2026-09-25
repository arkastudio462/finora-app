-- ============================================
-- Finora Upgrade: Transaksi Berulang
-- Jalankan di: Supabase Dashboard > SQL Editor
-- Aman dijalankan berulang (idempotent)
-- ============================================

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Other',
  amount numeric NOT NULL CHECK (amount >= 0),
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'non_cash')),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  next_date date NOT NULL DEFAULT CURRENT_DATE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recurring_transactions' AND policyname = 'Users can view own recurring'
  ) THEN
    CREATE POLICY "Users can view own recurring"
      ON recurring_transactions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recurring_transactions' AND policyname = 'Users can insert own recurring'
  ) THEN
    CREATE POLICY "Users can insert own recurring"
      ON recurring_transactions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recurring_transactions' AND policyname = 'Users can update own recurring'
  ) THEN
    CREATE POLICY "Users can update own recurring"
      ON recurring_transactions FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recurring_transactions' AND policyname = 'Users can delete own recurring'
  ) THEN
    CREATE POLICY "Users can delete own recurring"
      ON recurring_transactions FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON recurring_transactions(next_date);
