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
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';
import { useToast } from '@/components/Toast';
import { useAlert } from '@/components/AppAlert';
import { LoadingBlock, ErrorBlock } from '@/components/DataState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useSharedGroups } from '@/hooks/useSharedLedger';
import { formatDate } from '@/utils/format';

export default function SharedLedgerModal() {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const alert = useAlert();
  const { groups, loading, error, fetchGroups, createGroup } = useSharedGroups();

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [fetchGroups]),
  );

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    const result = await createGroup(name);
    setBusy(false);

    if (result.error) {
      alert.error(result.error);
      return;
    }

    setName('');
    showToast('Buku kas bersama dibuat', 'success');
    if (result.id) {
      router.push({ pathname: '/(modals)/shared-group', params: { id: result.id } });
    }
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
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>CATAT BERSAMA</Text>
          <Text style={styles.title}>Buku kas bersama</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.desc}>
        Buat buku kas untuk bersama pasangan, keluarga, atau teman. Semua anggota bisa mencatat,
        tapi catatan pribadi Anda tetap privat.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Nama buku kas</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Misal: Keuangan Keluarga"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate} activeOpacity={0.8} disabled={busy}>
          {busy ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <MaterialCommunityIcons name="plus" size={18} color={colors.white} />
          )}
          <Text style={styles.primaryBtnText}>Buat buku kas</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Grup Anda</Text>

      {loading ? (
        <LoadingBlock label="Memuat grup..." />
      ) : error ? (
        <ErrorBlock message={error} onRetry={fetchGroups} />
      ) : groups.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="account-group-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Belum ada buku kas bersama</Text>
          <Text style={styles.emptyText}>
            Buat grup di atas, lalu undang rekan lewat email atau nomor HP.
          </Text>
        </View>
      ) : (
        groups.map((group) => (
          <TouchableOpacity
            key={group.id}
            style={styles.groupRow}
            activeOpacity={0.75}
            onPress={() => router.push({ pathname: '/(modals)/shared-group', params: { id: group.id } })}
          >
            <View style={styles.groupIcon}>
              <MaterialCommunityIcons name="account-group" size={18} color={colors.primaryDark} />
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupName} numberOfLines={1}>
                {group.name}
              </Text>
              <Text style={styles.groupMeta}>
                {group.member_count} anggota · Dibuat {formatDate(group.created_at)}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))
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
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    headerText: {
      flex: 1,
      paddingRight: 12,
    },
    eyebrow: {
      fontSize: 10,
      letterSpacing: 1.8,
      fontWeight: '600',
      color: colors.textMuted,
    },
    title: {
      fontSize: 25,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 4,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    desc: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      marginBottom: 24,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      fontWeight: '500',
      color: colors.textPrimary,
      marginBottom: 14,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.white,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      gap: 12,
    },
    groupIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.cardDark,
      justifyContent: 'center',
      alignItems: 'center',
    },
    groupInfo: {
      flex: 1,
    },
    groupName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    groupMeta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 3,
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 32,
      paddingHorizontal: 24,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 19,
    },
  });
