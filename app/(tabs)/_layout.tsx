import { Tabs, useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Animated, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { COLORS, TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '@/constants/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const FAB_SIZE = 66;
const FAB_LIFT = 32;

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  transactions: { active: 'swap-horizontal', inactive: 'swap-horizontal' },
  budget: { active: 'chart-pie', inactive: 'chart-pie' },
  profile: { active: 'account-circle', inactive: 'account-circle-outline' },
};

const LEFT_TABS = ['index', 'transactions'];
const RIGHT_TABS = ['budget', 'profile'];

function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const router = useRouter();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const fabScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (keyboardVisible) {
    return null;
  }

  const renderTab = (name: string) => {
    const route = state.routes.find((item) => item.name === name);
    if (!route) {
      return null;
    }
    const focused = state.routes[state.index]?.name === name;
    const label = descriptors[route.key]?.options.title ?? name;
    const icons = TAB_ICONS[name] ?? TAB_ICONS.index;

    const handlePress = () => {
      if (!focused) {
        navigation.navigate(route.name);
      }
    };

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={handlePress}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
      >
        <View style={styles.iconPill}>
          <MaterialCommunityIcons
            name={focused ? icons.active : icons.inactive}
            size={24}
            color={focused ? COLORS.primary : COLORS.textMuted}
          />
        </View>
        <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
          {label}
        </Text>
        {focused && <View style={styles.activeDot} />}
      </Pressable>
    );
  };

  const handleFabPressIn = () => {
    Animated.spring(fabScale, { toValue: 0.86, useNativeDriver: true, friction: 5, tension: 90 }).start();
  };

  const handleFabPressOut = () => {
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 90 }).start();
  };

  const fabBottom =
    insets.bottom + TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT / 2 + FAB_LIFT - FAB_SIZE / 2;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.bar,
          {
            height: TAB_BAR_HEIGHT,
            marginBottom: insets.bottom + TAB_BAR_BOTTOM_GAP,
          },
        ]}
      >
        {LEFT_TABS.map(renderTab)}
        <View style={styles.fabSlot} />
        {RIGHT_TABS.map(renderTab)}
      </View>
      <Animated.View style={[styles.fabContainer, { bottom: fabBottom, transform: [{ scale: fabScale }] }]}>
        <View style={styles.fabBackground}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tambah transaksi"
            onPressIn={handleFabPressIn}
            onPressOut={handleFabPressOut}
            onPress={() => router.push('/(modals)/add-transaction')}
            style={styles.fab}
          >
            <MaterialCommunityIcons name="plus" size={32} color={COLORS.white} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false, animation: 'shift' }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Trans' }} />
      <Tabs.Screen name="budget" options={{ title: 'Budget' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 16,
    paddingHorizontal: 6,
    backgroundColor: COLORS.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 8,
    shadowColor: '#17191c',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 4,
  },
  tabPressed: {
    opacity: 0.65,
  },
  iconPill: {
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  tabLabelActive: {
    color: COLORS.primary,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginTop: 3,
  },
  fabContainer: {
    position: 'absolute',
    left: '50%',
    marginLeft: -(FAB_SIZE / 2),
    zIndex: 10,
    elevation: 10,
  },
  fabBackground: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: COLORS.primary,
    borderWidth: 6,
    borderColor: COLORS.background,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 16,
  },
  fabSlot: {
    width: FAB_SIZE + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: '100%',
    height: '100%',
    borderRadius: FAB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
