import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFinance } from '@/context/FinanceContext';
import { useToast } from '@/components/Toast';
import { formatRupiah, getPaymentMethodLabel } from '@/utils/format';
import { getCategoryIcon } from '@/utils/icons';
import { COLORS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';
import { RECEIPTS_BUCKET } from '@/lib/images';
import ImagePreview from '@/components/ImagePreview';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';
import { useAlert } from '@/components/AppAlert';

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const colors = useColors();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <MaterialCommunityIcons name={icon as any} size={16} color={colors.textSecondary} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function TransactionDetailModal() {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, deleteTransaction } = useFinance();
  const { showToast } = useToast();
  const router = useRouter();
  const alert = useAlert();
  const insets = useSafeAreaInsets();
  const [preview, setPreview] = useState(false);

  const tx = state.transactions.find((t) => t.id === id);
  const photoUrl = useSignedImageUrl(RECEIPTS_BUCKET, tx?.image_path ?? null);

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Detail transaksi</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (!tx) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        {header}
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>Transaksi tidak ditemukan.</Text>
        </View>
      </View>
    );
  }

  const isIncome = tx.type === 'income';
  const color = isIncome ? '#22c55e' : colors.primaryDark;
  const formattedDate = new Date(tx.date).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleEdit = () => {
    router.push({
      pathname: '/(modals)/add-transaction',
      params: {
        editId: tx.id,
        type: tx.type,
        amount: String(tx.amount),
        description: tx.description,
        category: tx.category,
      },
    });
  };

  const handleDelete = () => {
    alert.confirm({
      title: 'Delete Transaction',
      message: 'This action cannot be undone.',
      confirmText: 'Delete',
      onConfirm: async () => {
        await deleteTransaction(tx.id);
        showToast('Transaction deleted', 'success');
        router.back();
      },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.amountCard}>
          <View style={styles.typeBadge}>
            <MaterialCommunityIcons
              name={isIncome ? 'arrow-down-left' : 'arrow-up-right'}
              size={14}
              color={color}
            />
            <Text style={[styles.typeBadgeText, { color }]}>
              {isIncome ? 'Income' : 'Expense'}
            </Text>
          </View>
          <Text style={[styles.amount, { color }]}>
            {isIncome ? '+' : '-'} {formatRupiah(tx.amount)}
          </Text>
          <Text style={styles.description}>{tx.description}</Text>
        </View>

        <View style={styles.card}>
          <DetailRow icon={getCategoryIcon(tx.category)} label="Kategori" value={tx.category} />
          <View style={styles.divider} />
          <DetailRow
            icon={tx.payment_method === 'cash' ? 'cash' : 'credit-card-outline'}
            label="Metode"
            value={getPaymentMethodLabel(tx.payment_method)}
          />
          <View style={styles.divider} />
          <DetailRow icon="calendar-clock" label="Tanggal" value={formattedDate} />
        </View>

        {tx.image_path ? (
          <TouchableOpacity
            style={styles.photoCard}
            activeOpacity={0.85}
            disabled={!photoUrl}
            onPress={() => setPreview(true)}
          >
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={[styles.photo, styles.photoLoading]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
            <Text style={styles.photoCaption}>Tap untuk melihat ukuran penuh</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.editBtn} activeOpacity={0.8} onPress={handleEdit}>
          <MaterialCommunityIcons name="pencil" size={18} color={colors.white} />
          <Text style={styles.editText}>Edit transaksi</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.8} onPress={handleDelete}>
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
          <Text style={styles.deleteText}>Hapus transaksi</Text>
        </TouchableOpacity>
      </ScrollView>

      <ImagePreview visible={preview} uri={photoUrl} onClose={() => setPreview(false)} />
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  amountCard: {
    backgroundColor: colors.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  amount: {
    fontSize: 30,
    fontWeight: '700',
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  photoCard: {
    backgroundColor: colors.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: colors.border,
  },
  photoLoading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCaption: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  editText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
