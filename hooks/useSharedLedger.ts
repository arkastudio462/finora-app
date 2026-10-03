import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { OFFLINE_MESSAGE } from '@/lib/outbox';

export interface SharedGroup {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  member_count: number;
  my_role: 'owner' | 'member';
}

export interface SharedMember {
  user_id: string;
  role: 'owner' | 'member';
  display_name: string;
  contact: string;
  joined_at: string;
}

export interface SharedTx {
  id: string;
  group_id: string;
  user_id: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  amount: number;
  date: string;
}

export interface SharedInvite {
  id: string;
  group_id: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
}

function toMessage(error: { message?: string } | null | undefined): string {
  const raw = error?.message ?? '';
  if (raw.includes('Failed to fetch') || raw.includes('NetworkError') || raw.includes('fetch')) {
    return OFFLINE_MESSAGE;
  }
  if (raw.includes('JWT') || raw.includes('token')) return 'Sesi berakhir, silakan masuk ulang.';
  if (raw.includes('permission') || raw.includes('row-level')) return 'Anda tidak punya akses ke grup ini.';
  return raw || 'Terjadi kesalahan, coba lagi.';
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '').replace(/^0+/, '');
}

export function useDisplayName() {
  const { user } = useAuth();
  const email = user?.email ?? '';
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const rawName = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : '';
  const display = rawName.trim() || email.split('@')[0] || 'Saya';
  const contact = email;
  return { display, contact };
}

