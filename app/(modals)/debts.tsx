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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFinance,
  PaymentMethod,
  DebtKind,
  Debt,
} from '@/context/FinanceContext';
import { useToast } from '@/components/Toast';
import { useAlert } from '@/components/AppAlert';
import DatePickerField from '@/components/DatePickerField';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { CATEGORIES } from '@/constants/theme';
import type { Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/context/ThemeContext';
import { formatRupiah, getPaymentMethodLabel } from '@/utils/format';

type Filter = 'all' | DebtKind;

const KIND_LABEL: Record<DebtKind, string> = {
  payable: 'Hutang',
  receivable: 'Tagihan',
};

const KIND_SUB: Record<DebtKind, string> = {
  payable: 'Saya berutang',
  receivable: 'Ditagih ke saya',
};

const KIND_ICON: Record<DebtKind, string> = {
  payable: 'arrow-up-right',
  receivable: 'arrow-down-left',
};

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: 'cash', label: 'Tunai', icon: 'cash' },
  { key: 'non_cash', label: 'Nontunai', icon: 'credit-card-outline' },
];

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'payable', label: 'Hutang' },
  { key: 'receivable', label: 'Tagihan' },
];


function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateKey(key: string): string {
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y) return key;
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function dueState(dueDate: string | null): { label: string; overdue: boolean; soon: boolean } {
  if (!dueDate) return { label: 'Tanpa jatuh tempo', overdue: false, soon: false };
  const [y, m, d] = dueDate.split('-').map(Number);
  if (!y) return { label: dueDate, overdue: false, soon: false };
  const target = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `Lewat ${Math.abs(diff)} hari`, overdue: true, soon: false };
  if (diff === 0) return { label: 'Jatuh tempo hari ini', overdue: false, soon: true };
  if (diff <= 7) return { label: `Jatuh tempo ${diff} hari lagi`, overdue: false, soon: true };
  return { label: `Jatuh tempo ${formatDateKey(dueDate)}`, overdue: false, soon: false };
}

