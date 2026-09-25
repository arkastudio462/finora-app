import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="add-transaction"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="transaction-detail"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="recurring"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="debts"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="add-budget"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
