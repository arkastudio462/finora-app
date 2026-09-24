import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFinance, Transaction } from '@/context/FinanceContext';
import { formatRupiah, formatDate } from '@/utils/format';
import { getCategoryIcon } from '@/utils/icons';
import { COLORS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DonutChart, { CHART_COLORS } from '@/components/DonutChart';
import AnimatedEntrance from '@/components/AnimatedEntrance';
import { useTabBarPadding } from '@/hooks/useTabBarPadding';

function BalanceCard() {
  const { state } = useFinance();
  const balance = state.income - state.expense;

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
          <Text style={styles.balanceBoxAmount}>{formatRupiah(state.income)}</Text>
        </View>

        <View style={styles.balanceBox}>
          <View style={styles.balanceBoxHeader}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
              <MaterialCommunityIcons name="arrow-up-right" size={16} color="#f97316" />
            </View>
            <Text style={styles.balanceBoxLabel}>Expense</Text>
          </View>
          <Text style={styles.balanceBoxAmount}>{formatRupiah(state.expense)}</Text>
        </View>
      </View>
    </View>
  );
}

function QuickActions() {
  const router = useRouter();

  const actions = [
    { label: 'Add income', icon: 'plus', bg: COLORS.primary, color: COLORS.white, route: '/(modals)/add-transaction' as const },
    { label: 'Add expense', icon: 'arrow-up-right', bg: COLORS.white, color: COLORS.textPrimary, route: '/(modals)/add-transaction' as const },
    { label: 'Transfer', icon: 'arrow-left-right', bg: COLORS.white, color: COLORS.textPrimary, route: '/(modals)/add-transaction' as const },
    { label: 'More', icon: 'grid-2x2', bg: COLORS.white, color: COLORS.textPrimary, route: null },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.quickActionsGrid}>
        {actions.map((action, i) => (
          <TouchableOpacity
            key={i}
            style={styles.quickActionItem}
            onPress={() => action.route && router.push(action.route)}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: action.bg, borderWidth: action.bg === COLORS.white ? 1 : 0, borderColor: COLORS.border }]}>
              <MaterialCommunityIcons name={action.icon as any} size={24} color={action.color} />
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function SpendingChart() {
  const { getSpendingByCategory } = useFinance();
  const spending = getSpendingByCategory();
  const categories = Object.keys(spending);
  const total = Object.values(spending).reduce((a, b) => a + b, 0);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Spending by category</Text>
        <TouchableOpacity>
          <Text style={styles.sectionLink}>This month</Text>
        </TouchableOpacity>
      </View>
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

function MonthlySummary() {
  const router = useRouter();
  const { getSpendingByCategory } = useFinance();
  const spending = getSpendingByCategory();
  const categories = Object.keys(spending);
  const values = Object.values(spending);
  const maxVal = Math.max(...values, 1);

  return (
    <View style={styles.section}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryContent}>
          <Text style={styles.summaryLabel}>THIS MONTH</Text>
          <Text style={styles.summaryTitle}>You're doing{'\n'}great.</Text>
          <Text style={styles.summaryDesc}>Your spending is lower than last month.</Text>
          <TouchableOpacity
            style={styles.summaryButton}
            onPress={() => router.push('/(tabs)/budget')}
          >
            <Text style={styles.summaryButtonText}>View report →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.miniBarChart}>
          {categories.slice(0, 4).map((cat, i) => {
            const height = (spending[cat] / maxVal) * 70 + 10;
            return (
              <View key={cat} style={styles.miniBarWrapper}>
                <View
                  style={[
                    styles.miniBar,
                    {
                      height,
                      backgroundColor:
                        i === 0 ? COLORS.primary : i === 1 ? '#fb923c' : i === 2 ? '#fdba74' : '#fed7aa',
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function TransactionItem({ transaction, onEdit, onDelete }: {
  transaction: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = transaction.type === 'income' ? '#22c55e' : '#f97316';
  const sign = transaction.type === 'income' ? '+' : '-';
  const icon = getCategoryIcon(transaction.category);

  return (
    <View style={styles.transactionItem}>
      <View style={[styles.transactionIcon, { backgroundColor: transaction.type === 'income' ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)' }]}>
        <MaterialCommunityIcons name={icon as any} size={19} color={color} />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionDesc}>{transaction.description}</Text>
        <Text style={styles.transactionMeta}>{transaction.category} · {formatDate(transaction.date)}</Text>
      </View>
      <View style={styles.transactionRight}>
        <Text style={[styles.transactionAmount, { color }]}>{sign} {formatRupiah(transaction.amount)}</Text>
        <View style={styles.transactionBtns}>
          <TouchableOpacity style={styles.homeEditBtn} onPress={onEdit}>
            <MaterialCommunityIcons name="pencil" size={12} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeDeleteBtn} onPress={onDelete}>
            <MaterialCommunityIcons name="trash-2" size={12} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function RecentTransactions() {
  const { state, deleteTransaction } = useFinance();
  const recent = state.transactions.slice(0, 5);
  const router = useRouter();
  const bottomPadding = useTabBarPadding();

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

  const handleDelete = (id: string) => {
    Alert.alert('Delete Transaction', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTransaction(id) },
    ]);
  };

  return (
    <View style={[styles.section, { marginBottom: bottomPadding }]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent transactions</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
          <Text style={styles.sectionLink}>See all ›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.transactionList}>
        {recent.map((t) => (
          <TransactionItem
            key={t.id}
            transaction={t}
            onEdit={() => handleEdit(t)}
            onDelete={() => handleDelete(t.id)}
          />
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const bottomPadding = useTabBarPadding();

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>PERSONAL FINANCE</Text>
          <Text style={styles.headerTitle}>Hello, Tega! 👋</Text>
          <Text style={styles.headerSubtitle}>Manage your money with ease.</Text>
        </View>
        <TouchableOpacity style={styles.notifButton}>
          <MaterialCommunityIcons name="bell" size={19} color={COLORS.textPrimary} />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </View>

      <AnimatedEntrance delay={0}>
        <BalanceCard />
      </AnimatedEntrance>
      <AnimatedEntrance delay={80}>
        <QuickActions />
      </AnimatedEntrance>
      <AnimatedEntrance delay={160}>
        <SpendingChart />
      </AnimatedEntrance>
      <AnimatedEntrance delay={240}>
        <MonthlySummary />
      </AnimatedEntrance>
      <AnimatedEntrance delay={320}>
        <RecentTransactions />
      </AnimatedEntrance>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  headerEyebrow: {
    fontSize: 11,
    letterSpacing: 2.2,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 31,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notifDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  balanceCard: {
    backgroundColor: COLORS.cardDark,
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
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.white,
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
    color: COLORS.textMuted,
  },
  balanceBoxAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
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
    color: COLORS.textPrimary,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },

  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    alignItems: 'center',
    width: '23%',
  },
  quickActionIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
    color: COLORS.textPrimary,
  },

  chartCard: {
    backgroundColor: COLORS.white,
    borderRadius: 25,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
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
    color: COLORS.textPrimary,
  },

  summaryCard: {
    backgroundColor: COLORS.cardLight,
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
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
    color: COLORS.textPrimary,
  },
  summaryDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 12,
    lineHeight: 18,
  },
  summaryButton: {
    marginTop: 16,
    backgroundColor: COLORS.cardDark,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  summaryButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.white,
  },

  transactionList: {
    gap: 12,
  },
  transactionItem: {
    backgroundColor: COLORS.white,
    borderRadius: 21,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.textPrimary,
  },
  transactionMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  transactionAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  transactionBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  homeEditBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(107,114,128,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.1)',
  },
  homeDeleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(239,68,68,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.1)',
  },

  miniBarChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    marginTop: 8,
  },
  miniBarWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  miniBar: {
    width: 28,
    borderRadius: 8,
  },
});
