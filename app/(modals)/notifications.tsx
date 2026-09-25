import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications, NotificationTone } from '@/hooks/useNotifications';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';

function toneText(colors: Colors, tone: NotificationTone): string {
  if (tone === 'danger') return colors.danger;
  if (tone === 'warning') return colors.primary;
  return colors.textSecondary;
}

function toneBg(colors: Colors, tone: NotificationTone): string {
  if (tone === 'danger') return 'rgba(239,68,68,0.12)';
  if (tone === 'warning') return colors.cardLight;
  return colors.background;
}

export default function NotificationsModal() {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, markSeen } = useNotifications();

  useEffect(() => {
    markSeen();
  }, [markSeen]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>NOTIFICATIONS</Text>
            <Text style={styles.title}>Notifikasi</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="bell-check-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Tidak ada notifikasi</Text>
            <Text style={styles.emptyText}>
              Pengingat transaksi berulang, limit budget, dan arus kas bulan ini akan muncul di sini.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.count}>{items.length} pengingat aktif</Text>
            {items.map((item) => (
              <View key={item.id} style={styles.card}>
                <View
                  style={[
                    styles.cardIcon,
                    { backgroundColor: toneBg(colors, item.tone) },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={item.icon as any}
                    size={17}
                    color={toneText(colors, item.tone)}
                  />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardText}>{item.body}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.footerNote}>
              Ditandai sudah dibaca otomatis saat layar ini dibuka.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
      marginBottom: 20,
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

    count: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    cardIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardBody: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 3,
      lineHeight: 17,
    },
    footerNote: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 16,
    },

    emptyBox: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 20,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 6,
    },
    emptyText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
