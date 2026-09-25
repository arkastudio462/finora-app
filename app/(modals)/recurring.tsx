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
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFinance,
  PaymentMethod,
  RecurringFrequency,
  RecurringTransaction,
} from '@/context/FinanceContext';
import { useToast } from '@/components/Toast';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { COLORS, CATEGORIES } from '@/constants/theme';
import { formatRupiah, getPaymentMethodLabel } from '@/utils/format';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';
import { useAlert } from '@/components/AppAlert';

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: 'cash', label: 'Tunai', icon: 'cash' },
  { key: 'non_cash', label: 'Nontunai', icon: 'credit-card-outline' },
];

const FREQUENCIES: { key: RecurringFrequency; label: string; icon: string }[] = [
  { key: 'daily', label: 'Harian', icon: 'calendar-today' },
  { key: 'weekly', label: 'Mingguan', icon: 'calendar-refresh' },
  { key: 'monthly', label: 'Bulanan', icon: 'calendar-month' },
  { key: 'yearly', label: 'Tahunan', icon: 'calendar-star' },
];

const WEEK_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDueDate(key: string): string {
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y) return key;
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function nextLabel(item: RecurringTransaction): string {
  const [y, m, d] = String(item.next_date).split('-').map(Number);
  if (!y) return formatDueDate(item.next_date);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return 'Hari ini';
  if (diffDays === 1) return 'Besok';
  if (diffDays < 0) return formatDueDate(item.next_date);
  if (diffDays < 7) return `${WEEK_DAYS[date.getDay()]}, ${diffDays} hari lagi`;
  return formatDueDate(item.next_date);
}

