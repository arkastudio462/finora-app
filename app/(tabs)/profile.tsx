import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  ActivityIndicator,
  Linking,
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

const THEME_OPTIONS: { key: ThemeMode; label: string; icon: string }[] = [
  { key: 'light', label: 'Terang', icon: 'white-balance-sunny' },
  { key: 'dark', label: 'Gelap', icon: 'weather-night' },
  { key: 'system', label: 'Sistem', icon: 'cellphone-cog' },
];
import { loadData, saveData, KEYS } from '@/utils/storage';
import { useTabBarPadding } from '@/hooks/useTabBarPadding';
import { useColors, useStyles, useTheme, ThemeMode } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';
import { useAlert } from '@/components/AppAlert';

export default function ProfileScreen() {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const { mode, setMode } = useTheme();
  const { state } = useFinance();
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const alert = useAlert();
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
    alert.confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      onConfirm: async () => {
        const { error } = await signOut();
        if (error) {
          showToast('Failed to sign out', 'error');
        }
      },
    });
  };

  const handleSupport = async () => {
    const url = 'https://trakteer.id/mmirzafahlefi/tip?open=true';
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        showToast('Gagal membuka halaman dukungan', 'error');
        return;
      }
      await Linking.openURL(url);
    } catch {
      showToast('Gagal membuka halaman dukungan', 'error');
    }
  };

  const stats = [
    { icon: 'receipt-text', label: 'Total Transactions', value: String(state.transactions.length), color: colors.textPrimary },
    { icon: 'arrow-down-left', label: 'Total Income', value: formatRupiah(state.income), color: '#16a34a' },
    { icon: 'arrow-up-right', label: 'Total Expense', value: formatRupiah(state.expense), color: colors.primaryDark },
    { icon: 'wallet', label: 'Budgets Set', value: String(state.budgets.length), color: colors.textPrimary },
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
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <MaterialCommunityIcons name="camera-plus" size={14} color={colors.white} />
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
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity style={styles.saveNameBtn} onPress={handleSaveName}>
              <MaterialCommunityIcons name="check" size={18} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelNameBtn}
              onPress={() => {
                setIsEditing(false);
                setTempName(userName);
              }}
            >
              <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.nameRow} onPress={() => { setTempName(userName); setIsEditing(true); }}>
            <Text style={styles.name}>{userName}</Text>
            <MaterialCommunityIcons name="pencil" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        <Text style={styles.role}>{user?.email || 'Personal Finance User'}</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Net Worth</Text>
        <Text style={[styles.balanceAmount, { color: balance >= 0 ? '#16a34a' : colors.danger }]}>
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
                <MaterialCommunityIcons name={stat.icon as any} size={16} color={colors.primaryDark} />
              </View>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.themeCard}>
        <View style={styles.themeHeader}>
          <MaterialCommunityIcons name="theme-light-dark" size={16} color={colors.primary} />
          <Text style={styles.themeTitle}>Tampilan</Text>
        </View>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((opt) => {
            const active = mode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.themeBtn, active && styles.themeBtnActive]}
                activeOpacity={0.7}
                onPress={() => setMode(opt.key)}
              >
                <MaterialCommunityIcons
                  name={opt.icon as any}
                  size={15}
                  color={active ? colors.white : colors.textSecondary}
                />
                <Text style={[styles.themeBtnText, active && styles.themeBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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

      <TouchableOpacity style={styles.supportBtn} activeOpacity={0.8} onPress={handleSupport}>
        <View style={styles.supportIconWrap}>
          <MaterialCommunityIcons name="hand-heart-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.supportInfo}>
          <Text style={styles.supportTitle}>Dukung developer</Text>
          <Text style={styles.supportSub}>
            Traktir kopi lewat Trakteer untuk mengembangkan Finora
          </Text>
        </View>
        <MaterialCommunityIcons name="open-in-new" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <MaterialCommunityIcons name="logout" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 120,
    textAlign: 'center',
  },
  saveNameBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelNameBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  role: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
  },

  balanceCard: {
    backgroundColor: colors.cardDark,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  balanceAmount: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 6,
  },
  balanceSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },

  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderBottomColor: colors.border,
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
    color: colors.textPrimary,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
  },

  themeCard: {
    backgroundColor: colors.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  themeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  themeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  themeBtnTextActive: {
    color: colors.white,
  },

  aboutSection: {
    backgroundColor: colors.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
  },
  aboutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  aboutDesc: {
    fontSize: 12,
    color: colors.textSecondary,
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
    color: colors.textMuted,
  },
  aboutDot: {
    fontSize: 11,
    color: colors.textMuted,
  },
  aboutPlatform: {
    fontSize: 11,
    color: colors.textMuted,
  },

  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
  },
  supportIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(249,115,22,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportInfo: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  supportSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    marginTop: 16,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
});
