-- ============================================
-- Finora Upgrade: payment_method (tunai / nontunai)
-- Jalankan di: Supabase Dashboard > SQL Editor
-- Aman dijalankan berulang (idempotent)
-- ============================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_payment_method_check'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_payment_method_check
      CHECK (payment_method IN ('cash', 'non_cash'));
  END IF;
END $$;
