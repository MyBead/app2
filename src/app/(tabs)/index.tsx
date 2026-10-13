import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { DealCard } from '../../components/DealCard';
import { StatusBanner } from '../../components/StatusBanner';
import { Banner, colors } from '../../components/ui';
import { useDeals } from '../../state/DealsContext';

/** Hot deals under the user's preferences, best first. */
export default function ForYouScreen() {
  const { ranked, results, prefs, refreshing, refresh } = useDeals();
  const nothingLoaded = results.every((r) => r.deals.length === 0);
  const hot = ranked.filter((s) => s.hot);
  const personalised = prefs.keywords.length > 0 || prefs.favoriteCategories.length > 0;

  return (
    <FlatList
      data={hot}
      keyExtractor={(s) => s.deal.id}
      renderItem={({ item }) => <DealCard item={item} />}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
        <View>
          {!personalised ? (
            <Banner
              tone="info"
              text={`Сейчас здесь все акции со скидкой от ${prefs.minDiscount}%. Добавьте любимые товары и категории — подборка станет точнее, а уведомления полезнее.`}
              action="Настроить предпочтения"
              onAction={() => router.navigate('/settings')}
            />
          ) : null}
          <StatusBanner />
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          {refreshing
            ? 'Загружаю акции…'
            : nothingLoaded
              ? 'Акций пока нет. Потяните вниз, чтобы обновить.'
              : `Нет акций под ваши условия. Потяните вниз, чтобы обновить, или снизьте минимальную скидку (сейчас ${prefs.minDiscount}%).`}
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, flexGrow: 1 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, paddingHorizontal: 24, fontSize: 15 },
});
