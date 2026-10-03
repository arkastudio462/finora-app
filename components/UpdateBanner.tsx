import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors, useStyles } from '@/context/ThemeContext';
import { useToast } from '@/components/Toast';
import { useUpdateNotifier, type UpdateNotice } from '@/hooks/useUpdateNotifier';
import type { Colors } from '@/constants/theme';

const META = {
  'ota:ready': {
    icon: 'refresh',
    title: 'Update siap dipasang',
    body: 'Versi terbaru sudah diunduh. Ketuk untuk memuat ulang aplikasi.',
    action: 'Perbarui sekarang',
  },
  'ota:available': {
    icon: 'cloud-download-outline',
    title: 'Update tersedia',
    body: 'Finora memiliki versi baru. Ketuk untuk mengunduh dan memperbarui.',
    action: 'Unduh & perbarui',
  },
  apk: {
    icon: 'cellphone-arrow-down',
    title: 'Update aplikasi tersedia',
    body: 'Versi baru sudah dirilis. Ketuk untuk mengunduh APK terbaru.',
    action: 'Unduh APK',
  },
} as const;

export function UpdateBanner() {
  const { notice, dismiss, apply, busy, justUpdated } = useUpdateNotifier();
  const colors = useColors();
  const styles = useStyles(createStyles);
  const { showToast } = useToast();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const [lastNotice, setLastNotice] = useState<UpdateNotice | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!notice) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -16, duration: 180, useNativeDriver: true }),
      ]).start(() => setRendered(false));
      return;
    }

    setLastNotice(notice);
    setRendered(true);
    opacity.setValue(0);
    translateY.setValue(-16);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 160, useNativeDriver: true }),
    ]).start();
  }, [notice, opacity, translateY]);

  useEffect(() => {
    if (justUpdated) showToast('Aplikasi berhasil diperbarui', 'success');
  }, [justUpdated, showToast]);

  if (!notice && !rendered) return null;

  const current = notice ?? lastNotice;
  const meta =
    current?.kind === 'apk' ? META.apk : current?.ready ? META['ota:ready'] : META['ota:available'];
  const title = current?.kind === 'apk' && current.version ? `Update aplikasi v${current.version}` : meta.title;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { opacity, transform: [{ translateY }] }]}
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name={meta.icon as any} size={20} color={colors.primary} />
          </View>

          <View style={styles.texts}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{meta.body}</Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Tutup pemberitahuan update"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={dismiss}
          >
            <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          disabled={busy}
          style={styles.button}
          onPress={() => void apply()}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>{meta.action}</Text>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: {},
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
      elevation: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.cardLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    texts: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    body: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textSecondary,
    },
    button: {
      marginTop: 12,
      height: 42,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.white,
    },
  });
