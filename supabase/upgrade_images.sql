-- ============================================
-- Finora Upgrade: upload gambar (lampiran transaksi + avatar)
-- Jalankan di: Supabase Dashboard > SQL Editor
-- Aman dijalankan berulang (idempotent)
-- ============================================

-- 1. Kolom lampiran foto pada transaksi
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS image_path text;

-- 2. Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts', 'receipts', false, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Policies storage.objects (private receipts: hanya pemilik)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'receipts select own') THEN
    CREATE POLICY "receipts select own" ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'receipts insert own') THEN
    CREATE POLICY "receipts insert own" ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'receipts update own') THEN
    CREATE POLICY "receipts update own" ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'receipts delete own') THEN
    CREATE POLICY "receipts delete own" ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  -- Avatar: publik bisa dibaca, hanya pemilik yang boleh tulis
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars public read') THEN
    CREATE POLICY "avatars public read" ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars insert own') THEN
    CREATE POLICY "avatars insert own" ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars update own') THEN
    CREATE POLICY "avatars update own" ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars delete own') THEN
    CREATE POLICY "avatars delete own" ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
