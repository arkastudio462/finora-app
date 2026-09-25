import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { markWelcomeSeen } from '@/utils/welcome';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';

const SLIDES = [
  {
    icon: 'receipt-text',
    title: 'Catat keuangan dalam detik',
    desc: 'Tinggal ketik pemasukan atau pengeluaran, lengkap dengan kategori, metode bayar, dan lampiran foto struk.',
  },
  {
    icon: 'chart-donut',
    title: 'Lihat ke mana uangmu pergi',
    desc: 'Grafik tren bulanan dan ringkasan harian membuat pos keuanganmu selalu terlihat jelas.',
  },
  {
    icon: 'bell-ring-outline',
    title: 'Anggaran & pengingat otomatis',
    desc: 'Budget, transaksi berulang, sampai jatuh tempo hutang — semuanya diingatkan tepat waktu.',
  },
] as const;

export default function WelcomeScreen() {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  const finish = async () => {
    await markWelcomeSeen();
    router.replace(session ? '/(tabs)' : '/(auth)/login');
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const handleNext = () => {
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    const next = index + 1;
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <MaterialCommunityIcons name="chart-line-variant" size={15} color={colors.primary} />
          </View>
          <Text style={styles.brandText}>Finora</Text>
        </View>
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={finish}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Lewati</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScroll}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        scrollEventThrottle={16}
        contentContainerStyle={viewportH > 0 ? { height: viewportH } : undefined}
        style={styles.slider}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.slide, { width }]}>
            <View style={styles.slideIconWrap}>
              <MaterialCommunityIcons name={s.icon} size={52} color={colors.primary} />
            </View>
            <Text style={styles.slideTitle}>{s.title}</Text>
            <Text style={styles.slideDesc}>{s.desc}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.ctaBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.ctaText}>
            {index === SLIDES.length - 1 ? 'Mulai Sekarang' : 'Selanjutnya'}
          </Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={colors.white} />
        </TouchableOpacity>

        <Text style={styles.footerNote}>Kelola keuanganmu dengan lebih tenang.</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    brandIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(249,115,22,0.12)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    brandText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: 0.3,
    },
    skipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },

    slider: {
      flex: 1,
    },
    slide: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    slideIconWrap: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32,
    },
    slideTitle: {
      fontSize: 23,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      lineHeight: 30,
      marginBottom: 14,
    },
    slideDesc: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 6,
    },

    footer: {
      alignItems: 'center',
    },
    dots: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 24,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 22,
      backgroundColor: colors.primary,
    },
    ctaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 18,
      paddingVertical: 16,
      width: '100%',
    },
    ctaText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.white,
    },
    footerNote: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 14,
    },
  });
