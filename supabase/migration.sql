-- ============================================
-- Finora Database Migration
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Tabel TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text CHECK (type IN ('income', 'expense')) NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'non_cash')),
  image_path text,
  date timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Tabel BUDGETS
CREATE TABLE IF NOT EXISTS budgets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL,
  UNIQUE(user_id, category)
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- 4. Policies: user hanya bisa akses data sendiri
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own budgets"
  ON budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets"
  ON budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Index untuk performa
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);

-- ============================================
-- 5b. Storage: bucket lampiran & avatar
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "receipts select own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "receipts insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "receipts update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "receipts delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- 6. UPGRADE (jalankan HANYA bagian ini untuk database yang sudah ada)
-- ============================================
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS image_path text;

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
