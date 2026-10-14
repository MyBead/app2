import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DealCard } from '../../components/DealCard';
import { FilterSheet } from '../../components/FilterSheet';
import { StatusBanner } from '../../components/StatusBanner';
import { Chip, colors } from '../../components/ui';
import { categoryInfo } from '../../core/categories';
import { activeFilterCount, applyFilter, EMPTY_FILTER, SORTS, type DealFilter } from '../../core/filter';
import { formatPrice } from '../../core/price';
import { STORE_GROUPS, STORES } from '../../core/stores';
import { useDeals } from '../../state/DealsContext';
import { useShoppingList } from '../../state/ShoppingList';

/** Removable chips summarising the active filter. */
function ActiveFilters({ f, onChange }: { f: DealFilter; onChange: (f: DealFilter) => void }) {
  const chips: { label: string; clear: Partial<DealFilter> }[] = [];
  if (f.stores.length) chips.push({ label: f.stores.map((s) => STORES[s].name).join(', '), clear: { stores: [] } });
  if (f.categories.length) {
    chips.push({ label: f.categories.map((c) => categoryInfo(c).label).join(', '), clear: { categories: [] } });
  }
  if (f.minPrice !== undefined || f.maxPrice !== undefined) {
    const label =
      f.minPrice !== undefined && f.maxPrice !== undefined
        ? `${formatPrice(f.minPrice)} – ${formatPrice(f.maxPrice)}`
        : f.minPrice !== undefined
          ? `от ${formatPrice(f.minPrice)}`
          : `до ${formatPrice(f.maxPrice)}`;
    chips.push({ label, clear: { minPrice: undefined, maxPrice: undefined } });
  }
  if (f.knownSavingOnly) chips.push({ label: 'С известной выгодой', clear: { knownSavingOnly: false } });
  if (f.favoritesOnly) chips.push({ label: 'Только любимые', clear: { favoritesOnly: false } });
  if (chips.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
      {chips.map((c) => (
        <Chip key={c.label} label={`${c.label}  ✕`} selected onPress={() => onChange({ ...f, ...c.clear })} />
      ))}
    </ScrollView>
  );
}

export default function AllDealsScreen() {
  const { ranked, refreshing, refresh, insightFor } = useDeals();
  const [filter, setFilter] = useState<DealFilter>(EMPTY_FILTER);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { favorites } = useShoppingList();
  const shown = useMemo(
    () =>
      applyFilter(
        ranked,
        filter,
        (s) => insightFor(s.deal),
        (id) => favorites.includes(id),
      ),
    [ranked, filter, insightFor, favorites],
  );
  const active = activeFilterCount(filter);
  const sortLabel = SORTS.find((s) => s.id === filter.sort)?.label;

  return (
    <>
      <FlatList
        data={shown}
        keyExtractor={(s) => s.deal.id}
        renderItem={({ item }) => <DealCard item={item} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View>
            <View style={styles.searchRow}>
              <TextInput
                value={filter.query}
                onChangeText={(query) => setFilter((f) => ({ ...f, query }))}
                placeholder="Поиск: kawa, masło, laptop…"
                placeholderTextColor={colors.muted}
                style={styles.search}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              <Pressable
                style={[styles.filterButton, active > 0 && styles.filterButtonOn]}
                onPress={() => setSheetOpen(true)}
              >
                <Text style={[styles.filterText, active > 0 && styles.filterTextOn]}>
                  ⚙ Фильтры{active > 0 ? ` · ${active}` : ''}
                </Text>
              </Pressable>
            </View>
            <View style={styles.groupRow}>
              <Chip
                label="Все"
                selected={filter.group === 'all'}
                onPress={() => setFilter((f) => ({ ...f, group: 'all', stores: [] }))}
              />
              {STORE_GROUPS.map((g) => (
                <Chip
                  key={g.id}
                  label={`${g.emoji} ${g.label}`}
                  selected={filter.group === g.id}
                  onPress={() =>
                    setFilter((f) => ({ ...f, group: g.id, stores: f.stores.filter((s) => STORES[s].group === g.id) }))
                  }
                />
              ))}
              <Chip
                label={`★ Избранное${favorites.length ? ` (${favorites.length})` : ''}`}
                selected={filter.starredOnly}
                onPress={() => setFilter((f) => ({ ...f, starredOnly: !f.starredOnly }))}
              />
            </View>
            <ActiveFilters f={filter} onChange={setFilter} />
            <StatusBanner />
            <Text style={styles.summary}>
              Найдено {shown.length} · {sortLabel}
              {active > 0 ? (
                <Text style={styles.reset} onPress={() => setFilter({ ...EMPTY_FILTER, query: filter.query })}>
                  {'  '}Сбросить фильтры
                </Text>
              ) : null}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {refreshing ? 'Загружаю акции…' : 'Ничего не найдено. Измените фильтры или потяните вниз, чтобы обновить.'}
          </Text>
        }
      />
      {sheetOpen ? (
        <FilterSheet value={filter} items={ranked} onApply={setFilter} onClose={() => setSheetOpen(false)} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, flexGrow: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  search: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  filterButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  filterButtonOn: { backgroundColor: colors.accentStrong, borderColor: colors.accent },
  filterText: { fontSize: 14, fontWeight: '600', color: colors.text },
  filterTextOn: { color: colors.onAccent },
  groupRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chips: { marginBottom: 4 },
  summary: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  reset: { color: colors.accent, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, paddingHorizontal: 24, fontSize: 15 },
});
