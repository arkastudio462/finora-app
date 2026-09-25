import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Animated,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFinance, Transaction } from '@/context/FinanceContext';
import { formatRupiah, formatDate, getPaymentMethodLabel } from '@/utils/format';
import { getCategoryIcon } from '@/utils/icons';
import { COLORS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { loadData, KEYS } from '@/utils/storage';
import DonutChart, { CHART_COLORS } from '@/components/DonutChart';
import AnimatedEntrance from '@/components/AnimatedEntrance';
import { LoadingBlock, ErrorBlock } from '@/components/DataState';
import { useMonthlyTrend } from '@/hooks/useMonthlyTrend';
import { useNotifications } from '@/hooks/useNotifications';
import AttachmentThumb from '@/components/AttachmentThumb';
import { useTabBarPadding } from '@/hooks/useTabBarPadding';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const SWIPE_THRESHOLD = -80;

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function DateWheelPicker({ value, onChange, maximumDate }: { value: Date; onChange: (d: Date) => void; maximumDate: Date }) {
  const styles = useStyles(createStyles);
  const maxYear = maximumDate.getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => maxYear - 29 + i);
  const months = MONTHS_ID;
  const [selectedYear, setSelectedYear] = useState(value.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(value.getMonth());
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const [selectedDay, setSelectedDay] = useState(Math.min(value.getDate(), daysInMonth));

  useEffect(() => {
    const maxDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    if (selectedDay > maxDays) setSelectedDay(maxDays);
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    const d = new Date(selectedYear, selectedMonth, selectedDay);
    if (d <= maximumDate) onChange(d);
  }, [selectedYear, selectedMonth, selectedDay]);

  const WheelColumn = ({ items, selected, onSelect, width }: { items: (string | number)[]; selected: number; onSelect: (i: number) => void; width: number }) => (
    <ScrollView style={{ width }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
      {items.map((item, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onSelect(i)}
          style={[styles.wheelItem, i === selected && styles.wheelItemActive]}
        >
          <Text style={[styles.wheelText, i === selected && styles.wheelTextActive]}>
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.wheelContainer}>
      <WheelColumn items={years} selected={years.indexOf(selectedYear)} onSelect={(i) => setSelectedYear(years[i])} width={80} />
      <WheelColumn items={months} selected={selectedMonth} onSelect={setSelectedMonth} width={70} />
      <WheelColumn
        items={Array.from({ length: daysInMonth }, (_, i) => i + 1)}
        selected={selectedDay - 1}
        onSelect={(i) => setSelectedDay(i + 1)}
        width={60}
      />
    </View>
  );
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'daily', label: 'Harian' },
  { key: 'weekly', label: 'Mingguan' },
  { key: 'monthly', label: 'Bulanan' },
  { key: 'yearly', label: 'Tahunan' },
  { key: 'custom', label: 'Custom' },
];

function filterByPeriod(transactions: Transaction[], period: Period, customStart?: Date, customEnd?: Date): Transaction[] {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'custom' && customStart && customEnd) {
    const endOfDay = new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate(), 23, 59, 59);
    return transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= customStart && d <= endOfDay;
    });
  }

  return transactions.filter((t) => {
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime())) return false;

    const startOfNextDay = new Date(startOfDay);
    startOfNextDay.setDate(startOfNextDay.getDate() + 1);

    switch (period) {
      case 'daily':
        return d >= startOfDay && d < startOfNextDay;
      case 'weekly': {
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfWeek.getDate() - now.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        return d >= startOfWeek && d < endOfWeek;
      }
      case 'monthly': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return d >= startOfMonth && d < endOfMonth;
      }
      case 'yearly': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
        return d >= startOfYear && d < endOfYear;
      }
      default:
        return true;
    }
  });
}

