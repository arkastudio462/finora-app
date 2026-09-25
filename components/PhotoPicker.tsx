import React, { useState } from 'react';
import { View, Image, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { pickImage } from '@/lib/images';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';

interface PhotoPickerProps {
  uri?: string | null;
  onPick: (uri: string) => void;
  onRemove?: () => void;
  onError?: (message: string) => void;
}

export default function PhotoPicker({ uri, onPick, onRemove, onError }: PhotoPickerProps) {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const [busy, setBusy] = useState(false);

  const handlePick = async (source: 'library' | 'camera') => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await pickImage(source);
      if (result.error) {
        onError?.(result.error);
        return;
      }
      if (result.uri) onPick(result.uri);
    } finally {
      setBusy(false);
    }
  };

  if (uri) {
    return (
      <View style={styles.previewRow}>
        <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.changeBtn} onPress={() => handlePick('library')}>
            <MaterialCommunityIcons name="image-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.changeText}>Ganti</Text>
          </TouchableOpacity>
          {onRemove && (
            <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
              <MaterialCommunityIcons name="trash-can-outline" size={14} color={colors.danger} />
              <Text style={styles.removeText}>Hapus</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.emptyRow}>
      <TouchableOpacity style={styles.pickBtn} onPress={() => handlePick('camera')} disabled={busy}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <MaterialCommunityIcons name="camera-outline" size={16} color={colors.primary} />
        )}
        <Text style={styles.pickText}>Kamera</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.pickBtn} onPress={() => handlePick('library')} disabled={busy}>
        <MaterialCommunityIcons name="image-outline" size={16} color={colors.primary} />
        <Text style={styles.pickText}>Galeri</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  emptyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  pickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.cardLight,
  },
  pickText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  preview: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.border,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  removeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
});
