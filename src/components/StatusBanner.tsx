import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { STORES } from '../core/stores';
import { useDeals } from '../state/DealsContext';
import { Banner, colors } from './ui';

/** Last update time, per-store counts and a hint when live sources fail. */
export function StatusBanner() {
  const { results, prefs, refreshing, lastError, updatePrefs } = useDeals();
  const failed = results.filter((r) => r.error && r.deals.length === 0);
  const newest = results.reduce<string | undefined>((m, r) => (!m || r.fetchedAt > m ? r.fetchedAt : m), undefined);
  const time = newest ? new Date(newest).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <View>
      {prefs.useDemoData ? (
        <Banner tone="info" text="Показаны демо-данные (примерные цены). Отключить можно в настройках." />
      ) : null}
      {!prefs.useDemoData && !refreshing && results.length > 0 && failed.length === results.length ? (
        <Banner
          text="Не удалось получить акции с сайтов магазинов. Проверьте интернет или адреса страниц в настройках."
          action="Посмотреть на демо-данных"
          onAction={() => updatePrefs({ useDemoData: true })}
        />
      ) : null}
      {lastError ? <Banner text={`Ошибка обновления: ${lastError}`} /> : null}
      {results.length > 0 ? (
        <Text style={styles.status} onPress={() => router.navigate('/settings')}>
          {refreshing ? 'Обновляю… · ' : time ? `Обновлено в ${time} · ` : ''}
          {results.map((r) => `${STORES[r.store].name} ${r.deals.length > 0 ? r.deals.length : '✕'}`).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { fontSize: 12, color: colors.muted, marginBottom: 10 },
});