export default function RecurringModal() {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const {
    state,
    addRecurring,
    updateRecurring,
    deleteRecurring,
  } = useFinance();
  const { showToast } = useToast();
  const { categories: customCategories } = useCustomCategories();
  const router = useRouter();
  const alert = useAlert();
  const insets = useSafeAreaInsets();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [saving, setSaving] = useState(false);

  const categoryOptions = Array.from(new Set([...CATEGORIES, ...customCategories]));

  const openAdd = () => {
    setEditId(null);
    setType('expense');
    setAmount('');
    setDescription('');
    setCategory(CATEGORIES[0]);
    setPaymentMethod('cash');
    setFrequency('monthly');
    setShowForm(true);
  };

  const openEdit = (item: RecurringTransaction) => {
    setEditId(item.id);
    setType(item.type);
    setAmount(String(item.amount));
    setDescription(item.description);
    setCategory(item.category);
    setPaymentMethod(item.payment_method);
    setFrequency(item.frequency);
    setShowForm(true);
  };

  const handleSave = async () => {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      alert.error('Masukkan jumlah yang valid');
      return;
    }
    if (!description.trim()) {
      alert.error('Masukkan keterangan');
      return;
    }

    setSaving(true);
    let error: string | null = null;

    if (editId) {
      const existing = state.recurring.find((r) => r.id === editId);
      if (!existing) {
        setSaving(false);
        alert.error('Data tidak ditemukan');
        return;
      }
      error = await updateRecurring({
        ...existing,
        type,
        description: description.trim(),
        category,
        amount: value,
        payment_method: paymentMethod,
        frequency,
      });
    } else {
      const now = new Date();
      error = await addRecurring({
        type,
        description: description.trim(),
        category,
        amount: value,
        payment_method: paymentMethod,
        frequency,
        next_date: localDateKey(now),
        active: true,
      });
    }

    setSaving(false);

    if (error) {
      alert.error(error, 'Gagal menyimpan');
      return;
    }

    showToast(editId ? 'Transaksi berulang diperbarui' : 'Transaksi berulang ditambahkan', 'success');
    setShowForm(false);
    setEditId(null);
  };

  const handleToggle = async (item: RecurringTransaction) => {
    const error = await updateRecurring({ ...item, active: !item.active });
    if (error) showToast(error, 'error');
    else showToast(item.active ? 'Transaksi dijeda' : 'Transaksi diaktifkan', 'info');
  };

  const handleDelete = (item: RecurringTransaction) => {
    alert.confirm({
      title: 'Hapus transaksi berulang?',
      message: `"${item.description}" akan dihapus permanen.`,
      confirmText: 'Hapus',
      onConfirm: async () => {
        const error = await deleteRecurring(item.id);
        if (error) showToast(error, 'error');
        else showToast('Transaksi berulang dihapus', 'info');
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>RECURRING</Text>
            <Text style={styles.title}>Transaksi Berulang</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {!showForm && (
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
            <MaterialCommunityIcons name="plus" size={18} color={colors.white} />
            <Text style={styles.addBtnText}>Tambah transaksi berulang</Text>
          </TouchableOpacity>
        )}

        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editId ? 'Edit transaksi berulang' : 'Transaksi berulang baru'}</Text>

            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'expense' && styles.typeBtnActive]}
                onPress={() => setType('expense')}
              >
                <MaterialCommunityIcons
                  name="arrow-up-right"
                  size={16}
                  color={type === 'expense' ? colors.white : colors.textSecondary}
                />
                <Text style={[styles.typeBtnText, type === 'expense' && styles.typeBtnTextActive]}>
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'income' && styles.typeBtnActiveIncome]}
                onPress={() => setType('income')}
              >
                <MaterialCommunityIcons
                  name="arrow-down-left"
                  size={16}
                  color={type === 'income' ? colors.white : colors.textSecondary}
                />
                <Text style={[styles.typeBtnText, type === 'income' && styles.typeBtnTextActive]}>
                  Income
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Jumlah</Text>
            <View style={styles.amountInput}>
              <Text style={styles.amountPrefix}>Rp</Text>
              <TextInput
                style={styles.amountField}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <Text style={styles.label}>Keterangan</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Iuran bulanan"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            <Text style={styles.label}>Kategori</Text>
            <View style={styles.chipWrap}>
              {categoryOptions.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, category === cat && styles.chipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Metode pembayaran</Text>
            <View style={styles.paymentRow}>
              {PAYMENT_METHODS.map((m) => {
                const active = paymentMethod === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.paymentBtn, active && styles.paymentBtnActive]}
                    onPress={() => setPaymentMethod(m.key)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={m.icon as any}
                      size={16}
                      color={active ? colors.white : colors.textSecondary}
                    />
                    <Text style={[styles.paymentBtnText, active && styles.paymentBtnTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Frekuensi</Text>
            <View style={styles.frequencyRow}>
              {FREQUENCIES.map((f) => {
                const active = frequency === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.frequencyBtn, active && styles.frequencyBtnActive]}
                    onPress={() => setFrequency(f.key)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={f.icon as any}
                      size={15}
                      color={active ? colors.white : colors.textSecondary}
                    />
                    <Text style={[styles.frequencyText, active && styles.frequencyTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.note}>
              {editId
                ? 'Tanggal berikutnya tidak berubah saat diedit.'
                : 'Transaksi pertama dibuat mulai hari ini, lalu diulang otomatis.'}
            </Text>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowForm(false);
                  setEditId(null);
                }}
              >
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="check" size={18} color={colors.white} />
                <Text style={styles.saveBtnText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!showForm && state.recurring.length === 0 && (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="repeat-variant" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Belum ada transaksi berulang</Text>
            <Text style={styles.emptyText}>
              Buat iuran, langganan, atau gaji yang terjadi berulang agar dicatat otomatis.
            </Text>
          </View>
        )}

        {!showForm &&
          state.recurring.map((item) => (
            <View key={item.id} style={[styles.card, !item.active && styles.cardPaused]}>
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <MaterialCommunityIcons
                    name={item.type === 'income' ? 'arrow-down-left' : 'arrow-up-right'}
                    size={16}
                    color={item.type === 'income' ? '#16a34a' : colors.primary}
                  />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.category} · {getPaymentMethodLabel(item.payment_method)} ·{' '}
                    {FREQUENCIES.find((f) => f.key === item.frequency)?.label}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.cardAmount,
                    { color: item.type === 'income' ? '#16a34a' : colors.primary },
                  ]}
                >
                  {item.type === 'income' ? '+' : '-'}
                  {formatRupiah(item.amount)}
                </Text>
              </View>

              <View style={styles.cardBottom}>
                <View style={styles.dueBox}>
                  <MaterialCommunityIcons name="calendar-clock" size={13} color={colors.textMuted} />
                  <Text style={styles.dueText}>{nextLabel(item)}</Text>
                </View>

                <View style={styles.cardActions}>
                  <Text style={styles.activeLabel}>{item.active ? 'Aktif' : 'Jeda'}</Text>
                  <Switch
                    value={item.active}
                    onValueChange={() => handleToggle(item)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.white}
                  />
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => openEdit(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={17} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => handleDelete(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={17} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

        {!showForm && state.recurring.length > 0 && (
          <Text style={styles.footerNote}>
            Transaksi dibuat otomatis saat aplikasi dibuka pada tanggal jatuh tempo.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
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
    marginBottom: 20,
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

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 15,
    marginBottom: 18,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 18,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },

  typeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  typeBtnActive: {
    backgroundColor: colors.cardDark,
    borderColor: colors.cardDark,
  },
  typeBtnActiveIncome: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeBtnTextActive: {
    color: colors.white,
  },

  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  amountPrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  amountField: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 16,
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.cardDark,
    borderColor: colors.cardDark,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },

  paymentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  paymentBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  paymentBtnActive: {
    backgroundColor: colors.cardDark,
    borderColor: colors.cardDark,
  },
  paymentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  paymentBtnTextActive: {
    color: colors.white,
  },

  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  frequencyBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  frequencyBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  frequencyText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  frequencyTextActive: {
    color: colors.white,
  },

  note: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 16,
  },

  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 1.4,
    flexDirection: 'row',
    gap: 8,
    borderRadius: 16,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    marginBottom: 11,
  },
  cardPaused: {
    opacity: 0.6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  cardAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dueText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 6,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  footerNote: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
});
