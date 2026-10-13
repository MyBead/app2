import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DealCard } from '../../components/DealCard';
import { StatusBanner } from '../../components/StatusBanner';
import { Chip, colors } from '../../components/ui';
import { ALL_CATEGORIES } from '../../core/categories';
import type { ScoredDeal } from '../../core/scoring';
import { STORES } from '../../core/stores';
import { matchesKeyword } from '../../core/text';
import type { CategoryId, StoreId } from '../../core/types';
import { useDeals } from '../../state/DealsContext';

type Sort = 'score' | 'discount' | 'price' | 'ending';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'score', label: 'Для меня' },
  { id: 'discount', label: 'Скидка' },
  { id: 'price', label: 'Цена' },
  { id: 'ending', label: 'Скоро закончится' },
];

const COMPARE: Record<Sort, (a: ScoredDeal, b: ScoredDeal) => number> = {
  score: (a, b) => b.score - a.score,
  discount: (a, b) => b.discount - a.discount,
  price: (a, b) => (a.deal.price ?? Infinity) - (b.deal.price ?? Infinity),
  ending: (a, b) => (a.deal.validTo ?? '9999').localeCompare(b.deal.validTo ?? '9999'),
};

export default function AllDealsScreen() {
  const { ranked, prefs, refreshing, refresh } = useDeals();
  const [query, setQuery] = useState('');
  const [store, setStore] = useState<StoreId | null>(null);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [sort, setSort] = useState<Sort>('score');

  const presentCategories = useMemo(() => {
    const ids = new Set(ranked.map((s) => s.deal.category));
    return ALL_CATEGORIES.filter((c) => ids.has(c.id));
  }, [ranked]);

  const shown = useMemo(
    () =>
      ranked
        .filter(
          (s) =>
            (!store || s.deal.store === store) &&
            (!category || s.deal.category === category) &&
            (!query.trim() || matchesKeyword(`${s.deal.title} ${s.deal.subtitle ?? ''}`, query)),
        )
        .sort(COMPARE[sort]),
    [ranked, store, category, query, sort],
  );

  return (
    <FlatList
      data={shown}
      keyExtractor={(s) => s.deal.id}
      renderItem={({ item }) => <DealCard item={item} />}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
        <View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Поиск по-польски: kawa, masło, kurczak…"
            placeholderTextColor={colors.muted}
            style={styles.search}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            <Chip label="Все магазины" selected={!store} onPress={() => setStore(null)} />
            {prefs.stores.map((id) => (
              <Chip
                key={id}
                label={STORES[id].name}
                color={STORES[id].color}
                selected={store === id}
                onPress={() => setStore(store === id ? null : id)}
              />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {presentCategories.map((c) => (
              <Chip
                key={c.id}
                label={`${c.emoji} ${c.label}`}
                selected={category === c.id}
                onPress={() => setCategory(category === c.id ? null : c.id)}
              />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {SORTS.map((s) => (
              <Chip
                key={s.id}
                label={`↕ ${s.label}`}
                selected={sort === s.id}
                color={colors.text}
                onPress={() => setSort(s.id)}
              />
            ))}
          </ScrollView>
          <StatusBanner />
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          {refreshing ? 'Загружаю акции…' : 'Ничего не найдено. Потяните вниз, чтобы обновить.'}
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, flexGrow: 1 },
  search: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    marginBottom: 10,
  },
  chips: { marginBottom: 2 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, paddingHorizontal: 24, fontSize: 15 },
});
