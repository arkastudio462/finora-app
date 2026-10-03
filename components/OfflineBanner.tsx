import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors, useStyles } from '@/context/ThemeContext';
import { useFinance } from '@/context/FinanceContext';
import type { Colors } from '@/constants/theme';

export function OfflineBanner() {
  const { state, syncNow } = useFinance();
  const colors = useColors();
  const styles = useStyles(createStyles);

  const pending = state.pendingCount;
  const offline = state.stale;
  const failed = !!state.syncError;

  if (!offline && !failed && pending === 0) return null;

  const title = failed
    ? 'Sinkronisasi tertunda'
    : offline
      ? 'Mode offline'
      : 'Menunggu sinkronisasi';

  const parts: string[] = [];
  if (offline) parts.push('Data ditampilkan dari penyimpanan lokal.');
  if (pending > 0) parts.push(`${pending} perubahan menunggu dikirim.`);
  if (failed && state.syncError) parts.push(state.syncError);

  const icon = failed
    ? 'alert-circle-outline'
    : offline
      ? 'cloud-off-outline'
      : 'cloud-sync-outline';

  const accent = failed ? colors.danger : colors.primary;

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <MaterialCommunityIcons name={icon as any} size={18} color={accent} />

      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{parts.join(' ')}</Text>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Coba sinkronkan sekarang"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => void syncNow()}
      >
        <Text style={[styles.action, { color: colors.primary }]}>Coba lagi</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 6,
    },
    texts: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 13,
      fontWeight: '700',
    },
    body: {
      fontSize: 12,
      lineHeight: 16,
    },
    action: {
      fontSize: 12,
      fontWeight: '700',
    },
  });
