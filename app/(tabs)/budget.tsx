import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFinance } from '@/context/FinanceContext';
import { useToast } from '@/components/Toast';
import { formatRupiah } from '@/utils/format';
import { getCategoryIcon } from '@/utils/icons';
import { COLORS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarPadding } from '@/hooks/useTabBarPadding';

function BudgetOverview() {
  const { state, getBudgetSpent } = useFinance();
  const totalBudget = state.budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = state.budgets.reduce((sum, b) => sum + getBudgetSpent(b.category), 0);
  const pct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  return (
    <View style={styles.overviewCard}>
      <Text style={styles.overviewLabel}>Total Budget</Text>
      <Text style={styles.overviewAmount}>{formatRupiah(totalBudget)}</Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.overviewFooter}>
        <Text style={styles.overviewStatus}>{Math.round(pct)}% used</Text>
        <Text style={styles.overviewSpent}>{formatRupiah(totalSpent)} spent</Text>
      </View>
    </View>
  );
}

const SWIPE_THRESHOLD = -80;

function SwipeableBudgetItem({ budget, onEdit, onDelete }: {
  budget: { id: string; category: string; amount: number };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { getBudgetSpent } = useFinance();
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

  const spent = getBudgetSpent(budget.category);
  const pct = Math.min((spent / budget.amount) * 100, 100);
  const remaining = budget.amount - spent;
  const isOver = spent > budget.amount;
  const icon = getCategoryIcon(budget.category);

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeActions}>
        <TouchableOpacity style={styles.swipeEditBtn} onPress={onEdit}>
          <MaterialCommunityIcons name="pencil" size={18} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.swipeDeleteBtn} onPress={onDelete}>
          <MaterialCommunityIcons name="delete" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.budgetItem, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.budgetItemHeader}>
          <View style={styles.budgetItemLeft}>
            <View style={styles.budgetItemIcon}>
              <MaterialCommunityIcons name={icon as any} size={16} color={COLORS.primaryDark} />
            </View>
            <View>
              <Text style={styles.budgetItemCategory}>{budget.category}</Text>
              <Text style={styles.budgetItemLimit}>Limit: {formatRupiah(budget.amount)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.budgetProgressBar}>
          <View
            style={[
              styles.budgetProgressFill,
              {
                width: `${pct}%`,
                backgroundColor: isOver ? COLORS.danger : pct > 75 ? '#f59e0b' : COLORS.primary,
              },
            ]}
          />
        </View>

        <View style={styles.budgetItemFooter}>
          <Text style={[styles.budgetSpent, isOver && { color: COLORS.danger, fontWeight: '700' }]}>
            {formatRupiah(spent)} used
          </Text>
          <Text style={styles.budgetRemaining}>
            {isOver ? `${formatRupiah(Math.abs(remaining))} over` : `${formatRupiah(remaining)} left`}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function BudgetScreen() {
  const { state, deleteBudget } = useFinance();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomPadding = useTabBarPadding();

  const handleEdit = (budget: { id: string; category: string; amount: number }) => {
    router.push({
      pathname: '/(modals)/add-budget',
      params: {
        editId: budget.id,
        category: budget.category,
        amount: String(budget.amount),
      },
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Budget?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBudget(id);
          showToast('Budget deleted', 'info');
        },
      },
    ]);
  };

  return (
      <ScrollView style={[styles.container, { paddingTop: insets.top + 16 }]} contentContainerStyle={{ paddingBottom: bottomPadding }} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Budget</Text>
          <Text style={styles.headerCount}>{state.budgets.length} budget{state.budgets.length !== 1 ? 's' : ''} set</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(modals)/add-budget')}>
          <MaterialCommunityIcons name="plus" size={18} color={COLORS.white} />
          <Text style={styles.addBtnText}>Add budget</Text>
        </TouchableOpacity>
      </View>

      <BudgetOverview />

      {state.budgets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="wallet" size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>No budget set</Text>
          <Text style={styles.emptyDesc}>Add a budget to track your spending limits.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(modals)/add-budget')}>
            <Text style={styles.emptyBtnText}>+ Add your first budget</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.budgetList}>
          {state.budgets.map((b) => (
            <SwipeableBudgetItem
              key={b.id}
              budget={b}
              onEdit={() => handleEdit(b)}
              onDelete={() => handleDelete(b.id)}
            />
          ))}
        </View>
      )}
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
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerCount: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },

  overviewCard: {
    backgroundColor: COLORS.cardDark,
    borderRadius: 25,
    padding: 20,
    marginBottom: 20,
  },
  overviewLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  overviewAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
    marginTop: 4,
  },
  progressBar: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  overviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  overviewStatus: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  overviewSpent: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  budgetList: {
    gap: 8,
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
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeDeleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },

  budgetItem: {
    backgroundColor: COLORS.white,
    borderRadius: 21,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 1,
  },
  budgetItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  budgetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  budgetItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetItemCategory: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  budgetItemLimit: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  budgetItemActions: {
    flexDirection: 'row',
    gap: 4,
  },
  smallActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(107,114,128,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetProgressBar: {
    backgroundColor: COLORS.border,
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
  },
  budgetProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  budgetSpent: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  budgetRemaining: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
});
