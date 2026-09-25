import { useFonts } from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { FinanceProvider } from '@/context/FinanceContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { ToastProvider } from '@/components/Toast';
import { AppAlertProvider } from '@/components/AppAlert';
import { useAuth } from '@/hooks/useAuth';
import { isWelcomeSeen, loadWelcomeSeen } from '@/utils/welcome';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const { resolved, colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const [welcomeReady, setWelcomeReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadWelcomeSeen()
      .catch(() => undefined)
      .finally(() => {
        if (alive) setWelcomeReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (loading || !welcomeReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inWelcome = segments[0] === 'welcome';

    if (!isWelcomeSeen()) {
      if (!inWelcome) router.replace('/welcome');
      return;
    }

    if (inWelcome) {
      router.replace(session ? '/(tabs)' : '/(auth)/login');
      return;
    }

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, welcomeReady]);

  if (loading || !welcomeReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      {children}
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...MaterialCommunityIcons.font,
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <FinanceProvider>
        <ToastProvider>
          <AppAlertProvider>
          <AuthGate>
            <Stack>
              <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="(modals)" options={{ headerShown: false, animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
            </Stack>
          </AuthGate>
          </AppAlertProvider>
        </ToastProvider>
      </FinanceProvider>
    </ThemeProvider>
  );
}
