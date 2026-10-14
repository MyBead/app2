import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PriceInsightLine } from '../../components/PriceInsightLine';
import { Chip, StoreBadge, colors } from '../../components/ui';
import { formatPrice } from '../../core/price';
import type { ItemPlan } from '../../core/shoppingList';
import { STORES } from '../../core/stores';
import { formatUnitPrice, unitPrice } from '../../core/units';
import { useDeals } from '../../state/DealsContext';
import { useShoppingList } from '../../state/ShoppingList';

function ItemRow({ plan, onPick }: { plan: ItemPlan; onPick: (p: ItemPlan) => void }) {
  const { toggle, remove } = useShoppingList();
  const { insightFor } = useDeals();
  const { item, best, matches, pinned } = plan;
  return (
    <View style={styles.itemRow}>
      <Pressable onPress={() => toggle(item.id)} hitSlop={8} style={styles.check}>
        <Text style={styles.checkText}>{item.checked ? '☑' : '☐'}</Text>
      </Pressable>
      <Pressable style={styles.itemBody} onPress={() => matches.length > 0 && onPick(plan)}>
        <Text style={[styles.itemText, item.checked && styles.itemDone]}>{item.text}</Text>
        {best ? (
          <>
            <Text style={styles.dealLine} numberOfLines={2}>
              {best.title} — <Text style={styles.dealPrice}>{formatPrice(best.price)}</Text>
              {pinned ? '  📌' : ''}
            </Text>
            {!item.checked ? <PriceInsightLine insight={insightFor(best)} /> : null}
            {matches.length > 1 && !item.checked ? (
              <Text style={styles.more}>Вариантов: {matches.length} — выбрать ›</Text>
            ) : null}
          </>
        ) : !item.checked ? (
          <Text style={styles.noDeal}>Сейчас нет акций — купите где удобно</Text>
        ) : null}
      </Pressable>
      <Pressable onPress={() => remove(item.id)} hitSlop={8}>
        <Text style={styles.remove}>✕</Text>
      </Pressable>
    </View>
  );
}

