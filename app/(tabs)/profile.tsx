import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { pickImage, uploadImageFile, AVATARS_BUCKET } from '@/lib/images';
import { useToast } from '@/components/Toast';
import { formatRupiah } from '@/utils/format';
import { COLORS } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadData, saveData, KEYS } from '@/utils/storage';
import { useTabBarPadding } from '@/hooks/useTabBarPadding';

export default function ProfileScreen() {
  const { state } = useFinance();
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const bottomPadding = useTabBarPadding();

  const defaultName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const [userName, setUserName] = useState(defaultName);
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user?.user_metadata?.avatar_url || null
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user?.user_metadata?.avatar_url) {
      setAvatarUrl(user.user_metadata.avatar_url);
    }
  }, [user?.id]);

  const handleChangeAvatar = async () => {
    if (uploadingAvatar) return;
    if (!user) {
      showToast('Anda belum login', 'error');
      return;
    }

    const picked = await pickImage('library');
    if (picked.error) {
      showToast(picked.error, 'error');
      return;
    }
    if (!picked.uri) return;

    setUploadingAvatar(true);
    try {
      const uploaded = await uploadImageFile(AVATARS_BUCKET, picked.uri, user.id, 'avatar');
      if ('error' in uploaded) {
        showToast(`Gagal upload: ${uploaded.error}`, 'error');
        return;
      }

      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(uploaded.path);
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (error) {
        showToast(`Gagal menyimpan avatar: ${error.message}`, 'error');
        return;
      }

      setAvatarUrl(publicUrl);
      showToast('Foto profil diperbarui', 'success');
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    (async () => {
      const saved = await loadData<string>(KEYS.user);
      if (saved) {
        setUserName(saved);
        setTempName(saved);
      }
    })();
  }, []);

  const handleSaveName = async () => {
    const trimmed = tempName.trim();
    if (!trimmed) {
      showToast('Name cannot be empty', 'error');
      return;
    }
    setUserName(trimmed);
    setIsEditing(false);
    await saveData(KEYS.user, trimmed);
    showToast('Name updated', 'success');
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await signOut();
          if (error) {
            showToast('Failed to sign out', 'error');
          }
        },
      },
    ]);
  };

  const stats = [
    { icon: 'receipt-text', label: 'Total Transactions', value: String(state.transactions.length), color: COLORS.textPrimary },
    { icon: 'arrow-down-left', label: 'Total Income', value: formatRupiah(state.income), color: '#16a34a' },
    { icon: 'arrow-up-right', label: 'Total Expense', value: formatRupiah(state.expense), color: COLORS.primaryDark },
    { icon: 'wallet', label: 'Budgets Set', value: String(state.budgets.length), color: COLORS.textPrimary },
  ];

  const balance = state.income - state.expense;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <TouchableOpacity
          style={styles.avatar}
          activeOpacity={0.85}
          onPress={handleChangeAvatar}
          disabled={uploadingAvatar}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <Text style={styles.avatarText}>{(userName || '?').charAt(0).toUpperCase()}</Text>
          )}
          <View style={styles.avatarBadge}>
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <MaterialCommunityIcons name="camera-plus" size={14} color={COLORS.white} />
            )}
          </View>
        </TouchableOpacity>

        {isEditing ? (
          <View style={styles.editNameRow}>
            <TextInput
              style={styles.nameInput}
              value={tempName}
              onChangeText={setTempName}
              autoFocus
              placeholder="Your name"
              placeholderTextColor={COLORS.textMuted}
            />
            <TouchableOpacity style={styles.saveNameBtn} onPress={handleSaveName}>
              <MaterialCommunityIcons name="check" size={18} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelNameBtn}
              onPress={() => {
                setIsEditing(false);
                setTempName(userName);
              }}
            >
              <MaterialCommunityIcons name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.nameRow} onPress={() => { setTempName(userName); setIsEditing(true); }}>
            <Text style={styles.name}>{userName}</Text>
            <MaterialCommunityIcons name="pencil" size={14} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}

        <Text style={styles.role}>{user?.email || 'Personal Finance User'}</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Net Worth</Text>
        <Text style={[styles.balanceAmount, { color: balance >= 0 ? '#16a34a' : COLORS.danger }]}>
          {formatRupiah(balance)}
        </Text>
        <Text style={styles.balanceSub}>
          {balance >= 0 ? 'You are in positive balance' : 'Your expenses exceed income'}
        </Text>
      </View>

      <View style={styles.statsCard}>
        {stats.map((stat, i) => (
          <View key={i} style={[styles.statItem, i < stats.length - 1 && styles.statBorder]}>
            <View style={styles.statLeft}>
              <View style={styles.statIcon}>
                <MaterialCommunityIcons name={stat.icon as any} size={16} color={COLORS.primaryDark} />
              </View>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>About Finora</Text>
        <Text style={styles.aboutDesc}>
          Personal finance tracker to manage your income, expenses, and budgets.
        </Text>
        <View style={styles.aboutMeta}>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          <Text style={styles.aboutDot}>·</Text>
          <Text style={styles.aboutPlatform}>Expo SDK 57</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <MaterialCommunityIcons name="logout" size={18} color={COLORS.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 120,
    textAlign: 'center',
  },
  saveNameBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelNameBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  role: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 6,
  },

  balanceCard: {
    backgroundColor: COLORS.cardDark,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  balanceAmount: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 6,
  },
  balanceSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  statsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
  },

  aboutSection: {
    backgroundColor: COLORS.white,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    alignItems: 'center',
  },
  aboutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  aboutDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  aboutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  aboutVersion: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  aboutDot: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  aboutPlatform: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    marginTop: 16,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
  },
});