export default function DebtsModal() {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const { state, addDebt, updateDebt, deleteDebt, addDebtPayment, getDebtPaid } = useFinance();
  const { showToast } = useToast();
  const alert = useAlert();
  const { categories: customCategories } = useCustomCategories();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState<Filter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [kind, setKind] = useState<DebtKind>('payable');
  const [counterparty, setCounterparty] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);

  const categoryOptions = Array.from(new Set([...CATEGORIES, ...customCategories]));
  const paid = (id: string) => getDebtPaid(id);
  const remaining = (d: Debt) => Math.max(0, d.amount - paid(d.id));

  const visibleDebts = state.debts.filter((d) => filter === 'all' || d.kind === filter);
  const totalPayable = state.debts
    .filter((d) => d.kind === 'payable' && d.status === 'open')
    .reduce((sum, d) => sum + remaining(d), 0);
  const totalReceivable = state.debts
    .filter((d) => d.kind === 'receivable' && d.status === 'open')
    .reduce((sum, d) => sum + remaining(d), 0);

  const resetForm = () => {
    setEditId(null);
    setKind('payable');
    setCounterparty('');
    setDescription('');
    setAmount('');
    setCategory(CATEGORIES[0]);
    setPaymentMethod('cash');
    setDueDate('');
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (d: Debt) => {
    setEditId(d.id);
    setKind(d.kind);
    setCounterparty(d.counterparty);
    setDescription(d.description);
    setAmount(String(d.amount));
    setCategory(d.category);
    setPaymentMethod(d.payment_method);
    setDueDate(d.due_date ?? '');
    setShowForm(true);
  };

  const handleSave = async () => {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      alert.error('Masukkan jumlah yang valid');
      return;
    }
    if (!counterparty.trim()) {
      alert.error('Masukkan nama pihak (orang/perusahaan)');
      return;
    }
    setSaving(true);
    let error: string | null = null;
    const payload = {
      kind,
      counterparty: counterparty.trim(),
      description: description.trim() || KIND_LABEL[kind],
      amount: value,
      category,
      payment_method: paymentMethod,
      due_date: dueDate.trim() ? dueDate.trim() : null,
      status: 'open' as const,
    };

    if (editId) {
      const existing = state.debts.find((d) => d.id === editId);
      if (!existing) {
        setSaving(false);
        alert.error('Data tidak ditemukan');
        return;
      }
      error = await updateDebt({ ...existing, ...payload });
    } else {
      error = await addDebt(payload);
    }

    setSaving(false);

    if (error) {
      alert.error(error, 'Gagal menyimpan');
      return;
    }

    showToast(editId ? 'Hutang/tagihan diperbarui' : 'Hutang/tagihan ditambahkan', 'success');
    setShowForm(false);
    resetForm();
  };

  const handleDelete = (d: Debt) => {
    alert.confirm({
      title: 'Hapus hutang/tagihan?',
      message: `"${d.counterparty}" beserta riwayat pembayarannya akan dihapus (termasuk transaksi yang dibuat otomatis).`,
      confirmText: 'Hapus',
      onConfirm: async () => {
        const error = await deleteDebt(d.id);
        if (error) showToast(error, 'error');
        else showToast('Hutang/tagihan dihapus', 'info');
      },
    });
  };

  const openPay = (d: Debt) => {
    setPayingId(d.id);
    setPayAmount(String(remaining(d)));
    setPayNote('');
  };

  const handlePay = async () => {
    if (!payingId) return;
    const value = Number(payAmount);
    if (!payAmount || Number.isNaN(value) || value <= 0) {
      alert.error('Masukkan jumlah pembayaran yang valid');
      return;
    }

    setPaying(true);
    const error = await addDebtPayment(payingId, value, payNote);
    setPaying(false);

    if (error) {
      alert.error(error, 'Gagal mencatat pembayaran');
      return;
    }

    setPayingId(null);
    showToast('Pembayaran dicatat & transaksi dibuat', 'success');
  };

  const payingDebt = state.debts.find((d) => d.id === payingId) ?? null;

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
            <Text style={styles.eyebrow}>DEBTS & RECEIVABLES</Text>
            <Text style={styles.title}>Hutang & Tagihan</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Saya berutang</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              {formatRupiah(totalPayable)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Ditagih ke saya</Text>
            <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
              {formatRupiah(totalReceivable)}
            </Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
              activeOpacity={0.7}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!showForm && (
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
            <MaterialCommunityIcons name="plus" size={18} color={colors.white} />
            <Text style={styles.addBtnText}>Tambah hutang / tagihan</Text>
          </TouchableOpacity>
        )}

        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editId ? 'Edit hutang/tagihan' : 'Hutang/tagihan baru'}</Text>

            <View style={styles.kindRow}>
              {(Object.keys(KIND_LABEL) as DebtKind[]).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.kindBtn, kind === k && styles.kindBtnActive]}
                  onPress={() => setKind(k)}
                >
                  <MaterialCommunityIcons
                    name={KIND_ICON[k] as any}
                    size={16}
                    color={kind === k ? colors.white : colors.textSecondary}
                  />
                  <View>
                    <Text style={[styles.kindText, kind === k && styles.kindTextActive]}>
                      {KIND_LABEL[k]}
                    </Text>
                    <Text style={[styles.kindSub, kind === k && styles.kindSubActive]}>
                      {KIND_SUB[k]}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Nama pihak</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Budi / Bank ABC"
              placeholderTextColor={colors.textMuted}
              value={counterparty}
              onChangeText={setCounterparty}
            />

            <Text style={styles.label}>Keterangan</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Pinjaman modal"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            <Text style={styles.label}>Jumlah total</Text>
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

            <Text style={styles.label}>Kategori transaksi</Text>
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
            <Text style={styles.hint}>
              Setiap pembayaran akan dicatat sebagai transaksi {kind === 'payable' ? 'pengeluaran' : 'pemasukan'} dengan kategori ini.
            </Text>

            <Text style={styles.label}>Metode pembayaran</Text>
            <View style={styles.paymentRow}>
              {PAYMENT_METHODS.map((m) => {
                const active = paymentMethod === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.paymentBtn, active && styles.paymentBtnActive]}
                    onPress={() => setPaymentMethod(m.key)}
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

            <DatePickerField
              label="Jatuh tempo (opsional)"
              value={dueDate || null}
              onChange={(v) => setDueDate(v ?? '')}
              placeholder="Pilih jatuh tempo"
            />

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowForm(false);
                  resetForm();
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

        {visibleDebts.length === 0 && !showForm && (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="hand-coin-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Belum ada data</Text>
            <Text style={styles.emptyText}>
              Catat uang yang kamu pinjam atau tagihan yang harus dibayar orang lain.
            </Text>
          </View>
        )}

        {visibleDebts.map((d) => {
          const alreadyPaid = paid(d.id);
          const left = remaining(d);
          const pct = d.amount > 0 ? Math.min(100, Math.round((alreadyPaid / d.amount) * 100)) : 0;
          const due = dueState(d.due_date);
          const isExpanded = expandedId === d.id;
          const payments = state.debtPayments
            .filter((p) => p.debt_id === d.id)
            .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1));

          return (
            <View key={d.id} style={[styles.card, d.status === 'paid' && styles.cardPaid]}>
              <View style={styles.cardTop}>
                <View
                  style={[
                    styles.cardIcon,
                    { backgroundColor: d.kind === 'payable' ? 'rgba(249,115,22,0.12)' : 'rgba(22,163,74,0.12)' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={KIND_ICON[d.kind] as any}
                    size={16}
                    color={d.kind === 'payable' ? colors.primary : '#16a34a'}
                  />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardCounter} numberOfLines={1}>
                    {d.counterparty}
                  </Text>
                  <Text style={styles.cardDesc} numberOfLines={1}>
                    {KIND_LABEL[d.kind]} · {d.description}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.cardSisa, { color: d.kind === 'payable' ? colors.primary : '#16a34a' }]}>
                    {formatRupiah(left)}
                  </Text>
                  <Text style={styles.cardOfTotal}>dari {formatRupiah(d.amount)}</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${pct}%`, backgroundColor: d.status === 'paid' ? '#16a34a' : colors.primary },
                  ]}
                />
              </View>

              <View style={styles.cardMetaRow}>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      d.status === 'paid' ? styles.statusPaid : styles.statusOpen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: d.status === 'paid' ? '#16a34a' : colors.primary },
                      ]}
                    >
                      {d.status === 'paid' ? 'Lunas' : `Belum lunas · ${pct}%`}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.dueBadge,
                      due.overdue && styles.dueOverdue,
                      due.soon && styles.dueSoon,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="calendar-clock"
                      size={12}
                      color={due.overdue ? colors.danger : due.soon ? colors.primary : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.dueText,
                        { color: due.overdue ? colors.danger : due.soon ? colors.primary : colors.textMuted },
                      ]}
                    >
                      {due.label}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  onPress={() => setExpandedId(isExpanded ? null : d.id)}
                >
                  <Text style={styles.historyLink}>
                    {payments.length} pembayaran {isExpanded ? '▴' : '▾'}
                  </Text>
                </TouchableOpacity>
              </View>

              {isExpanded && (
                <View style={styles.historyBox}>
                  {payments.length === 0 ? (
                    <Text style={styles.historyEmpty}>Belum ada pembayaran.</Text>
                  ) : (
                    payments.map((p) => (
                      <View key={p.id} style={styles.historyItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyNote}>
                            {p.note || (d.kind === 'payable' ? 'Bayar hutang' : 'Terima pembayaran')}
                          </Text>
                          <Text style={styles.historyDate}>
                            {new Date(p.paid_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </Text>
                        </View>
                        <Text style={styles.historyAmount}>{formatRupiah(p.amount)}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}

              <View style={styles.cardActions}>
                {d.status === 'open' && (
                  <TouchableOpacity
                    style={styles.payBtn}
                    activeOpacity={0.8}
                    onPress={() => openPay(d)}
                  >
                    <MaterialCommunityIcons name="cash-plus" size={15} color={colors.white} />
                    <Text style={styles.payBtnText}>Bayar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.ghostBtn} onPress={() => openEdit(d)}>
                  <MaterialCommunityIcons name="pencil-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.ghostBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => handleDelete(d)}>
                  <MaterialCommunityIcons name="trash-can-outline" size={15} color={colors.danger} />
                  <Text style={[styles.ghostBtnText, { color: colors.danger }]}>Hapus</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal transparent animationType="fade" visible={!!payingId} onRequestClose={() => setPayingId(null)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, styles.sheetBackdrop]}
            activeOpacity={1}
            onPress={() => setPayingId(null)}
          />
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Catat pembayaran</Text>
            {payingDebt && (
              <Text style={styles.sheetSub}>
                {KIND_LABEL[payingDebt.kind]} ke {payingDebt.counterparty} · sisa{' '}
                {formatRupiah(remaining(payingDebt))}
              </Text>
            )}

            <Text style={styles.label}>Jumlah</Text>
            <View style={styles.amountInput}>
              <Text style={styles.amountPrefix}>Rp</Text>
              <TextInput
                style={styles.amountField}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={payAmount}
                onChangeText={setPayAmount}
              />
            </View>

            <Text style={styles.label}>Catatan (opsional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Angsuran ke-2"
              placeholderTextColor={colors.textMuted}
              value={payNote}
              onChangeText={setPayNote}
            />

            <Text style={styles.hint}>
              Pembayaran otomatis membuat transaksi{' '}
              {payingDebt?.kind === 'payable' ? 'pengeluaran' : 'pemasukan'} dan mengurangi saldo.
            </Text>

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPayingId(null)}>
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, paying && { opacity: 0.7 }]}
                onPress={handlePay}
                disabled={paying}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="check" size={18} color={colors.white} />
                <Text style={styles.saveBtnText}>{paying ? 'Menyimpan...' : 'Catat'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

    summaryRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 6,
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: '700',
    },

    filterRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    filterBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    filterBtnActive: {
      backgroundColor: colors.cardDark,
      borderColor: colors.cardDark,
    },
    filterText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    filterTextActive: {
      color: colors.white,
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

    kindRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    kindBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    kindBtnActive: {
      backgroundColor: colors.cardDark,
      borderColor: colors.cardDark,
    },
    kindText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    kindTextActive: {
      color: colors.white,
    },
    kindSub: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 1,
    },
    kindSubActive: {
      color: colors.textMuted,
    },

    label: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
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

    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
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
    hint: {
      fontSize: 11,
      color: colors.textMuted,
      lineHeight: 16,
      marginBottom: 16,
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
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
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

    formActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
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

    emptyBox: {
      alignItems: 'center',
      paddingVertical: 50,
      paddingHorizontal: 20,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 15,
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

    card: {
      backgroundColor: colors.surface,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 15,
      marginBottom: 12,
    },
    cardPaid: {
      opacity: 0.75,
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
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardInfo: {
      flex: 1,
    },
    cardCounter: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardDesc: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    cardSisa: {
      fontSize: 14,
      fontWeight: '700',
    },
    cardOfTotal: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
    },

    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.background,
      marginTop: 13,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },

    cardMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      gap: 8,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      flexWrap: 'wrap',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    statusOpen: {
      backgroundColor: 'rgba(249,115,22,0.12)',
    },
    statusPaid: {
      backgroundColor: 'rgba(22,163,74,0.12)',
    },
    statusText: {
      fontSize: 10,
      fontWeight: '700',
    },
    dueBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    dueOverdue: {
      backgroundColor: 'rgba(239,68,68,0.12)',
    },
    dueSoon: {
      backgroundColor: 'rgba(249,115,22,0.12)',
    },
    dueText: {
      fontSize: 10,
      fontWeight: '600',
    },
    historyLink: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },

    historyBox: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    historyEmpty: {
      fontSize: 11,
      color: colors.textMuted,
    },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    historyNote: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    historyDate: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 1,
    },
    historyAmount: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    cardActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 13,
    },
    payBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: 13,
      backgroundColor: colors.primary,
    },
    payBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.white,
    },
    ghostBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    ghostBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },

    sheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    sheetBackdrop: {
      backgroundColor: 'transparent',
    },
    sheetCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
    },
    sheetTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sheetSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      marginBottom: 16,
    },
  });
