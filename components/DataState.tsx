import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';

export function LoadingBlock({ label = 'Memuat data...' }: { label?: string }) {
  const colors = useColors();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.block}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const colors = useColors();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.block}>
      <MaterialCommunityIcons name="cloud-off-outline" size={40} color={colors.textMuted} />
      <Text style={styles.title}>Gagal memuat data</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <MaterialCommunityIcons name="refresh" size={16} color={colors.white} />
          <Text style={styles.retryText}>Coba lagi</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  block: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 4,
  },
  message: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
});
