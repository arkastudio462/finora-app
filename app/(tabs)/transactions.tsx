import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  PanResponder,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFinance, Transaction } from '@/context/FinanceContext';
import { useToast } from '@/components/Toast';
import { formatRupiah, getPaymentMethodLabel } from '@/utils/format';
import { getCategoryIcon } from '@/utils/icons';
import { CATEGORIES } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarPadding } from '@/hooks/useTabBarPadding';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { shareTransactionsCsv } from '@/utils/exportCsv';
import AttachmentThumb from '@/components/AttachmentThumb';
import { LoadingBlock, ErrorBlock } from '@/components/DataState';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';

const PAYMENT_FILTERS = [
  { key: 'all', label: 'Semua metode' },
  { key: 'cash', label: 'Tunai' },
  { key: 'non_cash', label: 'Nontunai' },
] as const;

type PaymentFilter = (typeof PAYMENT_FILTERS)[number]['key'];

const TYPE_TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'income', label: 'Masuk' },
  { key: 'expense', label: 'Keluar' },
] as const;

type TypeFilter = (typeof TYPE_TABS)[number]['key'];

const SWIPE_THRESHOLD = -80;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((now.getTime() - target.getTime()) / 86400000);

  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin';

  return target.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: target.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}.${pad2(d.getMinutes())}`;
}

function SwipeableTransactionItem({
  transaction,
  onEdit,
  onDelete,
  onOpen,
}: {
  transaction: Transaction;
  onEdit: () => void;
  onDelete: () => void;
  onOpen?: () => void;
}) {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderGrant: () => {
        translateX.setOffset(lastOffset.current);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const newVal = Math.min(0, gestureState.dx);
        translateX.setValue(newVal);
      },
      onPanResponderRelease: (_, gestureState) => {
        translateX.flattenOffset();
        if (gestureState.dx < SWIPE_THRESHOLD) {
          Animated.spring(translateX, { toValue: -90, useNativeDriver: true }).start();
          lastOffset.current = -90;
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          lastOffset.current = 0;
        }
      },
    })
  ).current;

  const color = transaction.type === 'income' ? '#22c55e' : '#f97316';
  const sign = transaction.type === 'income' ? '+' : '-';
  const icon = getCategoryIcon(transaction.category);

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeActions}>
        <TouchableOpacity style={styles.swipeEditBtn} onPress={onEdit}>
          <MaterialCommunityIcons name="pencil" size={17} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.swipeDeleteBtn} onPress={onDelete}>
          <MaterialCommunityIcons name="delete" size={17} color={colors.white} />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.transactionItem, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.transactionBody}
          activeOpacity={0.85}
          onPress={onOpen}
          disabled={!onOpen}
        >
          <View
            style={[
              styles.transactionIcon,
              {
                backgroundColor:
                  transaction.type === 'income' ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
              },
            ]}
          >
            <MaterialCommunityIcons name={icon as any} size={17} color={color} />
          </View>

          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDesc} numberOfLines={1}>
              {transaction.description}
            </Text>
            <Text style={styles.transactionMeta} numberOfLines={1}>
              {transaction.category} · {getPaymentMethodLabel(transaction.payment_method)} ·{' '}
              {timeLabel(transaction.date)}
            </Text>
          </View>

          {transaction.image_path ? (
            <View style={styles.transactionThumb}>
              <AttachmentThumb path={transaction.image_path} />
            </View>
          ) : null}

          <View style={styles.transactionRight}>
            <Text style={[styles.transactionAmount, { color }]}>
              {sign} {formatRupiah(transaction.amount)}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default function TransactionsScreen() {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const { state, deleteTransaction, reload, loadMoreTransactions, getAllTransactions } = useFinance();
  const { showToast } = useToast();
  const { categories: customCategories } = useCustomCategories();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomPadding = useTabBarPadding();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [activePayment, setActivePayment] = useState<PaymentFilter>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [exporting, setExporting] = useState(false);

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([...CATEGORIES, ...customCategories, ...state.transactions.map((t) => t.category)])
      ),
    [state.transactions, customCategories]
  );

  const matchesFilters = useCallback(
    (t: Transaction) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (activePayment !== 'all' && t.payment_method !== activePayment) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const hit =
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          formatRupiah(t.amount).toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    },
    [typeFilter, categoryFilter, activePayment, search]
  );

  const filtered = useMemo(
    () => state.transactions.filter(matchesFilters),
    [state.transactions, matchesFilters]
  );

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Transaction[]>();

    for (const t of filtered) {
      const key = localDayKey(new Date(t.date));
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(t);
    }

    return order.map((key) => {
      const items = map.get(key)!;
      let inc = 0;
      let exp = 0;
      for (const it of items) {
        if (it.type === 'income') inc += it.amount;
        else exp += it.amount;
      }
      return { key, label: dayLabel(key), items, inc, exp };
    });
  }, [filtered]);

  const hasExtraFilter = categoryFilter !== null || activePayment !== 'all';
  const monthLabel = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const monthNet = state.monthIncome - state.monthExpense;

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await getAllTransactions();
      if ('error' in result) {
        showToast(result.error, 'error');
        return;
      }

      const rows = result.rows.filter(matchesFilters);
      if (rows.length === 0) {
        showToast('Tidak ada transaksi untuk diexport', 'info');
        return;
      }

      const error = await shareTransactionsCsv(rows);
      if (error) showToast(`Export gagal: ${error}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    router.push({
      pathname: '/(modals)/add-transaction',
      params: {
        editId: transaction.id,
        type: transaction.type,
        amount: String(transaction.amount),
        description: transaction.description,
        category: transaction.category,
      },
    });
  };

  const handleOpen = (t: Transaction) => {
    router.push({ pathname: '/(modals)/transaction-detail', params: { id: t.id } });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Transaction', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(id);
          showToast('Transaction deleted', 'info');
        },
      },
    ]);
  };

  const resetFilter = () => {
    setCategoryFilter(null);
    setActivePayment('all');
  };

  if (state.loadError) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 16, alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <ErrorBlock message={state.loadError} onRetry={() => reload()} />
      </View>
    );
  }

  if (!state.isLoaded) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 16, alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <LoadingBlock />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Transactions</Text>
          <Text style={styles.headerSub}>{state.totalTransactions} total transaksi</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
            activeOpacity={0.8}
            disabled={exporting}
            onPress={handleExport}
          >
            <MaterialCommunityIcons
              name={exporting ? 'loading' : 'file-export-outline'}
              size={15}
              color={colors.primary}
            />
            <Text style={styles.exportText}>{exporting ? 'Export...' : 'Export'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHead}>
          <Text style={styles.summaryTitle}>Bulan ini</Text>
          <Text style={styles.summaryPeriod}>{monthLabel}</Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <View style={[styles.summaryIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
              <MaterialCommunityIcons name="arrow-down-left" size={15} color="#16a34a" />
            </View>
            <View>
              <Text style={styles.summaryLabel}>Masuk</Text>
              <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
                {formatRupiah(state.monthIncome)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryBox}>
            <View style={[styles.summaryIcon, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
              <MaterialCommunityIcons name="arrow-up-right" size={15} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.summaryLabel}>Keluar</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>
                {formatRupiah(state.monthExpense)}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.summaryNet}>
          Selisih{' '}
          <Text style={{ color: monthNet >= 0 ? '#16a34a' : colors.primary, fontWeight: '700' }}>
            {monthNet >= 0 ? '+' : '-'}
            {formatRupiah(Math.abs(monthNet))}
          </Text>
        </Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari transaksi..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.filterBtn, (showFilter || hasExtraFilter) && styles.filterBtnActive]}
          activeOpacity={0.8}
          onPress={() => setShowFilter(true)}
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={18}
            color={hasExtraFilter ? colors.white : colors.textSecondary}
          />
          {hasExtraFilter && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      <View style={styles.tabsRow}>
        {TYPE_TABS.map((tab) => {
          const active = typeFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.7}
              onPress={() => setTypeFilter(tab.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.quickBtn}
          activeOpacity={0.7}
          onPress={() => router.push('/(modals)/recurring')}
        >
          <View style={styles.quickIcon}>
            <MaterialCommunityIcons name="repeat-variant" size={15} color={colors.primary} />
          </View>
          <View style={styles.quickInfo}>
            <Text style={styles.quickTitle}>Transaksi berulang</Text>
            <Text style={styles.quickSub}>
              {state.recurring.length > 0
                ? `${state.recurring.filter((r) => r.active).length} aktif`
                : 'Belum ada aturan'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtn}
          activeOpacity={0.7}
          onPress={() => router.push('/(modals)/debts')}
        >
          <View style={styles.quickIcon}>
            <MaterialCommunityIcons name="hand-coin-outline" size={15} color={colors.primary} />
          </View>
          <View style={styles.quickInfo}>
            <Text style={styles.quickTitle}>Hutang & Tagihan</Text>
            <Text style={styles.quickSub}>
              {state.debts.filter((d) => d.status === 'open').length > 0
                ? `${state.debts.filter((d) => d.status === 'open').length} belum lunas`
                : state.debts.length > 0
                ? 'Semua lunas'
                : 'Belum ada data'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {groups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="receipt" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Tidak ada transaksi</Text>
            <Text style={styles.emptyText}>
              {hasExtraFilter || search || typeFilter !== 'all'
                ? 'Coba ubah kata kunci atau filter kamu.'
                : 'Mulai catat pemasukan atau pengeluaran.'}
            </Text>
          </View>
        ) : (
          <View style={styles.transactionList}>
            {groups.map((group) => (
              <View key={group.key}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{group.label}</Text>
                  <View style={styles.sectionTotals}>
                    {group.inc > 0 && (
                      <Text style={styles.sectionInc}>+{formatRupiah(group.inc)}</Text>
                    )}
                    {group.exp > 0 && (
                      <Text style={styles.sectionExp}>-{formatRupiah(group.exp)}</Text>
                    )}
                  </View>
                </View>

                {group.items.map((t) => (
                  <SwipeableTransactionItem
                    key={t.id}
                    transaction={t}
                    onEdit={() => handleEdit(t)}
                    onDelete={() => handleDelete(t.id)}
                    onOpen={() => handleOpen(t)}
                  />
                ))}
              </View>
            ))}
          </View>
        )}

        {state.transactions.length < state.totalTransactions && (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            activeOpacity={0.8}
            disabled={state.isLoadingMore}
            onPress={async () => {
              const err = await loadMoreTransactions();
              if (err) showToast(err, 'error');
            }}
          >
            <Text style={styles.loadMoreText}>
              {state.isLoadingMore
                ? 'Memuat...'
                : `Muat lebih banyak (${state.totalTransactions - state.transactions.length} tersisa)`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        transparent
        visible={showFilter}
        animationType="fade"
        onRequestClose={() => setShowFilter(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, styles.sheetBackdrop]}
            activeOpacity={1}
            onPress={() => setShowFilter(false)}
          />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Filter transaksi</Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setShowFilter(false)}
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetLabel}>Kategori</Text>
            <View style={styles.chipWrap}>
              <TouchableOpacity
                style={[styles.chip, categoryFilter === null && styles.chipActive]}
                onPress={() => setCategoryFilter(null)}
              >
                <Text style={[styles.chipText, categoryFilter === null && styles.chipTextActive]}>
                  Semua
                </Text>
              </TouchableOpacity>
              {categoryOptions.map((cat) => {
                const active = categoryFilter === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategoryFilter(active ? null : cat)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>Metode bayar</Text>
            <View style={styles.chipWrap}>
              {PAYMENT_FILTERS.map((f) => {
                const active = activePayment === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setActivePayment(f.key)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.resetBtn} onPress={resetFilter}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyBtn}
                activeOpacity={0.85}
                onPress={() => setShowFilter(false)}
              >
                <Text style={styles.applyText}>Terapkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 20,
    },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerSub: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 3,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(249,115,22,0.4)',
      backgroundColor: colors.cardLight,
    },
    exportBtnDisabled: {
      opacity: 0.6,
    },
    exportText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },

    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 14,
    },
    summaryHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    summaryTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    summaryPeriod: {
      fontSize: 11,
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    summaryBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    summaryDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: colors.border,
    },
    summaryIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: 10,
      color: colors.textMuted,
      marginBottom: 2,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '700',
    },
    summaryNet: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    searchRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 10,
      fontSize: 13,
      color: colors.textPrimary,
    },
    filterBtn: {
      width: 46,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterDot: {
      position: 'absolute',
      top: 9,
      right: 11,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.white,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },

    tabsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: colors.cardDark,
      borderColor: colors.cardDark,
    },
    tabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.white,
    },

    quickRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    quickBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    quickIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.cardLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickInfo: {
      flex: 1,
      minWidth: 0,
    },
    quickTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    quickSub: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
    },

    listContainer: {
      flex: 1,
    },
    transactionList: {
      gap: 6,
      paddingBottom: 20,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    sectionTotals: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionInc: {
      fontSize: 11,
      fontWeight: '700',
      color: '#16a34a',
    },
    sectionExp: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },

    swipeContainer: {
      marginBottom: 6,
    },
    swipeActions: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingRight: 4,
    },
    swipeEditBtn: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    swipeDeleteBtn: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: colors.danger,
      justifyContent: 'center',
      alignItems: 'center',
    },

    transactionItem: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 13,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 1,
    },
    transactionBody: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    transactionIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
    },
    transactionInfo: {
      flex: 1,
      minWidth: 0,
    },
    transactionDesc: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    transactionMeta: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 3,
    },
    transactionThumb: {
      marginLeft: 6,
    },
    transactionRight: {
      alignItems: 'flex-end',
    },
    transactionAmount: {
      fontSize: 13,
      fontWeight: '700',
    },

    loadMoreBtn: {
      marginTop: 14,
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    loadMoreText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },

    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 56,
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
      paddingHorizontal: 30,
      lineHeight: 18,
    },

    sheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheetBackdrop: {
      backgroundColor: 'transparent',
    },
    sheetCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      paddingBottom: 30,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sheetLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 10,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 18,
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
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.white,
    },
    sheetActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    resetBtn: {
      flex: 1,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resetText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    applyBtn: {
      flex: 1.4,
      borderRadius: 15,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.white,
    },
  });
