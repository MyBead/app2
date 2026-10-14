import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Chip, Section, StoreBadge, colors } from '../../components/ui';
import { CATEGORIES } from '../../core/categories';
import { EMPTY_NOTIFY_STATE } from '../../core/notify';
import { STORE_GROUPS, STORE_IDS, STORES, storesInGroup } from '../../core/stores';
import { DEFAULT_PREFERENCES, type CategoryId, type NotificationPrefs, type StoreId } from '../../core/types';
import { sourceUrls } from '../../providers';
import { ensurePermission } from '../../services/notifications';
import { sendPreviewNotification } from '../../services/refresh';
import { saveNotifyState } from '../../services/storage';
import { useDeals } from '../../state/DealsContext';

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

function KeywordEditor({
  values,
  onChange,
  placeholder,
  color,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  color?: string;
}) {
  const [text, setText] = useState('');
  const add = () => {
    const items = text
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s && !values.includes(s));
    if (items.length) onChange([...values, ...items]);
    setText('');
  };
  return (
    <View>
      <View style={styles.inputRow}>
        <View style={{ flex: 1 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={add}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            style={[styles.input, { width: '100%' }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>
        <Pressable onPress={add} style={styles.addButton}>
          <Text style={styles.addButtonText}>Добавить</Text>
        </Pressable>
      </View>
      <View style={styles.wrap}>
        {values.map((k) => (
          <Chip
            key={k}
            label={`${k}  ✕`}
            selected
            color={color}
            onPress={() => onChange(values.filter((x) => x !== k))}
          />
        ))}
      </View>
    </View>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  format?: (v: number) => string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={() => onChange(value <= min ? max : value - 1)} style={styles.stepButton}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{format ? format(value) : value}</Text>
        <Pressable onPress={() => onChange(value >= max ? min : value + 1)} style={styles.stepButton}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent }} />
    </View>
  );
}

export default function SettingsScreen() {
  const { prefs, updatePrefs, results, ranked, refresh, refreshing } = useDeals();
  const n = prefs.notifications;
  const setNotif = (patch: Partial<NotificationPrefs>) =>
    updatePrefs((p) => ({ ...p, notifications: { ...p.notifications, ...patch } }));
  const hour = (h: number) => `${String(h).padStart(2, '0')}:00`;

  const previewNotification = async () => {
    if (!(await ensurePermission())) {
      Alert.alert('Уведомления выключены', 'Разрешите уведомления для приложения в настройках телефона.');
      return;
    }
    if (!(await sendPreviewNotification(results, prefs))) {
      Alert.alert('Нечего показать', 'Сейчас нет акций, подходящих под ваши условия.');
    }
  };

  const resetHistory = async () => {
    await saveNotifyState(EMPTY_NOTIFY_STATE);
    Alert.alert('Готово', 'При следующей фоновой проверке пришлю уведомление о текущих акциях снова.');
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Section title="Магазины" hint="Из каких сетей показывать акции.">
        {STORE_GROUPS.map((g) => (
          <View key={g.id} style={{ marginBottom: 6 }}>
            <Text style={styles.groupLabel}>
              {g.emoji} {g.label}
            </Text>
            <View style={styles.wrap}>
              {storesInGroup(g.id).map((id) => (
                <Chip
                  key={id}
                  label={STORES[id].name}
                  color={STORES[id].color}
                  selected={prefs.stores.includes(id)}
                  onPress={() => updatePrefs((p) => ({ ...p, stores: toggle(p.stores, id) }))}
                />
              ))}
            </View>
          </View>
        ))}
      </Section>

      <Section
        title="Любимые товары"
        hint="Пишите по-польски, можно несколько через запятую: kawa, masło, kurczak. О любой акции на эти товары придёт уведомление, даже при маленькой скидке."
      >
        <KeywordEditor
          values={prefs.keywords}
          onChange={(keywords) => updatePrefs({ keywords })}
          placeholder="kawa, masło…"
        />
      </Section>

      <Section title="Любимые категории" hint="Поднимаются выше в списке.">
        <View style={styles.wrap}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={`${c.emoji} ${c.label}`}
              selected={prefs.favoriteCategories.includes(c.id)}
              onPress={() =>
                updatePrefs((p) => ({
                  ...p,
                  favoriteCategories: toggle(p.favoriteCategories, c.id),
                  hiddenCategories: p.hiddenCategories.filter((x) => x !== c.id),
                }))
              }
            />
          ))}
        </View>
        <SwitchRow
          label="Уведомлять только о любимых категориях (и товарах)"
          value={prefs.onlyFavoriteCategories}
          onChange={(onlyFavoriteCategories) => updatePrefs({ onlyFavoriteCategories })}
        />
      </Section>

      <Section title="Не показывать" hint="Скрытые категории и слова-исключения (например: piwo, karma).">
        <View style={styles.wrap}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={`${c.emoji} ${c.label}`}
              color={colors.hot}
              selected={prefs.hiddenCategories.includes(c.id)}
              onPress={() =>
                updatePrefs((p) => ({
                  ...p,
                  hiddenCategories: toggle(p.hiddenCategories, c.id as CategoryId),
                  favoriteCategories: p.favoriteCategories.filter((x) => x !== c.id),
                }))
              }
            />
          ))}
        </View>
        <KeywordEditor
          values={prefs.blockedKeywords}
          onChange={(blockedKeywords) => updatePrefs({ blockedKeywords })}
          placeholder="piwo, karma…"
          color={colors.hot}
        />
      </Section>

      <Section
        title="Что считать выгодным"
        hint="Акция «горячая», если скидка не меньше порога (или товар есть в любимых)."
      >
        <View style={styles.wrap}>
          {[15, 20, 30, 40, 50].map((v) => (
            <Chip
              key={v}
              label={`от ${v}%`}
              selected={prefs.minDiscount === v}
              onPress={() => updatePrefs({ minDiscount: v })}
            />
          ))}
        </View>
        <SwitchRow
          label="Учитывать акции только по приложению/карте (Lidl Plus, Moja Biedronka, Żappka, Kaufland Card)"
          value={prefs.includeAppOnly}
          onChange={(includeAppOnly) => updatePrefs({ includeAppOnly })}
        />
        <Text style={styles.note}>Сейчас под условия подходит акций: {ranked.filter((s) => s.hot).length}</Text>
      </Section>

      <Section
        title="Уведомления"
        hint="Приложение само проверяет акции в фоне (примерно раз в несколько часов — точное время выбирает система)."
      >
        <SwitchRow
          label="Уведомлять о новых выгодных акциях"
          value={n.enabled}
          onChange={(enabled) => setNotif({ enabled })}
        />
        {n.enabled ? (
          <>
            <Stepper
              label="Не беспокоить с"
              value={n.quietStart}
              min={0}
              max={23}
              format={hour}
              onChange={(quietStart) => setNotif({ quietStart })}
            />
            <Stepper
              label="до"
              value={n.quietEnd}
              min={0}
              max={23}
              format={hour}
              onChange={(quietEnd) => setNotif({ quietEnd })}
            />
            <Stepper
              label="Не больше уведомлений в день"
              value={n.maxPerDay}
              min={1}
              max={10}
              onChange={(maxPerDay) => setNotif({ maxPerDay })}
            />
            <View style={styles.buttons}>
              <Pressable onPress={previewNotification} style={styles.button}>
                <Text style={styles.buttonText}>Пример уведомления</Text>
              </Pressable>
              <Pressable onPress={resetHistory} style={[styles.button, styles.buttonSecondary]}>
                <Text style={[styles.buttonText, { color: colors.text }]}>Сбросить «уже видел»</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </Section>

      <Section
        title="Источники данных"
        hint="Продуктовые акции берутся из газеток на blix.pl, плюс со страниц Lidl и Żabka (там видны и старые цены). Ниже можно указать свою страницу магазина с акциями."
      >
        <SwitchRow
          label="Скачивать новые газетки только по Wi-Fi (по мобильной сети — из памяти)"
          value={prefs.wifiOnlyLeaflets}
          onChange={(wifiOnlyLeaflets) => updatePrefs({ wifiOnlyLeaflets })}
        />
        <SwitchRow
          label="Демо-данные вместо сайтов"
          value={prefs.useDemoData}
          onChange={(useDemoData) => updatePrefs({ useDemoData })}
        />
        {STORE_IDS.filter((id) => prefs.stores.includes(id)).map((id: StoreId) => {
          const r = results.find((x) => x.store === id);
          return (
            <View key={id} style={styles.source}>
              <View style={styles.sourceHeader}>
                <StoreBadge store={id} small />
                <Text style={styles.sourceStatus}>
                  {!r ? 'ещё не загружалось' : r.deals.length > 0 ? `${r.deals.length} акций` : 'ошибка'}
                </Text>
              </View>
              {r?.error ? <Text style={styles.sourceError}>{r.error}</Text> : null}
              <TextInput
                defaultValue={prefs.customSourceUrls[id] ?? ''}
                placeholder={
                  sourceUrls(id, { ...prefs, customSourceUrls: {} })[0] ?? 'своя страница с акциями (необязательно)'
                }
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onEndEditing={(e) => {
                  const url = e.nativeEvent.text.trim();
                  if (url !== (prefs.customSourceUrls[id] ?? ''))
                    updatePrefs((p) => ({ ...p, customSourceUrls: { ...p.customSourceUrls, [id]: url || undefined } }));
                }}
              />
            </View>
          );
        })}
        <Pressable onPress={refresh} disabled={refreshing} style={[styles.button, refreshing && { opacity: 0.5 }]}>
          <Text style={styles.buttonText}>{refreshing ? 'Обновляю…' : 'Обновить акции'}</Text>
        </Pressable>
      </Section>

      <Pressable
        onPress={() =>
          Alert.alert('Сбросить настройки?', 'Все предпочтения вернутся к начальным.', [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Сбросить', style: 'destructive', onPress: () => updatePrefs(() => DEFAULT_PREFERENCES) },
          ])
        }
      >
        <Text style={styles.reset}>Сбросить все настройки</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 40 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  groupLabel: { fontSize: 14, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  addButton: { backgroundColor: colors.accentStrong, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  addButtonText: { color: colors.onAccent, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  rowLabel: { flex: 1, fontSize: 15, color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 20, color: colors.text },
  stepValue: { minWidth: 56, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  button: {
    backgroundColor: colors.accentStrong,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonSecondary: { backgroundColor: colors.bg },
  buttonText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  note: { fontSize: 13, color: colors.muted, marginTop: 6 },
  source: { marginTop: 12 },
  sourceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sourceStatus: { fontSize: 13, color: colors.muted },
  sourceError: { fontSize: 12, color: colors.hot, marginBottom: 6 },
  reset: { textAlign: 'center', color: colors.hot, fontSize: 15, marginTop: 8, padding: 12 },
});
