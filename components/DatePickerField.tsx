import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseKey(key: string): Date | null {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatLabel(key: string): string {
  const d = parseKey(key);
  if (!d) return key;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

interface Props {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

export default function DatePickerField({ label, value, onChange, placeholder }: Props) {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());

  const today = toKey(new Date());
  const selectedKey = value && parseKey(value) ? value : null;

  const openPicker = () => {
    const base = selectedKey ? parseKey(selectedKey) : new Date();
    if (base) setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
    setOpen(true);
  };

  const goMonth = (delta: number) => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const pickDay = (key: string) => {
    onChange(key);
    setOpen(false);
  };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(`${year}-${pad2(month + 1)}-${pad2(d)}`);

  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        style={styles.field}
        activeOpacity={0.8}
        onPress={openPicker}
      >
        <MaterialCommunityIcons name="calendar-blank-outline" size={17} color={colors.textMuted} />
        <Text style={[styles.fieldText, !selectedKey && styles.fieldPlaceholder]} numberOfLines={1}>
          {selectedKey ? formatLabel(selectedKey) : (placeholder ?? 'Pilih tanggal')}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            activeOpacity={1}
            onPress={() => setOpen(false)}
          />

          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <TouchableOpacity style={styles.navBtn} onPress={() => goMonth(-1)}>
                <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>
                {MONTHS[month]} {year}
              </Text>
              <TouchableOpacity style={styles.navBtn} onPress={() => goMonth(1)}>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => (
                <View key={w} style={styles.weekCell}>
                  <Text style={styles.weekText}>{w}</Text>
                </View>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((key, idx) => {
                if (!key) return <View key={`empty-${idx}`} style={styles.dayCell} />;

                const isSelected = key === selectedKey;
                const isToday = key === today;

                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.dayCell}
                    activeOpacity={0.75}
                    onPress={() => pickDay(key)}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        isSelected && styles.dayCircleSelected,
                        !isSelected && isToday && styles.dayCircleToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                          !isSelected && isToday && { color: colors.primary },
                        ]}
                      >
                        {Number(key.slice(8, 10))}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <MaterialCommunityIcons name="close" size={15} color={colors.textSecondary} />
                <Text style={styles.clearText}>Hapus tanggal</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.doneBtn} activeOpacity={0.85} onPress={() => setOpen(false)}>
                <Text style={styles.doneText}>Selesai</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: colors.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 16,
    },
    fieldText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    fieldPlaceholder: {
      color: colors.textMuted,
      fontWeight: '400',
    },

    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    backdrop: {
      backgroundColor: 'transparent',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 26,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    navBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sheetTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    weekCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 6,
    },
    weekText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: `${100 / 7}%`,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 3,
    },
    dayCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayCircleSelected: {
      backgroundColor: colors.primary,
    },
    dayCircleToday: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    dayText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    dayTextSelected: {
      color: colors.white,
      fontWeight: '700',
    },
    sheetActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    clearBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    clearText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    doneBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 15,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.white,
    },
  });
