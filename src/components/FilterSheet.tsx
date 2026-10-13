import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ALL_CATEGORIES } from '../core/categories';
import { applyFilter, EMPTY_FILTER, SORTS, type DealFilter } from '../core/filter';
import { parsePrice } from '../core/price';
import type { ScoredDeal } from '../core/scoring';
import { STORE_GROUPS, STORES } from '../core/stores';
import type { CategoryId, StoreId } from '../core/types';
import { useDeals } from '../state/DealsContext';
import { Chip, colors } from './ui';

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'до 10 zł', max: 10 },
  { label: 'до 50 zł', max: 50 },
  { label: '50–500 zł', min: 50, max: 500 },
  { label: 'от 500 zł', min: 500 },
];

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Full-screen filter editor; render it only while open. Changes apply on "Show" (live result count). */
export function FilterSheet({
  value,
  items,
  onApply,
  onClose,
}: {
  value: DealFilter;
  items: ScoredDeal[];
  onApply: (f: DealFilter) => void;
  onClose: () => void;
}) {
  const { prefs, insightFor } = useDeals();
  // Mounted fresh on every open, so the draft starts from the current filter.
  const [draft, setDraft] = useState(value);
  // Raw input text, so typing "4," isn't reformatted mid-number.
  const [minText, setMinText] = useState(value.minPrice !== undefined ? String(value.minPrice) : '');
  const [maxText, setMaxText] = useState(value.maxPrice !== undefined ? String(value.maxPrice) : '');
  const set = (patch: Partial<DealFilter>) => setDraft((d) => ({ ...d, ...patch }));
  const setRange = (min?: number, max?: number) => {
    set({ minPrice: min, maxPrice: max });
    setMinText(min !== undefined ? String(min) : '');
    setMaxText(max !== undefined ? String(max) : '');
  };

  const groupStores = prefs.stores.filter((id) => draft.group === 'all' || STORES[id].group === draft.group);
  const presentCategories = useMemo(() => {
    const ids = new Set(items.map((s) => s.deal.category));
    return ALL_CATEGORIES.filter((c) => ids.has(c.id));
  }, [items]);
  const count = useMemo(
    () => applyFilter(items, { ...draft, sort: 'score' }, (s) => insightFor(s.deal)).length,
    [items, draft, insightFor],
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.headerAction}>Закрыть</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Фильтры</Text>
          <Pressable
            onPress={() => {
              setDraft({ ...EMPTY_FILTER, query: draft.query });
              setRange(undefined, undefined);
            }}
            hitSlop={10}
          >
            <Text style={styles.headerAction}>Сбросить</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SheetSection title="Тип магазинов">
            <View style={styles.wrap}>
              <Chip label="Все" selected={draft.group === 'all'} onPress={() => set({ group: 'all', stores: [] })} />
              {STORE_GROUPS.map((g) => (
                <Chip
                  key={g.id}
                  label={`${g.emoji} ${g.label}`}
                  selected={draft.group === g.id}
                  onPress={() => set({ group: g.id, stores: draft.stores.filter((s) => STORES[s].group === g.id) })}
                />
              ))}
            </View>
          </SheetSection>

          <SheetSection title="Магазины">
            <View style={styles.wrap}>
              <Chip label="Все" selected={draft.stores.length === 0} onPress={() => set({ stores: [] })} />
              {groupStores.map((id: StoreId) => (
                <Chip
                  key={id}
                  label={STORES[id].name}
                  color={STORES[id].color}
                  selected={draft.stores.includes(id)}
                  onPress={() => set({ stores: toggle(draft.stores, id) })}
                />
              ))}
            </View>
          </SheetSection>

          <SheetSection title="Категории">
            <View style={styles.wrap}>
              <Chip label="Все" selected={draft.categories.length === 0} onPress={() => set({ categories: [] })} />
              {presentCategories.map((c) => (
                <Chip
                  key={c.id}
                  label={`${c.emoji} ${c.label}`}
                  selected={draft.categories.includes(c.id)}
                  onPress={() => set({ categories: toggle<CategoryId>(draft.categories, c.id) })}
                />
              ))}
            </View>
          </SheetSection>

          <SheetSection title="Цена, zł">
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                placeholder="от"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                value={minText}
                onChangeText={(t) => {
                  setMinText(t);
                  set({ minPrice: t.trim() ? parsePrice(t) : undefined });
                }}
              />
              <Text style={styles.dash}>—</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="до"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                value={maxText}
                onChangeText={(t) => {
                  setMaxText(t);
                  set({ maxPrice: t.trim() ? parsePrice(t) : undefined });
                }}
              />
            </View>
            <View style={styles.wrap}>
              {PRICE_PRESETS.map((p) => (
                <Chip
                  key={p.label}
                  label={p.label}
                  selected={draft.minPrice === p.min && draft.maxPrice === p.max}
                  onPress={() => setRange(p.min, p.max)}
                />
              ))}
            </View>
          </SheetSection>

          <SheetSection title="Выгода">
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                Только с известной выгодой{'\n'}
                <Text style={styles.switchHint}>есть старая цена, дешевле других сетей или дешевле, чем раньше</Text>
              </Text>
              <Switch
                value={draft.knownSavingOnly}
                onValueChange={(knownSavingOnly) => set({ knownSavingOnly })}
                trackColor={{ true: colors.accent }}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                Только любимые{'\n'}
                <Text style={styles.switchHint}>товары и категории из настроек</Text>
              </Text>
              <Switch
                value={draft.favoritesOnly}
                onValueChange={(favoritesOnly) => set({ favoritesOnly })}
                trackColor={{ true: colors.accent }}
              />
            </View>
          </SheetSection>

          <SheetSection title="Сортировка">
            {SORTS.map((s) => (
              <Pressable key={s.id} style={styles.radioRow} onPress={() => set({ sort: s.id })}>
                <Text style={styles.radio}>{draft.sort === s.id ? '◉' : '○'}</Text>
                <Text style={styles.radioLabel}>{s.label}</Text>
              </Pressable>
            ))}
          </SheetSection>
        </ScrollView>

        <Pressable
          style={styles.applyButton}
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        >
          <Text style={styles.applyText}>Показать {count} акций</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  headerAction: { fontSize: 15, color: colors.accent, fontWeight: '600' },
  content: { padding: 12, paddingBottom: 24 },
  section: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  priceInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  dash: { marginHorizontal: 10, color: colors.muted },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  switchLabel: { flex: 1, fontSize: 15, color: colors.text },
  switchHint: { fontSize: 12, color: colors.muted },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  radio: { fontSize: 18, color: colors.accent, width: 28 },
  radioLabel: { fontSize: 15, color: colors.text },
  applyButton: {
    backgroundColor: colors.accent,
    margin: 12,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  applyText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
