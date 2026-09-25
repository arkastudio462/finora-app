-- ============================================
-- Finora Upgrade: Hutang & Tagihan
-- Jalankan di: Supabase Dashboard > SQL Editor
-- Aman dijalankan berulang (idempotent)
-- ============================================

CREATE TABLE IF NOT EXISTS debts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kind text NOT NULL CHECK (kind IN ('payable', 'receivable')),
  counterparty text NOT NULL,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'Other',
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'non_cash')),
  due_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid')),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  debt_id uuid REFERENCES debts(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  note text,
  paid_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Users can view own debts'
  ) THEN
    CREATE POLICY "Users can view own debts" ON debts FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Users can insert own debts'
  ) THEN
    CREATE POLICY "Users can insert own debts" ON debts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Users can update own debts'
  ) THEN
    CREATE POLICY "Users can update own debts" ON debts FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Users can delete own debts'
  ) THEN
    CREATE POLICY "Users can delete own debts" ON debts FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'debt_payments' AND policyname = 'Users can view own debt payments'
  ) THEN
    CREATE POLICY "Users can view own debt payments" ON debt_payments FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'debt_payments' AND policyname = 'Users can insert own debt payments'
  ) THEN
    CREATE POLICY "Users can insert own debt payments" ON debt_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'debt_payments' AND policyname = 'Users can delete own debt payments'
  ) THEN
    CREATE POLICY "Users can delete own debt payments" ON debt_payments FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_user_id ON debt_payments(user_id);
