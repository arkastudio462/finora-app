import React, { useState, useMemo, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFinance, Transaction } from '@/context/FinanceContext';
import { useToast } from '@/components/Toast';
import { formatRupiah, formatDate, getPaymentMethodLabel } from '@/utils/format';
import { getCategoryIcon } from '@/utils/icons';
import { COLORS, CATEGORIES } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarPadding } from '@/hooks/useTabBarPadding';

const FILTER_CHIPS = ['All', 'Income', 'Expense', ...CATEGORIES.slice(0, 5)] as const;
const SWIPE_THRESHOLD = -80;

function SwipeableTransactionItem({ transaction, onEdit, onDelete }: {
  transaction: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}) {
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
          <MaterialCommunityIcons name="pencil" size={18} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.swipeDeleteBtn} onPress={onDelete}>
          <MaterialCommunityIcons name="delete" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.transactionItem, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.transactionIcon, { backgroundColor: transaction.type === 'income' ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)' }]}>
          <MaterialCommunityIcons name={icon as any} size={19} color={color} />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDesc}>{transaction.description}</Text>
          <Text style={styles.transactionMeta}>{transaction.category} · {getPaymentMethodLabel(transaction.payment_method)} · {formatDate(transaction.date)}</Text>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color }]}>{sign} {formatRupiah(transaction.amount)}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function TransactionsScreen() {
  const { state, deleteTransaction } = useFinance();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomPadding = useTabBarPadding();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered = useMemo(() => {
    let result = [...state.transactions];

    if (activeFilter !== 'All') {
      if (activeFilter === 'Income' || activeFilter === 'Expense') {
        result = result.filter((t) => t.type === activeFilter.toLowerCase());
      } else {
        result = result.filter((t) => t.category === activeFilter);
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          formatRupiah(t.amount).toLowerCase().includes(q)
      );
    }

    return result;
  }, [state.transactions, activeFilter, search]);

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

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
        <Text style={styles.headerCount}>{state.transactions.length} total</Text>
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search transaction..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.chipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {FILTER_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip}
              style={[styles.chip, activeFilter === chip && styles.chipActive]}
              onPress={() => setActiveFilter(chip)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, activeFilter === chip && styles.chipTextActive]}>
                {chip}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={{ paddingBottom: bottomPadding }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="receipt" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No transactions found.</Text>
          </View>
        ) : (
          <View style={styles.transactionList}>
            {filtered.map((t) => (
              <SwipeableTransactionItem
                key={t.id}
                transaction={t}
                onEdit={() => handleEdit(t)}
                onDelete={() => handleDelete(t.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
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
    alignItems: 'baseline',
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
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  chipsContainer: {
    marginBottom: 16,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  listContainer: {
    flex: 1,
  },
  transactionList: {
    gap: 8,
    paddingBottom: 20,
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

  transactionItem: {
    backgroundColor: COLORS.white,
    borderRadius: 21,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.textPrimary,
  },
  transactionMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  transactionAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  transactionBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(107,114,128,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.1)',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.1)',
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
});