function getPeriodLabel(period: Period, customStart?: Date, customEnd?: Date): string {
  const now = new Date();
  if (period === 'custom') {
    if (!customStart || !customEnd) return 'Custom';
    const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(customStart)} - ${fmt(customEnd)}`;
  }
  switch (period) {
    case 'daily':
      return now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    case 'weekly':
      return 'Minggu ini';
    case 'monthly':
      return now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    case 'yearly':
      return String(now.getFullYear());
  }
}

function BalanceCard({ transactions }: { transactions: Transaction[] }) {
  const styles = useStyles(createStyles);
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  return (
    <View style={styles.balanceCard}>
      <View style={styles.balanceHeader}>
        <View>
          <Text style={styles.balanceLabel}>Total balance</Text>
          <Text style={styles.balanceAmount}>{formatRupiah(balance)}</Text>
        </View>
      </View>

      <View style={styles.balanceGrid}>
        <View style={styles.balanceBox}>
          <View style={styles.balanceBoxHeader}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
              <MaterialCommunityIcons name="arrow-down-left" size={16} color="#22c55e" />
            </View>
            <Text style={styles.balanceBoxLabel}>Income</Text>
          </View>
          <Text style={styles.balanceBoxAmount}>{formatRupiah(income)}</Text>
        </View>

        <View style={styles.balanceBox}>
          <View style={styles.balanceBoxHeader}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
              <MaterialCommunityIcons name="arrow-up-right" size={16} color="#f97316" />
            </View>
            <Text style={styles.balanceBoxLabel}>Expense</Text>
          </View>
          <Text style={styles.balanceBoxAmount}>{formatRupiah(expense)}</Text>
        </View>
      </View>
    </View>
  );
}

function SpendingChart({
  transactions,
  periodLabel,
  activePeriod,
  onPeriodPress,
}: {
  transactions: Transaction[];
  periodLabel: string;
  activePeriod: Period;
  onPeriodPress: (p: Period) => void;
}) {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const [showMenu, setShowMenu] = useState(false);
  const spending: Record<string, number> = {};
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      spending[t.category] = (spending[t.category] || 0) + t.amount;
    });
  const categories = Object.keys(spending);
  const total = Object.values(spending).reduce((a, b) => a + b, 0);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Spending by category</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowMenu(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="tune-variant" size={14} color={colors.textSecondary} />
          <Text style={styles.filterButtonText}>{periodLabel}</Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {showMenu && (
        <Modal transparent animationType="fade" visible={showMenu}>
          <View style={styles.menuOverlay}>
            <TouchableOpacity
              style={[StyleSheet.absoluteFill, styles.menuBackdrop]}
              activeOpacity={1}
              onPress={() => setShowMenu(false)}
            />
            <View style={styles.menuDropdown}>
              {PERIODS.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.menuItem, activePeriod === p.key && styles.menuItemActive]}
                  onPress={() => {
                    onPeriodPress(p.key);
                    setShowMenu(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.menuItemText, activePeriod === p.key && styles.menuItemTextActive]}>
                    {p.label}
                  </Text>
                  {activePeriod === p.key && (
                    <MaterialCommunityIcons name="check" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      )}

      <View style={styles.chartCard}>
        {categories.length === 0 ? (
          <Text style={styles.emptyText}>No expense data yet</Text>
        ) : (
          <View style={styles.chartRow}>
            <DonutChart data={spending} size={150} strokeWidth={20} />
            <View style={styles.legendColumn}>
              {categories.map((cat, i) => {
                const pct = total > 0 ? Math.round((spending[cat] / total) * 100) : 0;
                return (
                  <View key={cat} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} />
                    <Text style={styles.legendLabel}>{cat}</Text>
                    <Text style={styles.legendPct}>{pct}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function MonthlySummary({ transactions }: { transactions: Transaction[] }) {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const router = useRouter();
  const { data: trend } = useMonthlyTrend(6, transactions.length);
  const maxTrend = Math.max(1, ...trend.map((p) => Math.max(p.income, p.expense)));

  return (
    <View style={styles.section}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryContent}>
          <Text style={styles.summaryLabel}>PERIOD OVERVIEW</Text>
          <Text style={styles.summaryTitle}>You're doing{'\n'}great.</Text>
          <Text style={styles.summaryDesc}>Your spending is lower than last month.</Text>
          <TouchableOpacity
            style={styles.summaryButton}
            onPress={() => router.push('/(tabs)/budget')}
          >
            <Text style={styles.summaryButtonText}>View report →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.trendBox}>
          <View style={styles.trendBars}>
            {trend.map((point) => (
              <View key={point.key} style={styles.trendGroup}>
                <View style={styles.trendPair}>
                  <View
                    style={[
                      styles.trendBar,
                      {
                        height: Math.max(4, (point.income / maxTrend) * 70),
                        backgroundColor: '#22c55e',
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.trendBar,
                      {
                        height: Math.max(4, (point.expense / maxTrend) * 70),
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.trendLabel} numberOfLines={1}>
                  {point.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.trendLegend}>
            <View style={styles.trendLegendItem}>
              <View style={[styles.trendLegendDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.trendLegendText}>Masuk</Text>
            </View>
            <View style={styles.trendLegendItem}>
              <View style={[styles.trendLegendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.trendLegendText}>Keluar</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function SwipeableTransactionItem({ transaction, onEdit, onDelete, onOpen }: {
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
          <MaterialCommunityIcons name="pencil" size={18} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.swipeDeleteBtn} onPress={onDelete}>
          <MaterialCommunityIcons name="delete" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.transactionItem, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.transactionBody}
          activeOpacity={0.9}
          onPress={onOpen}
          disabled={!onOpen}
        >
        <View style={[styles.transactionIcon, { backgroundColor: transaction.type === 'income' ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)' }]}>
          <MaterialCommunityIcons name={icon as any} size={19} color={color} />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDesc}>{transaction.description}</Text>
          <Text style={styles.transactionMeta}>{transaction.category} · {getPaymentMethodLabel(transaction.payment_method)} · {formatDate(transaction.date)}</Text>
        </View>
        {transaction.image_path ? (
          <View style={styles.transactionThumb}>
            <AttachmentThumb path={transaction.image_path} />
          </View>
        ) : null}
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color }]}>{sign} {formatRupiah(transaction.amount)}</Text>
        </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  const styles = useStyles(createStyles);
  const { deleteTransaction } = useFinance();
  const recent = transactions.slice(0, 5);
  const router = useRouter();

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
      { text: 'Delete', style: 'destructive', onPress: () => deleteTransaction(id) },
    ]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent transactions</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
          <Text style={styles.sectionLink}>See all ›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.transactionList}>
        {recent.length === 0 ? (
          <Text style={styles.emptyText}>No transactions in this period.</Text>
        ) : (
          recent.map((t) => (
            <SwipeableTransactionItem
              key={t.id}
              transaction={t}
              onEdit={() => handleEdit(t)}
              onDelete={() => handleDelete(t.id)}
              onOpen={() => handleOpen(t)}
            />
          ))
        )}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const insets = useSafeAreaInsets();
  const bottomPadding = useTabBarPadding();
  const { user } = useAuth();
  const { state, reload } = useFinance();
  const { unread } = useNotifications();
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [activePeriod, setActivePeriod] = useState<Period>('monthly');
  const [customStart, setCustomStart] = useState<Date>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d;
  });
  const [customEnd, setCustomEnd] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickingStart, setPickingStart] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await loadData<string>(KEYS.user);
      if (saved) {
        setUserName(saved);
      } else {
        setUserName(user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there');
      }
    })();
  }, [user]);

  const filteredTransactions = useMemo(
    () => filterByPeriod(state.transactions, activePeriod, customStart, customEnd),
    [state.transactions, activePeriod, customStart, customEnd],
  );

  const periodLabel = getPeriodLabel(activePeriod, customStart, customEnd);

  const handlePeriodPress = (period: Period) => {
    if (period === 'custom') {
      setPickingStart(true);
      setShowDatePicker(true);
    }
    setActivePeriod(period);
  };

  const handleDateChange = useCallback((date: Date) => {
    if (pickingStart) {
      setCustomStart(date);
    } else {
      setCustomEnd(date);
    }
  }, [pickingStart]);


  if (state.loadError) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 24, alignItems: 'center', justifyContent: 'center' },
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
          { paddingTop: insets.top + 24, alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <LoadingBlock />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 24 }]}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>PERSONAL FINANCE</Text>
          <Text style={styles.headerTitle}>Hello, {userName}! 👋</Text>
          <Text style={styles.headerSubtitle}>Manage your money with ease.</Text>
        </View>
        <TouchableOpacity
          style={styles.notifButton}
          activeOpacity={0.7}
          onPress={() => router.push('/(modals)/notifications')}
        >
          <MaterialCommunityIcons name="bell" size={19} color={colors.textPrimary} />
          {unread && <View style={styles.notifDot} />}
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <Modal transparent animationType="fade">
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerModal}>
              <Text style={styles.datePickerTitle}>
                {pickingStart ? 'Pilih tanggal mulai' : 'Pilih tanggal akhir'}
              </Text>
              <DateWheelPicker
                value={pickingStart ? customStart : customEnd}
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
              <View style={styles.datePickerActions}>
                <TouchableOpacity
                  style={styles.datePickerCancel}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.datePickerCancelText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.datePickerConfirm}
                  onPress={() => {
                    if (pickingStart) {
                      setPickingStart(false);
                    } else {
                      setShowDatePicker(false);
                    }
                  }}
                >
                  <Text style={styles.datePickerConfirmText}>
                    {pickingStart ? 'Selanjutnya' : 'Terapkan'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <AnimatedEntrance delay={0}>
        <BalanceCard transactions={filteredTransactions} />
      </AnimatedEntrance>
      <AnimatedEntrance delay={100}>
        <SpendingChart
          transactions={filteredTransactions}
          periodLabel={periodLabel}
          activePeriod={activePeriod}
          onPeriodPress={handlePeriodPress}
        />
      </AnimatedEntrance>
      <AnimatedEntrance delay={200}>
        <MonthlySummary transactions={filteredTransactions} />
      </AnimatedEntrance>
      <AnimatedEntrance delay={300}>
        <RecentTransactions transactions={filteredTransactions} />
      </AnimatedEntrance>
    </ScrollView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerEyebrow: {
    fontSize: 11,
    letterSpacing: 2.2,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 31,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },

  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuBackdrop: {
    zIndex: 0,
  },
  menuDropdown: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 6,
    width: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemActive: {
    backgroundColor: colors.cardLight,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  menuItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  balanceCard: {
    backgroundColor: colors.cardDark,
    borderRadius: 26,
    padding: 24,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.5,
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  balanceBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 14,
  },
  balanceBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceBoxLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  balanceBoxAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },

  section: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },

  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 25,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  legendColumn: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: '#4b5563',
    flex: 1,
  },
  legendPct: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  summaryCard: {
    backgroundColor: colors.cardLight,
    borderRadius: 25,
    padding: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryContent: {
    flex: 1,
    maxWidth: '60%',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.6,
    color: colors.textMuted,
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
    color: colors.textPrimary,
  },
  summaryDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 12,
    lineHeight: 18,
  },
  summaryButton: {
    marginTop: 16,
    backgroundColor: colors.cardDark,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  summaryButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
  },

  transactionList: {
    gap: 12,
  },
  transactionBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transactionItem: {
    backgroundColor: colors.surface,
    borderRadius: 21,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 1,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
    marginTop: 4,
  },
  transactionAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  swipeContainer: {
    marginBottom: 4,
  },
  swipeActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  swipeEditBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeDeleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionThumb: {
    marginLeft: 8,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 6,
  },

  trendBox: {
    flex: 1,
    maxWidth: '44%',
    marginLeft: 14,
    justifyContent: 'flex-end',
  },
  trendBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  trendGroup: {
    flex: 1,
    alignItems: 'center',
  },
  trendPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 74,
  },
  trendBar: {
    width: 5,
    borderRadius: 3,
  },
  trendLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 5,
  },
  trendLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 9,
    marginTop: 9,
  },
  trendLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trendLegendText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
  },

  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModal: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    width: '85%',
    alignItems: 'center',
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  datePickerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  datePickerCancel: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  datePickerCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  datePickerConfirm: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  datePickerConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  wheelContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    height: 200,
  },
  wheelItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  wheelItemActive: {
    backgroundColor: colors.primary,
  },
  wheelText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  wheelTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
});
