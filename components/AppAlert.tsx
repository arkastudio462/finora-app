import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors, useStyles } from '@/context/ThemeContext';
import type { Colors } from '@/constants/theme';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertButton {
  text: string;
  style?: 'primary' | 'destructive' | 'secondary';
  onPress?: () => void;
}

export interface AlertOptions {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  type?: AlertType;
  destructive?: boolean;
  onConfirm?: () => void;
}

export interface AlertApi {
  show: (options: AlertOptions) => void;
  info: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  confirm: (options: ConfirmOptions) => void;
}

const AlertContext = createContext<AlertApi | null>(null);

const TYPE_META: Record<
  AlertType,
  { icon: string; tint: string; bg: string; defaultTitle: string }
> = {
  info: { icon: 'information', tint: '#3b82f6', bg: 'rgba(59,130,246,0.14)', defaultTitle: 'Informasi' },
  success: { icon: 'check-circle-outline', tint: '#16a34a', bg: 'rgba(22,163,74,0.14)', defaultTitle: 'Berhasil' },
  warning: { icon: 'alert-outline', tint: '#f97316', bg: 'rgba(249,115,22,0.14)', defaultTitle: 'Perhatian' },
  error: { icon: 'close-circle-outline', tint: '#ef4444', bg: 'rgba(239,68,68,0.14)', defaultTitle: 'Gagal' },
};

const FALLBACK: AlertApi = {
  show: (options) => console.warn('[alert]', options.title, options.message ?? ''),
  info: (message, title) => console.warn('[alert]', title ?? 'info', message),
  success: (message, title) => console.warn('[alert]', title ?? 'success', message),
  warning: (message, title) => console.warn('[alert]', title ?? 'warning', message),
  error: (message, title) => console.warn('[alert]', title ?? 'error', message),
  confirm: (options) => console.warn('[alert:confirm]', options.title, options.message ?? ''),
};

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const styles = useStyles(createStyles);
  const [options, setOptions] = useState<AlertOptions | null>(null);
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    scale.setValue(0.9);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 70 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.94, duration: 130, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 130, useNativeDriver: true }),
    ]).start(() => setOptions(null));
  }, [scale, opacity]);

  const show = useCallback((next: AlertOptions) => setOptions(next), []);

  useEffect(() => {
    if (options) animateIn();
  }, [options, animateIn]);

  const api = useMemo<AlertApi>(
    () => ({
      show,
      info: (message, title) => show({ title: title ?? TYPE_META.info.defaultTitle, message, type: 'info' }),
      success: (message, title) => show({ title: title ?? TYPE_META.success.defaultTitle, message, type: 'success' }),
      warning: (message, title) => show({ title: title ?? TYPE_META.warning.defaultTitle, message, type: 'warning' }),
      error: (message, title) => show({ title: title ?? TYPE_META.error.defaultTitle, message, type: 'error' }),
      confirm: (opts) =>
        show({
          title: opts.title,
          message: opts.message,
          type: opts.type ?? 'warning',
          buttons: [
            { text: opts.cancelText ?? 'Batal', style: 'secondary' },
            {
              text: opts.confirmText ?? 'Lanjutkan',
              style: opts.destructive === false ? 'primary' : 'destructive',
              onPress: opts.onConfirm,
            },
          ],
        }),
    }),
    [show]
  );

  const type = options?.type ?? 'info';
  const meta = TYPE_META[type];
  const buttons: AlertButton[] =
    options?.buttons && options.buttons.length > 0
      ? options.buttons
      : [{ text: 'OK', style: 'primary' }];

  return (
    <AlertContext.Provider value={api}>
      {children}

      <Modal transparent visible={!!options} animationType="none" onRequestClose={dismiss}>
        <Animated.View style={[styles.overlay, { opacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={dismiss}
          />
          <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
            <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
              <MaterialCommunityIcons name={meta.icon as any} size={34} color={meta.tint} />
            </View>

            <Text style={styles.title}>{options?.title ?? meta.defaultTitle}</Text>
            {!!options?.message && <Text style={styles.message}>{options.message}</Text>}

            <View style={styles.buttonColumn}>
              {buttons.map((btn, idx) => {
                const variant = btn.style ?? 'secondary';
                const isPrimary = variant === 'primary';
                const isDestructive = variant === 'destructive';
                const isSecondary = variant === 'secondary' && buttons.length > 1;

                return (
                  <TouchableOpacity
                    key={`${btn.text}-${idx}`}
                    activeOpacity={0.85}
                    style={[
                      styles.button,
                      isPrimary && { backgroundColor: colors.primary },
                      isDestructive && { backgroundColor: colors.danger },
                      isSecondary && styles.buttonSecondary,
                      idx > 0 && !isSecondary && styles.buttonSpacing,
                    ]}
                    onPress={() => {
                      const action = btn.onPress;
                      dismiss();
                      if (action) setTimeout(action, 90);
                    }}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        (isPrimary || isDestructive) && { color: colors.white },
                        isSecondary && { color: colors.textSecondary, fontWeight: '600' },
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertApi {
  const ctx = useContext(AlertContext);
  return ctx ?? FALLBACK;
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 22,
      paddingTop: 26,
      paddingBottom: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 12,
    },
    iconWrap: {
      width: 66,
      height: 66,
      borderRadius: 33,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    message: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 8,
    },
    buttonColumn: {
      width: '100%',
      marginTop: 22,
      gap: 9,
    },
    button: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonSecondary: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonSpacing: {
      marginTop: 0,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
  });
