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
import { useFinance } from '@/context/FinanceContext';
import { useToast } from '@/components/Toast';
import { COLORS, BUDGET_CATEGORIES } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddBudgetModal() {
  const { addBudget, updateBudget, state } = useFinance();
  const { showToast } = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{
    editId?: string;
    category?: string;
    amount?: string;
  }>();
  const insets = useSafeAreaInsets();

  const isEdit = !!params.editId;

  const [category, setCategory] = useState<string>(params.category || BUDGET_CATEGORIES[0]);
  const [amount, setAmount] = useState(params.amount || '');

  useEffect(() => {
    if (params.editId) {
      const budget = state.budgets.find((b) => b.id === params.editId);
      if (budget) {
        setCategory(budget.category);
        setAmount(String(budget.amount));
      }
    }
  }, [params.editId]);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid budget limit');
      return;
    }

    if (isEdit && params.editId) {
      await updateBudget({
        id: params.editId,
        category,
        amount: Number(amount),
      });
    } else {
      const error = await addBudget(category, Number(amount));
      if (error) {
        Alert.alert('Error', error);
        return;
      }
    }

    showToast(isEdit ? 'Budget updated' : 'Budget added', 'success');
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
            <Text style={styles.eyebrow}>BUDGET</Text>
            <Text style={styles.title}>{isEdit ? 'Edit budget' : 'Add budget'}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="close" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {BUDGET_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
              onPress={() => setCategory(cat)}
              disabled={isEdit}
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
        </View>

        <Text style={styles.label}>Budget limit</Text>
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

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <MaterialCommunityIcons name="check" size={20} color={COLORS.white} />
          <Text style={styles.saveBtnText}>{isEdit ? 'Update budget' : 'Save budget'}</Text>
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

  label: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
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
  categoryChipDisabled: {
    opacity: 0.6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  categoryTextActive: {
    color: COLORS.white,
  },

  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    marginBottom: 24,
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
