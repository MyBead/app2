import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { colors } from '../../components/ui';
import { useDeals } from '../../state/DealsContext';
import { useShoppingList } from '../../state/ShoppingList';

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  const { ranked } = useDeals();
  const hotCount = ranked.filter((s) => s.hot).length;
  const toBuy = useShoppingList().items.filter((i) => !i.checked).length;
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.accent, headerTitleStyle: { fontWeight: '700' } }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Для вас', tabBarIcon: icon('🔥'), tabBarBadge: hotCount > 0 ? hotCount : undefined }}
      />
      <Tabs.Screen name="all" options={{ title: 'Все акции', tabBarIcon: icon('🏷️') }} />
      <Tabs.Screen
        name="list"
        options={{ title: 'Список', tabBarIcon: icon('📝'), tabBarBadge: toBuy > 0 ? toBuy : undefined }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Настройки', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
