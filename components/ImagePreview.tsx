import React from 'react';
import { Modal, View, Image, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';

interface ImagePreviewProps {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}

export default function ImagePreview({ visible, uri, onClose }: ImagePreviewProps) {
  return (
    <Modal visible={visible && !!uri} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <MaterialCommunityIcons name="close" size={22} color={COLORS.white} />
        </TouchableOpacity>
        {uri ? <Image source={{ uri }} style={styles.image} resizeMode="contain" /> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  image: {
    width: '100%',
    height: '75%',
    borderRadius: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 54,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
});
