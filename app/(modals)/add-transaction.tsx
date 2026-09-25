import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFinance, PaymentMethod } from '@/context/FinanceContext';
import { useToast } from '@/components/Toast';
import { useCustomCategories, MAX_CATEGORY_LENGTH } from '@/hooks/useCustomCategories';
import { COLORS, CATEGORIES } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: 'cash', label: 'Tunai', icon: 'cash' },
  { key: 'non_cash', label: 'Nontunai', icon: 'credit-card-outline' },
];

export default function AddTransactionModal() {
  const { addTransaction, updateTransaction, state } = useFinance();
  const { showToast } = useToast();
  const { categories: customCategories, addCategory } = useCustomCategories();
  const router = useRouter();
  const params = useLocalSearchParams<{
    editId?: string;
    type?: string;
    amount?: string;
    description?: string;
    category?: string;
  }>();
  const insets = useSafeAreaInsets();

  const isEdit = !!params.editId;

  const [type, setType] = useState<'income' | 'expense'>(
    (params.type as 'income' | 'expense') || 'expense'
  );
  const [amount, setAmount] = useState(params.amount || '');
  const [description, setDescription] = useState(params.description || '');
  const [category, setCategory] = useState(params.category || CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    if (params.editId) {
      const tx = state.transactions.find((t) => t.id === params.editId);
      if (tx) {
        setType(tx.type);
        setAmount(String(tx.amount));
        setDescription(tx.description);
        setCategory(tx.category);
        setPaymentMethod(tx.payment_method === 'non_cash' ? 'non_cash' : 'cash');
      }
    }
  }, [params.editId]);

  const categoryOptions = Array.from(
    new Set([...CATEGORIES, ...customCategories, ...(category ? [category] : [])])
  );

  const handleAddCategory = async () => {
    const error = await addCategory(newCategory);
    if (error) {
      Alert.alert('Kategori', error);
      return;
    }
    setCategory(newCategory.trim());
    setNewCategory('');
    setShowNewCategory(false);
    showToast('Kategori ditambahkan', 'success');
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    const known = CATEGORIES.some((c) => c === category) || customCategories.includes(category);
    if (!known) await addCategory(category);

    let error: string | null = null;

    if (isEdit && params.editId) {
      const existing = state.transactions.find((t) => t.id === params.editId);
      if (!existing) {
        Alert.alert('Error', 'Transaction not found');
        return;
      }
      error = await updateTransaction({
        ...existing,
        type,
        description: description.trim(),
        category,
        amount: Number(amount),
        payment_method: paymentMethod,
      });
    } else {
      error = await addTransaction({
        type,
        description: description.trim(),
        category,
        amount: Number(amount),
        payment_method: paymentMethod,
      });
    }

    if (error) {
      Alert.alert('Gagal menyimpan', error);
      return;
    }

    showToast(isEdit ? 'Transaction updated' : 'Transaction added', 'success');
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{isEdit ? 'EDIT TRANSACTION' : 'NEW TRANSACTION'}</Text>
            <Text style={styles.title}>{isEdit ? `Edit ${type}` : `Add ${type}`}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="close" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'expense' && styles.typeBtnActive]}
            onPress={() => setType('expense')}
          >
            <MaterialCommunityIcons
              name="arrow-up-right"
              size={18}
              color={type === 'expense' ? COLORS.white : COLORS.textSecondary}
            />
            <Text style={[styles.typeBtnText, type === 'expense' && styles.typeBtnTextActive]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'income' && styles.typeBtnActiveIncome]}
            onPress={() => setType('income')}
          >
            <MaterialCommunityIcons
              name="arrow-down-left"
              size={18}
              color={type === 'income' ? COLORS.white : COLORS.textSecondary}
            />
            <Text style={[styles.typeBtnText, type === 'income' && styles.typeBtnTextActive]}>Income</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Amount</Text>
        <View style={styles.amountInput}>
          <Text style={styles.amountPrefix}>Rp</Text>
          <TextInput
            style={styles.amountField}
            placeholder="0"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Groceries"
          placeholderTextColor={COLORS.textMuted}
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {categoryOptions.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
              onPress={() => {
                setCategory(cat);
                setShowNewCategory(false);
              }}
            >
              <MaterialCommunityIcons
                name={category === cat ? 'check-circle' : 'circle-outline'}
                size={14}
                color={category === cat ? COLORS.white : COLORS.textMuted}
              />
              <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.categoryChip, styles.addCategoryChip]}
            onPress={() => setShowNewCategory((v) => !v)}
          >
            <MaterialCommunityIcons
              name={showNewCategory ? 'close' : 'plus'}
              size={14}
              color={COLORS.primary}
            />
            <Text style={[styles.categoryText, styles.addCategoryText]}>
              {showNewCategory ? 'Batal' : 'Kategori baru'}
            </Text>
          </TouchableOpacity>
        </View>

        {showNewCategory && (
          <View style={styles.newCategoryRow}>
            <TextInput
              style={styles.newCategoryInput}
              placeholder="Nama kategori custom"
              placeholderTextColor={COLORS.textMuted}
              value={newCategory}
              onChangeText={(v) => setNewCategory(v.slice(0, MAX_CATEGORY_LENGTH + 10))}
              maxLength={MAX_CATEGORY_LENGTH + 10}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddCategory}
            />
            <TouchableOpacity style={styles.newCategoryConfirm} onPress={handleAddCategory}>
              <MaterialCommunityIcons name="check" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>Payment method</Text>
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
                  color={active ? COLORS.white : COLORS.textSecondary}
                />
                <Text style={[styles.paymentBtnText, active && styles.paymentBtnTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <MaterialCommunityIcons name="check" size={20} color={COLORS.white} />
          <Text style={styles.saveBtnText}>{isEdit ? 'Update transaction' : 'Save transaction'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  typeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  typeBtnActive: {
    backgroundColor: COLORS.cardDark,
    borderColor: COLORS.cardDark,
  },
  typeBtnActiveIncome: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  typeBtnTextActive: {
    color: COLORS.white,
  },

  label: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  amountPrefix: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  amountField: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  textInput: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 20,
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
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: COLORS.cardDark,
    borderColor: COLORS.cardDark,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  categoryTextActive: {
    color: COLORS.white,
  },
  addCategoryChip: {
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: COLORS.cardLight,
  },
  addCategoryText: {
    color: COLORS.primary,
  },
  newCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -12,
    marginBottom: 20,
  },
  newCategoryInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  newCategoryConfirm: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  paymentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  paymentBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  paymentBtnActive: {
    backgroundColor: COLORS.cardDark,
    borderColor: COLORS.cardDark,
  },
  paymentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  paymentBtnTextActive: {
    color: COLORS.white,
  },

  saveBtn: {
    backgroundColor: COLORS.primary,
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
    color: COLORS.white,
  },
});
