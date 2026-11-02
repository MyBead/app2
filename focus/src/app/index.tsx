import { useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner, Button, Card, Chip, Chips, ToggleRow } from '../components/ui';
import {
  CALLERS,
  DURATIONS,
  GROUPS,
  formatClock,
  formatLeft,
  groupLabel,
  groupMissed,
  isAppBlocked,
  orderApps,
  plural,
  toggleApp,
  toggleGroup,
} from '../core/focus';
import { useFocus } from '../state/useFocus';
import { colors } from '../theme';

const NOTIFICATIONS: [string, string, string] = ['уведомление', 'уведомления', 'уведомлений'];

export default function FocusScreen() {
  const { native, state, log, now, apps, loadApps, setConfig } = useFocus();
  const { config } = state;
  const [showApps, setShowApps] = useState(false);
  const [query, setQuery] = useState('');
  const [openMissed, setOpenMissed] = useState<string | null>(null);
  const [tileNote, setTileNote] = useState<string | null>(null);

  if (!native) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Text style={styles.h1}>Фокус</Text>
          <Card title="Работает только в установленном APK на Android">
            <Text style={styles.text}>
              Блокировка уведомлений использует нативный код Android, поэтому в Expo Go и в браузере её нет. Скачайте
              APK из раздела Releases на GitHub.
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const toggleFocus = async () => {
    if (state.active) {
      native.stop();
      return;
    }
    if (!state.listenerEnabled) {
      native.openListenerSettings();
      return;
    }
    // Android 13+: allow the "focus is over, N hidden" summary (asked once).
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS').catch(() => undefined);
    }
    native.start(config.minutes);
  };

  const addTile = async () => {
    const r = await native.requestAddTile();
    setTileNote(
      r === 'added' || r === 'already'
        ? 'Плитка «Фокус» в шторке — включайте одним касанием, не открывая приложение.'
        : r === 'declined'
          ? 'Можно добавить позже: шторка → карандаш (изменить) → перетащите «Фокус».'
          : 'Добавьте вручную: шторка → карандаш (изменить) → перетащите «Фокус».',
    );
  };

  const missed = groupMissed(log);
  const list = apps ? orderApps(apps, log, query) : [];
  const left = state.active && state.until > 0 ? state.until - now : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Фокус</Text>

        {!state.listenerEnabled ? (
          <Banner
            title="Один раз: доступ к уведомлениям"
            text={
              'Включите «Фокус» в списке «Доступ к уведомлениям». Без этого Android не даёт скрывать чужие уведомления.\n\n' +
              'Если переключатель серый (так Android защищает приложения не из Play Маркета):\n' +
              '1) нажмите на серый переключатель — появится «Ограниченная настройка», нажмите ОК;\n' +
              '2) «Настройки приложения» → ⋮ вверху справа → «Разрешить ограниченные настройки»;\n' +
              '3) вернитесь в «Открыть доступ» и включите.'
            }
            action="Открыть доступ"
            onAction={() => native.openListenerSettings()}
            secondary="Настройки приложения"
            onSecondary={() => native.openAppSettings()}
          />
        ) : null}

        {state.listenerEnabled && config.silence && !state.dndAccess ? (
          <Banner
            title="Нужен доступ к «Не беспокоить»"
            text="Для режима «Тишина» включите «Фокус» в списке. Скрытие выбранных приложений работает и без этого."
            action="Открыть"
            onAction={() => native.openDndSettings()}
          />
        ) : null}

        <View style={styles.hero}>
          <Pressable
            onPress={toggleFocus}
            accessibilityRole="switch"
            accessibilityState={{ checked: state.active }}
            accessibilityLabel={state.active ? 'Выключить фокус' : 'Включить фокус'}
            style={({ pressed }) => [
              styles.bigButton,
              state.active && styles.bigButtonOn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.bigEmoji}>{state.active ? '🔕' : '🔔'}</Text>
            <Text style={[styles.bigLabel, state.active && styles.bigLabelOn]}>
              {state.active ? 'Фокус включён' : 'Включить фокус'}
            </Text>
            {state.active ? <Text style={styles.bigSub}>нажмите, чтобы выключить</Text> : null}
          </Pressable>

          <Text style={styles.status}>
            {state.active
              ? [
                  state.until > 0 ? `до ${formatClock(state.until)} · осталось ${formatLeft(left)}` : 'до выключения',
                  `скрыто ${state.sessionHidden} ${plural(state.sessionHidden, NOTIFICATIONS)}`,
                ].join('\n')
              : '📞 Звонки проходят всегда'}
          </Text>

          <Chips>
            {DURATIONS.map((d) => (
              <Chip
                key={d.minutes}
                label={d.label}
                selected={config.minutes === d.minutes}
                onPress={() => setConfig({ ...config, minutes: d.minutes })}
              />
            ))}
          </Chips>
          {state.active && config.minutes !== Math.round((state.until - state.startedAt) / 60_000) ? (
            <Text style={styles.small}>Новая длительность — со следующего включения.</Text>
          ) : null}
        </View>

        <Card
          title="Что скрывать"
          hint="Одно касание — включить или выключить. Звонки, будильники и навигация не скрываются никогда."
        >
          <Chips>
            <Chip label="📞 Звонки — проходят" selected={false} disabled />
            {GROUPS.map((g) => (
              <Chip
                key={g.id}
                label={`${g.emoji} ${g.label}`}
                selected={config.blockedGroups.includes(g.id)}
                onPress={() => setConfig(toggleGroup(config, g.id))}
              />
            ))}
          </Chips>
          <Text style={styles.small}>Выделенные скрываются, пока включён фокус, и попадают в «Пропущенное».</Text>
        </Card>

        <Card>
          <ToggleRow
            label="🔇 Тишина для остального"
            hint="Всё, что не скрыто, приходит без звука и всплывающих окон. Звонят только звонки и будильники."
            value={config.silence}
            onChange={(silence) => setConfig({ ...config, silence })}
          />
          {config.silence ? (
            <>
              <Text style={styles.label}>Чьи звонки пропускать</Text>
              <Chips>
                {CALLERS.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.label}
                    selected={config.callers === c.id}
                    onPress={() => setConfig({ ...config, callers: c.id })}
                  />
                ))}
              </Chips>
              <ToggleRow
                label="Повторный звонок"
                hint="Если тот же номер звонит снова в течение 15 минут — пропустить, даже если он не в списке."
                value={config.repeatCallers}
                onChange={(repeatCallers) => setConfig({ ...config, repeatCallers })}
              />
            </>
          ) : (
            <Text style={styles.small}>
              Без «Тишины» скрытые приложения иногда успевают коротко пикнуть, прежде чем уведомление исчезнет.
            </Text>
          )}
        </Card>

        <Card title="Отдельные приложения" hint="Касание переключает: скрывать или пропускать — независимо от группы.">
          {!showApps ? (
            <Button
              label="Выбрать приложения"
              subtle
              onPress={() => {
                setShowApps(true);
                loadApps();
              }}
            />
          ) : (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Поиск приложения"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              {apps === null ? <Text style={styles.small}>Загрузка…</Text> : null}
              {list.map((app) => {
                const blocked = isAppBlocked(config, app);
                const own = config.apps[app.pkg] !== undefined;
                return (
                  <Pressable
                    key={app.pkg}
                    onPress={() => setConfig(toggleApp(config, app))}
                    style={({ pressed }) => [styles.appRow, pressed && { opacity: 0.6 }]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: blocked }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.appName}>{app.label}</Text>
                      <Text style={styles.small}>
                        {groupLabel(app.group)}
                        {own ? ' · выбрано вручную' : ''}
                      </Text>
                    </View>
                    <Text style={[styles.badge, blocked ? styles.badgeOff : styles.badgeOn]}>
                      {blocked ? 'скрывать' : 'пропускать'}
                    </Text>
                  </Pressable>
                );
              })}
            </>
          )}
        </Card>

        <Card
          title={`Пропущенное${log.length ? ` · ${log.length}` : ''}`}
          hint={
            missed.length ? 'Скрытые уведомления. Касание — показать, «Открыть» — перейти в приложение.' : undefined
          }
        >
          {missed.length === 0 ? (
            <Text style={styles.small}>Пока пусто. Здесь появится то, что «Фокус» скрыл.</Text>
          ) : (
            <>
              {missed.map((g) => (
                <View key={g.pkg} style={styles.missed}>
                  <Pressable
                    style={styles.missedHead}
                    onPress={() => setOpenMissed(openMissed === g.pkg ? null : g.pkg)}
                  >
                    <Text style={[styles.appName, { flex: 1 }]}>
                      {g.app} <Text style={styles.count}>{g.count}</Text>
                    </Text>
                    <Text style={styles.small}>{formatClock(g.last)}</Text>
                    <Pressable onPress={() => native.openApp(g.pkg)} hitSlop={8}>
                      <Text style={styles.link}>Открыть</Text>
                    </Pressable>
                  </Pressable>
                  {(openMissed === g.pkg ? g.items : g.items.slice(0, 1)).map((item) => (
                    <Text
                      key={`${item.key}-${item.time}`}
                      style={styles.missedItem}
                      numberOfLines={openMissed === g.pkg ? 4 : 1}
                    >
                      <Text style={{ fontWeight: '600' }}>{item.title}</Text>
                      {item.text ? ` — ${item.text}` : ''}
                    </Text>
                  ))}
                </View>
              ))}
              <Button label="Очистить" subtle onPress={() => native.clearLog()} />
            </>
          )}
        </Card>

        <Card
          title="Включать из шторки"
          hint="Плитка «Фокус» в быстрых настройках: одно касание — включить или выключить, не открывая приложение."
        >
          {state.canAddTile ? <Button label="Добавить плитку" onPress={addTile} /> : null}
          <Text style={styles.small}>
            {tileNote ?? (state.canAddTile ? '' : 'Опустите шторку → карандаш (изменить) → перетащите «Фокус» наверх.')}
          </Text>
          {!state.exactAlarms ? (
            <Pressable onPress={() => native.openExactAlarmSettings()}>
              <Text style={styles.link}>Заканчивать фокус точно по таймеру (разрешить будильники) →</Text>
            </Pressable>
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
  hero: { alignItems: 'center', gap: 14, paddingVertical: 8 },
  bigButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.off,
    borderWidth: 3,
    borderColor: colors.accent,
    gap: 6,
  },
  bigButtonOn: { backgroundColor: colors.on, borderColor: colors.on },
  bigEmoji: { fontSize: 48 },
  bigLabel: { fontSize: 20, fontWeight: '800', color: colors.accent },
  bigLabelOn: { color: colors.onText },
  bigSub: { fontSize: 13, color: colors.onText, opacity: 0.85 },
  status: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  appName: { fontSize: 15, color: colors.text, fontWeight: '600' },
  badge: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  badgeOff: { backgroundColor: colors.accentSoft, color: colors.accent },
  badgeOn: { backgroundColor: colors.goodSoft, color: colors.good },
  missed: { gap: 4, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  missedHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  missedItem: { fontSize: 14, color: colors.text, lineHeight: 19 },
  count: { color: colors.accent, fontWeight: '800' },
  link: { color: colors.accent, fontWeight: '700', fontSize: 14 },
});
