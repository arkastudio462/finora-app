-- ============================================
-- Finora: Catat Bersama (buku kas grup)
-- Jalankan di: Supabase Dashboard > SQL Editor
-- Aman dijalankan berulang (idempotent)
-- ============================================

-- 1. Profiles (diisi otomatis dari auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  phone text,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Grup buku kas
CREATE TABLE IF NOT EXISTS shared_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Anggota grup
CREATE TABLE IF NOT EXISTS shared_group_members (
  group_id uuid REFERENCES shared_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  display_name text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  joined_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

-- 4. Undangan tertunda (kontak yang belum terdaftar)
CREATE TABLE IF NOT EXISTS shared_group_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES shared_groups(id) ON DELETE CASCADE NOT NULL,
  inviter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 5. Catatan di dalam grup
CREATE TABLE IF NOT EXISTS shared_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES shared_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  description text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  amount numeric NOT NULL CHECK (amount > 0),
  date timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. Helper functions (SECURITY DEFINER agar tidak kena rekursi RLS)
-- ============================================

CREATE OR REPLACE FUNCTION public.is_shared_member(p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM shared_group_members
    WHERE group_id = p_group AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_shared_owner(p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM shared_group_members
    WHERE group_id = p_group AND user_id = auth.uid() AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.lookup_invite_target(p_identifier text)
RETURNS TABLE (user_id uuid, display_name text, contact text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lower text := lower(trim(coalesce(p_identifier, '')));
  v_digits text := ltrim(regexp_replace(coalesce(p_identifier, ''), '\D', '', 'g'), '0');
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    CASE
      WHEN coalesce(p.display_name, '') <> '' THEN p.display_name
      WHEN coalesce(p.email, '') <> '' THEN p.email
      ELSE p.phone
    END,
    CASE WHEN coalesce(p.email, '') <> '' THEN p.email ELSE p.phone END
  FROM profiles p
  WHERE
    (v_lower LIKE '%@%' AND lower(coalesce(p.email, '')) = v_lower)
    OR (
      v_digits <> ''
      AND coalesce(p.phone, '') <> ''
      AND ltrim(regexp_replace(p.phone, '\D', '', 'g'), '0') = v_digits
    )
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_shared_user_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '');
  v_email text := coalesce(new.email, '');
  v_phone text := coalesce(new.phone, '');
BEGIN
  INSERT INTO profiles (id, email, phone, display_name)
  VALUES (new.id, new.email, new.phone, v_name)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, phone = EXCLUDED.phone;

  UPDATE profiles
  SET display_name = v_name
  WHERE id = new.id AND display_name = '' AND v_name <> '';

  INSERT INTO shared_group_members (group_id, user_id, role, display_name, contact)
  SELECT i.group_id, new.id, 'member', v_name, CASE WHEN v_email <> '' THEN v_email ELSE v_phone END
  FROM shared_group_invites i
  WHERE i.status = 'pending'
    AND (
      (coalesce(i.email, '') <> '' AND lower(i.email) = lower(v_email))
      OR (
        coalesce(i.phone, '') <> '' AND v_phone <> ''
        AND ltrim(regexp_replace(i.phone, '\D', '', 'g'), '0') = ltrim(regexp_replace(v_phone, '\D', '', 'g'), '0')
      )
    )
  ON CONFLICT (group_id, user_id) DO NOTHING;

  UPDATE shared_group_invites i
  SET status = 'accepted'
  WHERE i.status = 'pending'
    AND (
      (coalesce(i.email, '') <> '' AND lower(i.email) = lower(v_email))
      OR (
        coalesce(i.phone, '') <> '' AND v_phone <> ''
        AND ltrim(regexp_replace(i.phone, '\D', '', 'g'), '0') = ltrim(regexp_replace(v_phone, '\D', '', 'g'), '0')
      )
    )
    AND EXISTS (
      SELECT 1 FROM shared_group_members m
      WHERE m.group_id = i.group_id AND m.user_id = new.id
    );

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_shared_user_sync();

DROP TRIGGER IF EXISTS on_auth_user_contact_changed ON auth.users;
CREATE TRIGGER on_auth_user_contact_changed
  AFTER UPDATE OF email, phone ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_shared_user_sync();

-- Backfill profiles untuk user yang sudah terdaftar
INSERT INTO profiles (id, email, phone, display_name)
SELECT
  u.id, u.email, u.phone,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, phone = EXCLUDED.phone;

-- ============================================
-- 7. Policies
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_groups' AND policyname = 'Members can view groups'
  ) THEN
    CREATE POLICY "Members can view groups" ON shared_groups FOR SELECT
      USING (owner_id = auth.uid() OR public.is_shared_member(id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_groups' AND policyname = 'Users can create groups'
  ) THEN
    CREATE POLICY "Users can create groups" ON shared_groups FOR INSERT
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_groups' AND policyname = 'Owners can update groups'
  ) THEN
    CREATE POLICY "Owners can update groups" ON shared_groups FOR UPDATE
      USING (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_groups' AND policyname = 'Owners can delete groups'
  ) THEN
    CREATE POLICY "Owners can delete groups" ON shared_groups FOR DELETE
      USING (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_group_members' AND policyname = 'Members can view members'
  ) THEN
    CREATE POLICY "Members can view members" ON shared_group_members FOR SELECT
      USING (public.is_shared_member(group_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_group_members' AND policyname = 'Members can add member'
  ) THEN
    CREATE POLICY "Members can add member" ON shared_group_members FOR INSERT
      WITH CHECK (public.is_shared_member(group_id) OR user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_group_members' AND policyname = 'Owner or self can remove member'
  ) THEN
    CREATE POLICY "Owner or self can remove member" ON shared_group_members FOR DELETE
      USING (public.is_shared_owner(group_id) OR user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_group_invites' AND policyname = 'Members can view invites'
  ) THEN
    CREATE POLICY "Members can view invites" ON shared_group_invites FOR SELECT
      USING (public.is_shared_member(group_id) OR inviter_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_group_invites' AND policyname = 'Members can create invites'
  ) THEN
    CREATE POLICY "Members can create invites" ON shared_group_invites FOR INSERT
      WITH CHECK (public.is_shared_member(group_id) AND inviter_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_group_invites' AND policyname = 'Inviter or owner can delete invites'
  ) THEN
    CREATE POLICY "Inviter or owner can delete invites" ON shared_group_invites FOR DELETE
      USING (inviter_id = auth.uid() OR public.is_shared_owner(group_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_transactions' AND policyname = 'Members can view shared transactions'
  ) THEN
    CREATE POLICY "Members can view shared transactions" ON shared_transactions FOR SELECT
      USING (public.is_shared_member(group_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_transactions' AND policyname = 'Members can add shared transactions'
  ) THEN
    CREATE POLICY "Members can add shared transactions" ON shared_transactions FOR INSERT
      WITH CHECK (public.is_shared_member(group_id) AND user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_transactions' AND policyname = 'Writers can update own shared transactions'
  ) THEN
    CREATE POLICY "Writers can update own shared transactions" ON shared_transactions FOR UPDATE
      USING (public.is_shared_member(group_id) AND user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shared_transactions' AND policyname = 'Writers can delete own shared transactions'
  ) THEN
    CREATE POLICY "Writers can delete own shared transactions" ON shared_transactions FOR DELETE
      USING (public.is_shared_member(group_id) AND user_id = auth.uid());
  END IF;
END $$;

-- ============================================
-- 8. Index
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_shared_members_user_id ON shared_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_members_group_id ON shared_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_shared_invites_group_id ON shared_group_invites(group_id);
CREATE INDEX IF NOT EXISTS idx_shared_invites_email ON shared_group_invites(lower(email));
CREATE INDEX IF NOT EXISTS idx_shared_transactions_group_id ON shared_transactions(group_id, date DESC);
