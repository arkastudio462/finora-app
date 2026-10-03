import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';
import { useToast } from '@/components/Toast';
import { useAlert } from '@/components/AppAlert';
import { LoadingBlock, ErrorBlock } from '@/components/DataState';
import { useSharedGroupDetail } from '@/hooks/useSharedLedger';
import { formatAmountInput, parseAmountInput } from '@/utils/format';
import { CATEGORIES } from '@/constants/theme';

const TYPES = [
  { key: 'expense', label: 'Pengeluaran', icon: 'arrow-up' },
  { key: 'income', label: 'Pemasukan', icon: 'arrow-down' },
] as const;

export default function AddSharedTransactionModal() {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const alert = useAlert();
  const params = useLocalSearchParams<{ groupId?: string; groupName?: string }>();
  const groupId = params.groupId ?? null;

  const { group, loading, error, fetchDetail, addTransaction } = useSharedGroupDetail(groupId);

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Other');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (busy) return;

    const value = parseAmountInput(amount);
    if (!description.trim()) {
      alert.error('Nama catatan belum diisi.');
      return;
    }
    if (value <= 0) {
      alert.error('Nominal belum benar.');
      return;
    }

    setBusy(true);
    const err = await addTransaction({ type, description, category, amount: value });
    setBusy(false);

    if (err) {
      alert.error(err);
      return;
    }

    showToast('Catatan ditambahkan', 'success');
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>CATATAN BERSAMA</Text>
            <Text style={styles.title} numberOfLines={1}>
              {group?.name ? `Catat di ${group.name}` : 'Tambah catatan'}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <LoadingBlock label="Memuat buku kas..." />
        ) : error || !group ? (
          <ErrorBlock message={error || 'Grup tidak ditemukan.'} onRetry={fetchDetail} />
        ) : (
          <>
            <Text style={styles.label}>Jenis</Text>
            <View style={styles.typeRow}>
              {TYPES.map((option) => {
                const active = type === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.typeBtn, active && styles.typeBtnActive]}
                    activeOpacity={0.75}
                    onPress={() => setType(option.key)}
                  >
                    <MaterialCommunityIcons
                      name={option.icon as any}
                      size={16}
                      color={active ? colors.white : colors.textSecondary}
                    />
                    <Text style={[styles.typeText, active && styles.typeTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Nama catatan</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Misal: Belanja bulanan"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
            />

            <Text style={styles.label}>Kategori</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <MaterialCommunityIcons
                    name={category === cat ? 'check-circle' : 'circle-outline'}
                    size={14}
                    color={category === cat ? colors.white : colors.textMuted}
                  />
                  <Text
                    style={[styles.categoryText, category === cat && styles.categoryTextActive]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Nominal</Text>
            <View style={styles.amountInput}>
              <Text style={styles.amountPrefix}>Rp</Text>
              <TextInput
                style={styles.amountField}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={amount}
                onChangeText={(text) => setAmount(formatAmountInput(text))}
              />
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={busy}
            >
              <MaterialCommunityIcons name="check" size={20} color={colors.white} />
              <Text style={styles.saveBtnText}>Simpan catatan</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
      marginBottom: 24,
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
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    typeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },
    typeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeBtnActive: {
      backgroundColor: colors.cardDark,
      borderColor: colors.cardDark,
    },
    typeText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    typeTextActive: {
      color: colors.white,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      fontWeight: '500',
      color: colors.textPrimary,
      marginBottom: 24,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 24,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    categoryChipActive: {
      backgroundColor: colors.cardDark,
      borderColor: colors.cardDark,
    },
    categoryText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    categoryTextActive: {
      color: colors.white,
    },
    amountInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      marginBottom: 24,
    },
    amountPrefix: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textMuted,
    },
    amountField: {
      flex: 1,
      paddingVertical: 16,
      paddingHorizontal: 12,
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    saveBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.white,
    },
  });
