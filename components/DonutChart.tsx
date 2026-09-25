import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { COLORS } from '@/constants/theme';
import { formatRupiah } from '@/utils/format';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';

const CHART_COLORS = [
  '#f97316', '#fb923c', '#fdba74', '#ea580c', '#c2410c', '#fed7aa', '#ffedd5',
];

interface DonutChartProps {
  data: Record<string, number>;
  size?: number;
  strokeWidth?: number;
}

export default function DonutChart({ data, size = 160, strokeWidth = 22 }: DonutChartProps) {
  const styles = useStyles(createStyles);
  const categories = Object.keys(data);
  const values = Object.values(data);
  const total = values.reduce((a, b) => a + b, 0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  if (categories.length === 0 || total === 0) {
    return (
      <View style={[styles.emptyContainer, { width: size, height: size }]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  let accumulated = 0;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          {categories.map((cat, i) => {
            const portion = data[cat] / total;
            const strokeDasharray = `${circumference * portion} ${circumference * (1 - portion)}`;
            const strokeDashoffset = -accumulated * circumference;
            accumulated += portion;

            return (
              <Circle
                key={cat}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            );
          })}
        </G>
      </Svg>

      <View style={[styles.centerLabel, { width: size, height: size }]}>
        <Text style={styles.totalLabel}>total</Text>
        <Text style={styles.totalAmount}>{formatRupiah(total)}</Text>
      </View>
    </View>
  );
}

export { CHART_COLORS };

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  centerLabel: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