export function useSharedGroups() {
  const { user } = useAuth();
  const { display, contact } = useDisplayName();
  const [groups, setGroups] = useState<SharedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const { data: groupRows, error: err } = await supabase
      .from('shared_groups')
      .select('id, name, owner_id, created_at')
      .order('created_at', { ascending: false });

    if (err) {
      setError(toMessage(err));
      setLoading(false);
      return;
    }

    if (!groupRows?.length) {
      setGroups([]);
      setError(null);
      setLoading(false);
      return;
    }

    const ids = groupRows.map((row) => row.id);
    const { data: memberRows, error: memberErr } = await supabase
      .from('shared_group_members')
      .select('group_id, user_id, role')
      .in('group_id', ids);

    if (memberErr) {
      setError(toMessage(memberErr));
      setLoading(false);
      return;
    }

    const mine = (memberRows ?? []).filter((row) => row.user_id === user.id);
    const counts = new Map<string, number>();
    (memberRows ?? []).forEach((row) => {
      counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
    });

    const rows = groupRows
      .map((row) => ({
        id: row.id,
        name: row.name,
        owner_id: row.owner_id,
        created_at: row.created_at,
        member_count: counts.get(row.id) ?? 1,
        my_role: mine.find((m) => m.group_id === row.id)?.role === 'owner' ? ('owner' as const) : ('member' as const),
      }))
      .filter((row) => mine.some((m) => m.group_id === row.id));

    setGroups(rows);
    setError(null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = useCallback(
    async (name: string): Promise<{ error: string | null; id?: string }> => {
      const trimmed = name.trim();
      if (!trimmed) return { error: 'Nama buku kas belum diisi.' };
      if (!user) return { error: 'Sesi berakhir, silakan masuk ulang.' };

      const { data, error: err } = await supabase
        .from('shared_groups')
        .insert({ name: trimmed, owner_id: user.id })
        .select('id')
        .single();

      if (err) return { error: toMessage(err) };

      const groupId = data.id as string;
      const { error: memberErr } = await supabase.from('shared_group_members').insert({
        group_id: groupId,
        user_id: user.id,
        role: 'owner',
        display_name: display,
        contact,
      });

      if (memberErr) {
        await supabase.from('shared_groups').delete().eq('id', groupId);
        return { error: toMessage(memberErr) };
      }

      await fetchGroups();
      return { error: null, id: groupId };
    },
    [user?.id, display, contact, fetchGroups],
  );

  const deleteGroup = useCallback(async (groupId: string): Promise<string | null> => {
    const { data, error: err } = await supabase
      .from('shared_groups')
      .delete()
      .eq('id', groupId)
      .select('id');
    if (err) return toMessage(err);
    if (!data?.length) return 'Hanya pemilik grup yang bisa menghapus buku kas.';
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    return null;
  }, []);

  return { groups, loading, error, fetchGroups, createGroup, deleteGroup };
}

export function useSharedGroupDetail(groupId: string | null) {
  const { user } = useAuth();
  const { display, contact } = useDisplayName();
  const [group, setGroup] = useState<SharedGroup | null>(null);
  const [members, setMembers] = useState<SharedMember[]>([]);
  const [transactions, setTransactions] = useState<SharedTx[]>([]);
  const [invites, setInvites] = useState<SharedInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!user || !groupId) {
      setLoading(false);
      return;
    }

    const [groupRes, memberRes, txRes, inviteRes] = await Promise.all([
      supabase
        .from('shared_groups')
        .select('id, name, owner_id, created_at')
        .eq('id', groupId)
        .maybeSingle(),
      supabase
        .from('shared_group_members')
        .select('user_id, role, display_name, contact, joined_at')
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true }),
      supabase
        .from('shared_transactions')
        .select('id, group_id, user_id, type, description, category, amount, date')
        .eq('group_id', groupId)
        .order('date', { ascending: false })
        .limit(200),
      supabase
        .from('shared_group_invites')
        .select('id, group_id, email, phone, status, created_at')
        .eq('group_id', groupId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

    if (groupRes.error) {
      setError(toMessage(groupRes.error));
      setLoading(false);
      return;
    }

    if (!groupRes.data) {
      setGroup(null);
      setError('Grup tidak ditemukan atau Anda bukan anggotanya.');
      setLoading(false);
      return;
    }

    const row = groupRes.data;
    const memberRows = (memberRes.data ?? []) as SharedMember[];
    const myRole = memberRows.find((m) => m.user_id === user.id)?.role;

    setGroup({
      id: row.id,
      name: row.name,
      owner_id: row.owner_id,
      created_at: row.created_at,
      member_count: memberRows.length || 1,
      my_role: myRole === 'owner' ? 'owner' : 'member',
    });
    setMembers(memberRows);
    setTransactions((txRes.data ?? []) as SharedTx[]);
    setInvites((inviteRes.data ?? []) as SharedInvite[]);
    setError(null);
    setLoading(false);
  }, [user?.id, groupId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const addTransaction = useCallback(
    async (input: {
      type: 'income' | 'expense';
      description: string;
      category: string;
      amount: number;
    }): Promise<string | null> => {
      if (!user || !groupId) return 'Grup tidak ditemukan.';
      const description = input.description.trim();
      if (!description) return 'Nama catatan belum diisi.';
      if (input.amount <= 0) return 'Nominal belum benar.';

      const { error: err } = await supabase.from('shared_transactions').insert({
        group_id: groupId,
        user_id: user.id,
        type: input.type,
        description,
        category: input.category,
        amount: input.amount,
      });

      if (err) return toMessage(err);
      await fetchDetail();
      return null;
    },
    [user?.id, groupId, fetchDetail],
  );

  const deleteTransaction = useCallback(
    async (txId: string): Promise<string | null> => {
      const { data, error: err } = await supabase
        .from('shared_transactions')
        .delete()
        .eq('id', txId)
        .select('id');
      if (err) return toMessage(err);
      if (!data?.length) return 'Anda hanya bisa menghapus catatan yang Anda tulis.';
      setTransactions((prev) => prev.filter((t) => t.id !== txId));
      return null;
    },
    [],
  );

  const inviteMember = useCallback(
    async (identifier: string): Promise<{ ok: boolean; message: string }> => {
      const value = identifier.trim();
      if (!value) return { ok: false, message: 'Masukkan email atau nomor HP rekan.' };
      if (!user || !groupId) return { ok: false, message: 'Grup tidak ditemukan.' };

      const { data: found, error: rpcErr } = await supabase.rpc('lookup_invite_target', {
        p_identifier: value,
      });

      if (rpcErr) return { ok: false, message: toMessage(rpcErr) };

      const target: any = Array.isArray(found) ? found[0] : found;

      if (target && target.user_id && target.user_id !== user.id) {
        const { data: existing } = await supabase
          .from('shared_group_members')
          .select('user_id')
          .eq('group_id', groupId)
          .eq('user_id', target.user_id)
          .maybeSingle();

        if (existing) {
          return { ok: false, message: `${target.display_name} sudah anggota grup ini.` };
        }

        const { error: addErr } = await supabase.from('shared_group_members').insert({
          group_id: groupId,
          user_id: target.user_id,
          role: 'member',
          display_name: target.display_name || 'Anggota',
          contact: target.contact || value,
        });

        if (addErr) return { ok: false, message: toMessage(addErr) };

        await fetchDetail();
        return { ok: true, message: `${target.display_name || value} ditambahkan ke grup.` };
      }

      const isEmail = value.includes('@');
      const digits = normalizeDigits(value);
      if (!isEmail && digits.length < 8) {
        return { ok: false, message: 'Email atau nomor HP belum benar.' };
      }

      const { data: pendingRows } = await supabase
        .from('shared_group_invites')
        .select('id, email, phone')
        .eq('group_id', groupId)
        .eq('status', 'pending');

      const dup = (pendingRows ?? []).some((row: any) =>
        isEmail
          ? (row.email ?? '').toLowerCase() === value.toLowerCase()
          : normalizeDigits(row.phone ?? '') === digits && !!row.phone,
      );

      if (dup) {
        return { ok: false, message: `Undangan ke ${value} sudah terkirim.` };
      }

      const { error: inviteErr } = await supabase.from('shared_group_invites').insert({
        group_id: groupId,
        inviter_id: user.id,
        email: isEmail ? value : null,
        phone: isEmail ? null : value,
      });

      if (inviteErr) return { ok: false, message: toMessage(inviteErr) };

      await fetchDetail();
      return {
        ok: true,
        message: isEmail
          ? `Undangan terkirim ke ${value}.`
          : `Undangan terkirim ke ${value}, anggota otomatis masuk saat mendaftar.`,
      };
    },
    [user?.id, groupId, fetchDetail],
  );

  const cancelInvite = useCallback(
    async (inviteId: string): Promise<string | null> => {
      const { data, error: err } = await supabase
        .from('shared_group_invites')
        .delete()
        .eq('id', inviteId)
        .select('id');
      if (err) return toMessage(err);
      if (!data?.length) return 'Undangan tidak bisa dibatalkan.';
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      return null;
    },
    [],
  );

  const removeMember = useCallback(
    async (memberId: string): Promise<string | null> => {
      if (!groupId) return 'Grup tidak ditemukan.';
      const { data, error: err } = await supabase
        .from('shared_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', memberId)
        .select('user_id');
      if (err) return toMessage(err);
      if (!data?.length) return 'Hanya pemilik grup yang bisa mengeluarkan anggota.';
      await fetchDetail();
      return null;
    },
    [groupId, fetchDetail],
  );

  const leaveGroup = useCallback(async (): Promise<string | null> => {
    if (!user || !groupId) return 'Grup tidak ditemukan.';
    const { data, error: err } = await supabase
      .from('shared_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .select('user_id');
    if (err) return toMessage(err);
    if (!data?.length) return 'Anda bukan anggota grup ini.';
    return null;
  }, [user?.id, groupId]);

  const deleteGroup = useCallback(async (): Promise<string | null> => {
    if (!groupId) return 'Grup tidak ditemukan.';
    const { data, error: err } = await supabase
      .from('shared_groups')
      .delete()
      .eq('id', groupId)
      .select('id');
    if (err) return toMessage(err);
    if (!data?.length) return 'Hanya pemilik grup yang bisa menghapus buku kas.';
    return null;
  }, [groupId]);

  const isOwner = group?.my_role === 'owner';
  const isMine = (tx: SharedTx) => tx.user_id === user?.id;
  const memberName = useCallback(
    (userId: string) => {
      const found = members.find((m) => m.user_id === userId);
      if (found?.display_name) return found.display_name;
      if (userId === user?.id) return display;
      return found?.contact || 'Anggota';
    },
    [members, user?.id, display],
  );

  return {
    group,
    members,
    transactions,
    invites,
    loading,
    error,
    isOwner,
    isMine,
    currentUserId: user?.id ?? null,
    memberName,
    fetchDetail,
    addTransaction,
    deleteTransaction,
    inviteMember,
    cancelInvite,
    removeMember,
    leaveGroup,
    deleteGroup,
  };
}
