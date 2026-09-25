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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFinance, PaymentMethod } from '@/context/FinanceContext';
import { useToast } from '@/components/Toast';
import { useCustomCategories, MAX_CATEGORY_LENGTH } from '@/hooks/useCustomCategories';
import { useAuth } from '@/hooks/useAuth';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';
import PhotoPicker from '@/components/PhotoPicker';
import { RECEIPTS_BUCKET, uploadImageFile, removeImageFile } from '@/lib/images';
import { COLORS, CATEGORIES } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';
import { useAlert } from '@/components/AppAlert';

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: 'cash', label: 'Tunai', icon: 'cash' },
  { key: 'non_cash', label: 'Nontunai', icon: 'credit-card-outline' },
];

export default function AddTransactionModal() {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const { addTransaction, updateTransaction, state } = useFinance();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { categories: customCategories, addCategory } = useCustomCategories();
  const router = useRouter();
  const alert = useAlert();
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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
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
        setImagePath(tx.image_path ?? null);
        setPhotoUri(null);
        setImageRemoved(false);
      }
    }
  }, [params.editId]);

  const savedPhotoUrl = useSignedImageUrl(
    RECEIPTS_BUCKET,
    imagePath && !photoUri && !imageRemoved ? imagePath : null
  );
  const previewPhotoUri = photoUri || savedPhotoUrl;

  const categoryOptions = Array.from(
    new Set([...CATEGORIES, ...customCategories, ...(category ? [category] : [])])
  );

  const handleAddCategory = async () => {
    const error = await addCategory(newCategory);
    if (error) {
      alert.error(error, 'Kategori');
      return;
    }
    setCategory(newCategory.trim());
    setNewCategory('');
    setShowNewCategory(false);
    showToast('Kategori ditambahkan', 'success');
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      alert.error('Please enter a valid amount');
      return;
    }
    if (!description.trim()) {
      alert.error('Please enter a description');
      return;
    }

    const known = CATEGORIES.some((c) => c === category) || customCategories.includes(category);
    if (!known) await addCategory(category);

    let finalImagePath = imageRemoved ? null : imagePath;

    if (photoUri) {
      if (!user) {
        alert.error('Anda belum login');
        return;
      }
      showToast('Mengupload foto...', 'info');
      const uploaded = await uploadImageFile(RECEIPTS_BUCKET, photoUri, user.id);
      if ('error' in uploaded) {
        alert.error(uploaded.error, 'Gagal upload foto');
        return;
      }
      finalImagePath = uploaded.path;
    }

    let error: string | null = null;

    if (isEdit && params.editId) {
      const existing = state.transactions.find((t) => t.id === params.editId);
      if (!existing) {
        alert.error('Transaction not found');
        return;
      }
      error = await updateTransaction({
        ...existing,
        type,
        description: description.trim(),
        category,
        amount: Number(amount),
        payment_method: paymentMethod,
        image_path: finalImagePath,
      });
    } else {
      error = await addTransaction({
        type,
        description: description.trim(),
        category,
        amount: Number(amount),
        payment_method: paymentMethod,
        image_path: finalImagePath,
      });
    }

    if (error) {
      alert.error(error, 'Gagal menyimpan');
      return;
    }

    if (imagePath && finalImagePath !== imagePath) {
      removeImageFile(RECEIPTS_BUCKET, imagePath);
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
            <MaterialCommunityIcons name="close" size={22} color={colors.textPrimary} />
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
              color={type === 'expense' ? colors.white : colors.textSecondary}
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
              color={type === 'income' ? colors.white : colors.textSecondary}
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
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Groceries"
          placeholderTextColor={colors.textMuted}
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
                color={category === cat ? colors.white : colors.textMuted}
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
              color={colors.primary}
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
              placeholderTextColor={colors.textMuted}
              value={newCategory}
              onChangeText={(v) => setNewCategory(v.slice(0, MAX_CATEGORY_LENGTH + 10))}
              maxLength={MAX_CATEGORY_LENGTH + 10}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddCategory}
            />
            <TouchableOpacity style={styles.newCategoryConfirm} onPress={handleAddCategory}>
              <MaterialCommunityIcons name="check" size={18} color={colors.white} />
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
                  color={active ? colors.white : colors.textSecondary}
                />
                <Text style={[styles.paymentBtnText, active && styles.paymentBtnTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Photo (optional)</Text>
        <PhotoPicker
          uri={previewPhotoUri}
          onPick={(uri) => {
            setPhotoUri(uri);
            setImageRemoved(false);
          }}
          onRemove={() => {
            setPhotoUri(null);
            setImageRemoved(true);
          }}
          onError={(message) => alert.error(message, 'Foto')}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <MaterialCommunityIcons name="check" size={20} color={colors.white} />
          <Text style={styles.saveBtnText}>{isEdit ? 'Update transaction' : 'Save transaction'}</Text>
        </TouchableOpacity>
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
    marginBottom: 24,
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  amountPrefix: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMuted,
  },
  amountField: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 13,
    color: colors.textPrimary,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: colors.cardDark,
    borderColor: colors.cardDark,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: colors.white,
  },
  addCategoryChip: {
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.cardLight,
  },
  addCategoryText: {
    color: colors.primary,
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
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: colors.textPrimary,
  },
  newCategoryConfirm: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primary,
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
    backgroundColor: colors.surface,
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

  saveBtn: {
    backgroundColor: colors.primary,
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
    color: colors.white,
  },
});
