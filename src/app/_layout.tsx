import '../services/backgroundTask';

import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { colors } from '../components/ui';
import { DealsProvider, useDealsMaybe } from '../state/DealsContext';
import { ShoppingListProvider } from '../state/ShoppingList';

function Gate() {
  const state = useDealsMaybe();
  const ready = state !== null;
  const handled = useRef<string | null>(null);

  // Tapping a deals notification opens the "for you" tab — once per notification,
  // both on cold start (last response) and while the app is running (listener).
  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const id = response.notification.request.identifier;
      if (handled.current === id) return;
      handled.current = id;
      const screen = response.notification.request.content.data?.screen;
      router.navigate(screen === 'list' ? '/list' : screen === 'all' ? '/all' : '/');
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [ready]);

  if (!state) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return (
    <ShoppingListProvider>
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="deal/[id]" options={{ title: 'Акция', headerBackTitle: 'Назад' }} />
      </Stack>
    </ShoppingListProvider>
  );
}

export default function RootLayout() {
  return (
    <DealsProvider>
      <StatusBar style="dark" />
      <Gate />
    </DealsProvider>
  );
}