/** Choose which deal to buy for an item: all current matches across stores, cheapest first. */
function PickerModal({ plan, onClose }: { plan: ItemPlan | null; onClose: () => void }) {
  const { pick } = useShoppingList();
  if (!plan) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>«{plan.item.text}» — где взять</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.modalClose}>Готово</Text>
          </Pressable>
        </View>
        {plan.pinned ? (
          <Pressable
            style={styles.autoRow}
            onPress={() => {
              pick(plan.item.id, undefined);
              onClose();
            }}
          >
            <Text style={styles.autoText}>↺ Выбирать самый дешёвый вариант автоматически</Text>
          </Pressable>
        ) : null}
        <FlatList
          data={plan.matches}
          keyExtractor={(d) => d.id}
          renderItem={({ item: d }) => {
            const chosen = plan.best?.id === d.id;
            return (
              <Pressable
                style={[styles.optionRow, chosen && styles.optionChosen]}
                onPress={() => {
                  pick(plan.item.id, d.id);
                  onClose();
                }}
              >
                <StoreBadge store={d.store} small />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle} numberOfLines={2}>
                    {d.title}
                  </Text>
                  {d.subtitle ? <Text style={styles.optionSub}>{d.subtitle}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.optionPrice}>{formatPrice(d.price)}</Text>
                  {unitPrice(d) ? <Text style={styles.optionSub}>{formatUnitPrice(unitPrice(d)!)}</Text> : null}
                </View>
                <Text style={styles.optionCheck}>{chosen ? '✓' : ''}</Text>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

/** How to plan the trip: how many stores at most, and which ones. */
function TripBar() {
  const { trip, setTrip } = useShoppingList();
  const { prefs } = useDeals();
  const toggleStore = (id: (typeof prefs.stores)[number]) =>
    setTrip({
      ...trip,
      allowedStores: trip.allowedStores.includes(id)
        ? trip.allowedStores.filter((s) => s !== id)
        : [...trip.allowedStores, id],
    });
  return (
    <View style={styles.tripBox}>
      <Text style={styles.tripLabel}>Сколько магазинов обойти</Text>
      <View style={styles.wrap}>
        {[null, 1, 2, 3].map((n) => (
          <Chip
            key={String(n)}
            label={n === null ? 'Сколько угодно (дешевле всего)' : `не больше ${n}`}
            selected={trip.maxStores === n}
            onPress={() => setTrip({ ...trip, maxStores: n })}
          />
        ))}
      </View>
      <Text style={styles.tripLabel}>Где покупать</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Chip
          label="Везде"
          selected={trip.allowedStores.length === 0}
          onPress={() => setTrip({ ...trip, allowedStores: [] })}
        />
        {[...prefs.stores]
          // Grocery chains first: that's what a shopping list is usually for.
          .sort((a, b) => Number(STORES[a].group !== 'grocery') - Number(STORES[b].group !== 'grocery'))
          .map((id) => (
            <Chip
              key={id}
              label={STORES[id].name}
              color={STORES[id].color}
              selected={trip.allowedStores.includes(id)}
              onPress={() => toggleStore(id)}
            />
          ))}
      </ScrollView>
    </View>
  );
}

export default function ShoppingListScreen() {
  const { plan, items, addText, clearChecked } = useShoppingList();
  const [text, setText] = useState('');
  const [picking, setPicking] = useState<ItemPlan | null>(null);
  const add = () => {
    addText(text);
    setText('');
  };
  const storesCount = plan.stops.length;

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.addRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={add}
            placeholder="Что купить? masło, kawa, jajka…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
          <Pressable style={styles.addButton} onPress={add}>
            <Text style={styles.addButtonText}>Добавить</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Пишите по-польски, можно через запятую. Или нажмите «+ в список» на любой акции. Для каждого товара выбирается
          самая дешёвая текущая акция.
        </Text>

        {items.length > 0 ? <TripBar /> : null}
        {items.length === 0 ? <Text style={styles.empty}>Список пуст.</Text> : null}

        {storesCount > 0 ? (
          <View style={styles.totalBox}>
            <Text style={styles.totalText}>
              По акциям: {formatPrice(plan.total)} · {storesCount}{' '}
              {storesCount === 1 ? 'магазин' : storesCount < 5 ? 'магазина' : 'магазинов'}
            </Text>
          </View>
        ) : null}

        {plan.stops.map((stop) => (
          <View key={stop.store} style={styles.storeCard}>
            <View style={styles.storeHeader}>
              <StoreBadge store={stop.store} />
              <Text style={styles.storeName}>{STORES[stop.store].name}</Text>
              <Text style={styles.storeTotal}>{formatPrice(stop.total)}</Text>
            </View>
            {stop.items.map((p) => (
              <ItemRow key={p.item.id} plan={p} onPick={setPicking} />
            ))}
          </View>
        ))}

        {plan.noDeal.length > 0 ? (
          <View style={styles.storeCard}>
            <Text style={styles.groupTitle}>Сейчас без акций</Text>
            {plan.noDeal.map((p) => (
              <ItemRow key={p.item.id} plan={p} onPick={setPicking} />
            ))}
          </View>
        ) : null}

        {plan.checked.length > 0 ? (
          <View style={styles.storeCard}>
            <View style={styles.storeHeader}>
              <Text style={[styles.groupTitle, { flex: 1 }]}>Куплено</Text>
              <Pressable onPress={clearChecked} hitSlop={8}>
                <Text style={styles.clear}>Очистить</Text>
              </Pressable>
            </View>
            {plan.checked.map((p) => (
              <ItemRow key={p.item.id} plan={p} onPick={setPicking} />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <PickerModal plan={picking} onClose={() => setPicking(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 40 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
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
  addButton: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  addButtonText: { color: '#FFFFFF', fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  tripBox: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 10 },
  tripLabel: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 6, marginBottom: 12 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 30, fontSize: 15 },
  totalBox: { backgroundColor: colors.accentSoft, borderRadius: 10, padding: 12, marginBottom: 10 },
  totalText: { fontSize: 15, fontWeight: '700', color: colors.text },
  storeCard: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 10 },
  storeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  storeName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  storeTotal: { fontSize: 16, fontWeight: '800', color: colors.text },
  groupTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  clear: { color: colors.accent, fontWeight: '600' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  check: { paddingTop: 1 },
  checkText: { fontSize: 20, color: colors.accent },
  itemBody: { flex: 1 },
  itemText: { fontSize: 16, fontWeight: '600', color: colors.text },
  itemDone: { textDecorationLine: 'line-through', color: colors.muted },
  dealLine: { fontSize: 13, color: colors.text, marginTop: 2 },
  dealPrice: { fontWeight: '800' },
  more: { fontSize: 12, color: colors.accent, marginTop: 4, fontWeight: '600' },
  noDeal: { fontSize: 13, color: colors.muted, marginTop: 2 },
  remove: { fontSize: 16, color: colors.muted, paddingTop: 2 },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  modalClose: { fontSize: 15, color: colors.accent, fontWeight: '600' },
  autoRow: { padding: 14, backgroundColor: colors.accentSoft },
  autoText: { color: colors.accent, fontWeight: '600' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionChosen: { backgroundColor: colors.accentSoft },
  optionTitle: { fontSize: 14, color: colors.text },
  optionSub: { fontSize: 12, color: colors.muted },
  optionPrice: { fontSize: 15, fontWeight: '800', color: colors.text },
  optionCheck: { width: 16, color: colors.accent, fontWeight: '800' },
});
