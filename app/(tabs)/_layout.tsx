import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';

const TAB_BAR_HEIGHT = 72;
const TAB_BAR_BOTTOM_MARGIN = 10;
const FAB_SIZE = 58;
const FAB_BORDER = 5;

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tabBarBottom = insets.bottom + TAB_BAR_BOTTOM_MARGIN;
  const fabBottom = tabBarBottom + (TAB_BAR_HEIGHT / 2) - (FAB_SIZE / 2);

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.textPrimary,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarStyle: [
            styles.tabBar,
            {
              bottom: tabBarBottom,
              height: TAB_BAR_HEIGHT,
            },
          ],
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.tabIconContainer}>
                <MaterialCommunityIcons name="home" size={22} color={color as string} />
                {focused && <View style={styles.activeDot} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: 'Transactions',
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.tabIconContainer}>
                <MaterialCommunityIcons name="receipt-text" size={22} color={color as string} />
                {focused && <View style={styles.activeDot} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="budget"
          options={{
            title: 'Budget',
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.tabIconContainer}>
                <MaterialCommunityIcons name="chart-pie" size={22} color={color as string} />
                {focused && <View style={styles.activeDot} />}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.tabIconContainer}>
                <MaterialCommunityIcons name="account" size={22} color={color as string} />
                {focused && <View style={styles.activeDot} />}
              </View>
            ),
          }}
        />
      </Tabs>

      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        activeOpacity={0.8}
        onPress={() => router.push('/(modals)/add-transaction')}
      >
        <View style={styles.fabInner}>
          <MaterialCommunityIcons name="plus" size={26} color={COLORS.white} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 0,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingBottom: 0,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  tabBarItem: {
    paddingVertical: 2,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginTop: 3,
  },
  fab: {
    position: 'absolute',
    left: '50%',
    marginLeft: -(FAB_SIZE / 2),
    zIndex: 10,
  },
  fabInner: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: FAB_BORDER,
    borderColor: COLORS.background,
  },
});
