import React, { useState } from 'react';
import { Image, TouchableOpacity, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';
import { RECEIPTS_BUCKET } from '@/lib/images';
import ImagePreview from '@/components/ImagePreview';

interface AttachmentThumbProps {
  path?: string | null;
  bucket?: string;
  size?: number;
}

export default function AttachmentThumb({
  path,
  bucket = RECEIPTS_BUCKET,
  size = 44,
}: AttachmentThumbProps) {
  const url = useSignedImageUrl(bucket, path);
  const [preview, setPreview] = useState(false);

  if (!path || !url) return null;

  return (
    <View>
      <TouchableOpacity
        style={[styles.thumb, { width: size, height: size, borderRadius: size / 4 }]}
        activeOpacity={0.8}
        onPress={() => setPreview(true)}
      >
        <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
        <View style={styles.badge}>
          <MaterialCommunityIcons name="image-outline" size={10} color={COLORS.white} />
        </View>
      </TouchableOpacity>
      <ImagePreview visible={preview} uri={url} onClose={() => setPreview(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
