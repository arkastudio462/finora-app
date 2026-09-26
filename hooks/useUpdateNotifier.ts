import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { postUpdateNotification, requestNotificationPermission } from '@/utils/notifications';

export type UpdateNotice =
  | { kind: 'ota'; id: string; ready: boolean }
  | { kind: 'apk'; id: string; version: string; url: string };

interface ReleaseInfo {
  version?: string;
  versionCode?: number;
  runtimeVersion?: string | null;
  sha?: string;
  buildNumber?: number;
}

const APK_CHECK_KEY = 'finora.update.apk.lastCheck';
const APK_DISMISSED_KEY = 'finora.update.apk.dismissed';
const APPLIED_KEY = 'finora.update.applied';
const APK_CHECK_INTERVAL = 30 * 60 * 1000;

function githubRepo(): string | null {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const repo = extra?.githubRepo;
  return typeof repo === 'string' && repo.includes('/') ? repo : null;
}

async function fetchReleaseInfo(repo: string): Promise<ReleaseInfo | null> {
  const res = await fetch(`https://github.com/${repo}/releases/download/latest/release-info.json`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as ReleaseInfo;
}

export function useUpdateNotifier() {
  const [apkNotice, setApkNotice] = useState<UpdateNotice | null>(null);
  const [otaDismissed, setOtaDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();

  const otaNotice = useMemo<UpdateNotice | null>(() => {
    if (!Updates.isEnabled || otaDismissed) return null;
    if (isUpdatePending) return { kind: 'ota', id: 'ota:pending', ready: true };
    if (isUpdateAvailable) return { kind: 'ota', id: 'ota:available', ready: false };
    return null;
  }, [isUpdateAvailable, isUpdatePending, otaDismissed]);

  const notice = otaNotice ?? apkNotice;
  const noticeRef = useRef<UpdateNotice | null>(notice);
  useEffect(() => {
    noticeRef.current = notice;
  }, [notice]);

  useEffect(() => {
    AsyncStorage.getItem(APPLIED_KEY)
      .then((value) => {
        if (value !== '1') return;
        setJustUpdated(true);
        return AsyncStorage.removeItem(APPLIED_KEY);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const repo = githubRepo();
        if (!repo) return;

        const lastCheck = Number((await AsyncStorage.getItem(APK_CHECK_KEY)) ?? 0);
        if (Date.now() - lastCheck < APK_CHECK_INTERVAL) return;

        const info = await fetchReleaseInfo(repo).catch(() => null);
        if (!alive) return;
        await AsyncStorage.setItem(APK_CHECK_KEY, String(Date.now()));
        if (!info) return;

        const localVersionCode = Constants.expoConfig?.android?.versionCode ?? 0;
        const localRuntime = Updates.runtimeVersion;
        const newerVersion = typeof info.versionCode === 'number' && info.versionCode > localVersionCode;
        const runtimeChanged =
          typeof info.runtimeVersion === 'string' &&
          !!localRuntime &&
          info.runtimeVersion !== localRuntime;
        if (!newerVersion && !runtimeChanged) return;

        const id = info.sha ?? `${info.version ?? ''}-${info.versionCode ?? 0}`;
        const dismissed = await AsyncStorage.getItem(APK_DISMISSED_KEY);
        if (!alive || dismissed === id) return;

        setApkNotice({
          kind: 'apk',
          id,
          version: info.version ?? '',
          url: `https://github.com/${repo}/releases/tag/latest`,
        });
      } catch {
        return;
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      void requestNotificationPermission();
    }, 1200);
    return () => clearTimeout(timer);
  }, [notice]);

  const notifiedRef = useRef<string | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'background') return;
      const current = noticeRef.current;
      if (!current || notifiedRef.current === current.id) return;
      notifiedRef.current = current.id;

      if (current.kind === 'ota') {
        void postUpdateNotification({
          title: current.ready ? 'Update siap dipasang' : 'Update tersedia',
          body: current.ready
            ? 'Buka Finora untuk memperbarui aplikasi sekarang.'
            : 'Finora memiliki update baru. Buka aplikasi untuk mengunduhnya.',
          data: { type: 'ota' },
        });
        return;
      }

      void postUpdateNotification({
        title: current.version ? `Finora v${current.version} tersedia` : 'Update aplikasi tersedia',
        body: 'Ketuk untuk mengunduh dan memasang versi terbaru.',
        data: { type: 'apk', url: current.url },
      });
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string | undefined>;
      if (data?.type === 'apk' && data.url) void WebBrowser.openBrowserAsync(data.url);
    });
    return () => subscription.remove();
  }, []);

  const dismiss = useCallback(() => {
    const current = noticeRef.current;
    if (!current) return;
    if (current.kind === 'ota') {
      setOtaDismissed(true);
      return;
    }
    setApkNotice(null);
    AsyncStorage.setItem(APK_DISMISSED_KEY, current.id).catch(() => undefined);
  }, []);

  const apply = useCallback(async () => {
    const current = noticeRef.current;
    if (!current || busy) return;
    setBusy(true);

    try {
      if (current.kind === 'apk') {
        await WebBrowser.openBrowserAsync(current.url);
        setApkNotice(null);
        setBusy(false);
        return;
      }

      if (!current.ready) {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) await Updates.fetchUpdateAsync();
      }
      await AsyncStorage.setItem(APPLIED_KEY, '1');
      await Updates.reloadAsync();
    } catch {
      setBusy(false);
    }
  }, [busy]);

  return { notice, dismiss, apply, busy, justUpdated };
}
