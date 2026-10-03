import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';
import { useToast } from '@/components/Toast';
import { useAlert } from '@/components/AppAlert';
import { LoadingBlock, ErrorBlock } from '@/components/DataState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useSharedGroupDetail } from '@/hooks/useSharedLedger';
import { formatDate, formatRupiah } from '@/utils/format';

export default function SharedGroupModal() {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const alert = useAlert();
  const params = useLocalSearchParams<{ id?: string }>();
  const groupId = params.id ?? null;

  const {
    group,
    members,
    transactions,
    invites,
    loading,
    error,
    isOwner,
    isMine,
    currentUserId,
    memberName,
    fetchDetail,
    deleteTransaction,
    inviteMember,
    cancelInvite,
    removeMember,
    leaveGroup,
    deleteGroup,
  } = useSharedGroupDetail(groupId);

  const [inviteValue, setInviteValue] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchDetail();
    }, [fetchDetail]),
  );

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const handleInvite = async () => {
    if (busy) return;
    setBusy(true);
    const result = await inviteMember(inviteValue);
    setBusy(false);

    if (result.ok) {
      setInviteValue('');
      showToast(result.message, 'success');
    } else {
      alert.error(result.message);
    }
  };

  const handleDeleteTransaction = (txId: string) => {
    alert.confirm({
      title: 'Hapus catatan?',
      message: 'Catatan ini hanya dihapus dari buku kas bersama.',
      confirmText: 'Hapus',
      destructive: true,
      onConfirm: async () => {
        const err = await deleteTransaction(txId);
        if (err) alert.error(err);
        else showToast('Catatan dihapus', 'success');
      },
    });
  };

  const handleRemoveMember = (userId: string, name: string) => {
    alert.confirm({
      title: `Keluarkan ${name}?`,
      message: 'Anggota akan kehilangan akses ke buku kas ini.',
      confirmText: 'Keluarkan',
      destructive: true,
      onConfirm: async () => {
        const err = await removeMember(userId);
        if (err) alert.error(err);
        else showToast(`${name} dikeluarkan dari grup`, 'success');
      },
    });
  };

  const handleLeave = () => {
    alert.confirm({
      title: 'Keluar dari grup?',
      message: 'Anda tidak akan bisa melihat buku kas ini lagi.',
      confirmText: 'Keluar',
      destructive: true,
      onConfirm: async () => {
        const err = await leaveGroup();
        if (err) {
          alert.error(err);
          return;
        }
        showToast('Anda keluar dari grup', 'success');
        router.back();
      },
    });
  };

  const handleDeleteGroup = () => {
    alert.confirm({
      title: 'Hapus buku kas?',
      message: 'Semua catatan dan anggota di grup ini ikut terhapus.',
      confirmText: 'Hapus',
      destructive: true,
      onConfirm: async () => {
        const err = await deleteGroup();
        if (err) {
          alert.error(err);
          return;
        }
        showToast('Buku kas dihapus', 'success');
        router.back();
      },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <OfflineBanner />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>BUKU KAS BERSAMA</Text>
          <Text style={styles.title} numberOfLines={1}>
            {group?.name || 'Memuat...'}
          </Text>
        </View>
        <View style={styles.iconBtnPlaceholder} />
      </View>

      {loading ? (
        <LoadingBlock label="Memuat buku kas..." />
      ) : error || !group ? (
        <ErrorBlock message={error || 'Grup tidak ditemukan.'} onRetry={fetchDetail} />
      ) : (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="arrow-down" size={14} color={colors.success} />
              <Text style={styles.summaryLabel}>Masuk</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                {formatRupiah(totalIncome)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="arrow-up" size={14} color={colors.danger} />
              <Text style={styles.summaryLabel}>Keluar</Text>
              <Text style={[styles.summaryValue, { color: colors.danger }]}>
                {formatRupiah(totalExpense)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="scale-balance" size={14} color={colors.primary} />
              <Text style={styles.summaryLabel}>Selisih</Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: balance >= 0 ? colors.success : colors.danger },
                ]}
              >
                {formatRupiah(balance)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.8}
            onPress={() =>
              router.push({
                pathname: '/(modals)/add-shared-transaction',
                params: { groupId: group.id, groupName: group.name },
              })
            }
          >
            <MaterialCommunityIcons name="plus" size={18} color={colors.white} />
            <Text style={styles.addBtnText}>Tambah catatan</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Catatan ({transactions.length})</Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="notebook-outline" size={34} color={colors.textMuted} />
              <Text style={styles.emptyText}>Belum ada catatan di buku kas ini.</Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View
                  style={[
                    styles.txIcon,
                    {
                      backgroundColor:
                        tx.type === 'income'
                          ? 'rgba(22,163,74,0.14)'
                          : 'rgba(239,68,68,0.14)',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={tx.type === 'income' ? 'arrow-down' : 'arrow-up'}
                    size={16}
                    color={tx.type === 'income' ? colors.success : colors.danger}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txDesc} numberOfLines={1}>
                    {tx.description}
                  </Text>
                  <Text style={styles.txMeta} numberOfLines={1}>
                    {tx.category} · {memberName(tx.user_id)} · {formatDate(tx.date)}
                  </Text>
                </View>
                <View style={styles.txRight}>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: tx.type === 'income' ? colors.success : colors.danger },
                    ]}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatRupiah(Number(tx.amount))}
                  </Text>
                  {isMine(tx) && (
                    <TouchableOpacity
                      style={styles.txDelete}
                      onPress={() => handleDeleteTransaction(tx.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={15} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Anggota ({members.length})</Text>
          <View style={styles.card}>
            {members.map((member) => (
              <View key={member.user_id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {(member.display_name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.display_name || member.contact || 'Anggota'}
                    {member.user_id === currentUserId ? ' (Anda)' : ''}
                  </Text>
                  {!!member.contact && (
                    <Text style={styles.memberContact} numberOfLines={1}>
                      {member.contact}
                    </Text>
                  )}
                </View>
                {member.role === 'owner' ? (
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>Pemilik</Text>
                  </View>
                ) : isOwner ? (
                  <TouchableOpacity
                    onPress={() =>
                      handleRemoveMember(
                        member.user_id,
                        member.display_name || member.contact || 'Anggota',
                      )
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="account-remove-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}

            {invites.map((invite) => (
              <View key={invite.id} style={styles.memberRow}>
                <View style={[styles.memberAvatar, styles.pendingAvatar]}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textMuted} />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {invite.email || invite.phone}
                  </Text>
                  <Text style={styles.memberContact}>Menunggu bergabung</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    alert.confirm({
                      title: 'Batalkan undangan?',
                      confirmText: 'Batalkan',
                      destructive: true,
                      onConfirm: async () => {
                        const err = await cancelInvite(invite.id);
                        if (err) alert.error(err);
                        else showToast('Undangan dibatalkan', 'success');
                      },
                    });
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Undang rekan</Text>
          <View style={styles.card}>
            <Text style={styles.inviteHint}>
              Masukkan email atau nomor HP. Jika sudah terdaftar di Finora, ia langsung menjadi
              anggota.
            </Text>
            <View style={styles.inviteRow}>
              <TextInput
                style={styles.inviteInput}
                value={inviteValue}
                onChangeText={setInviteValue}
                placeholder="email@contoh.com / 0812..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={handleInvite}
              />
              <TouchableOpacity
                style={styles.inviteBtn}
                onPress={handleInvite}
                activeOpacity={0.8}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <MaterialCommunityIcons name="send-outline" size={16} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.dangerBtn, { marginTop: 24 }]}
            activeOpacity={0.8}
            onPress={isOwner ? handleDeleteGroup : handleLeave}
          >
            <MaterialCommunityIcons
              name={isOwner ? 'trash-can-outline' : 'exit-to-app'}
              size={16}
              color={colors.danger}
            />
            <Text style={styles.dangerBtnText}>
              {isOwner ? 'Hapus buku kas' : 'Keluar dari grup'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: insets.bottom + 24 }} />
        </>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      gap: 12,
    },
    headerText: {
      flex: 1,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconBtnPlaceholder: {
      width: 36,
    },
    eyebrow: {
      fontSize: 10,
      letterSpacing: 1.8,
      fontWeight: '600',
      color: colors.textMuted,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 3,
    },
    summaryCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 16,
      marginBottom: 16,
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    summaryDivider: {
      width: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '700',
    },
    addBtn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 24,
    },
    addBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.white,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 12,
      marginTop: 4,
    },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 8,
      gap: 10,
    },
    txIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    txInfo: {
      flex: 1,
    },
    txDesc: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    txMeta: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 3,
    },
    txRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    txAmount: {
      fontSize: 13,
      fontWeight: '700',
    },
    txDelete: {
      paddingHorizontal: 2,
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 26,
      gap: 8,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 8,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    memberAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.cardDark,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pendingAvatar: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    memberAvatarText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.white,
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    memberContact: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    roleBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.cardDark,
    },
    roleBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.white,
    },
    inviteHint: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      marginBottom: 10,
    },
    inviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    inviteInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.textPrimary,
    },
    inviteBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: 'rgba(239,68,68,0.08)',
    },
    dangerBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.danger,
    },
  });
