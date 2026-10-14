import { StyleSheet, Text, View } from 'react-native';

import type { PriceHistory } from '../core/compare';
import { formatPrice } from '../core/price';
import { colors } from './ui';

const BAR_AREA = 90;

/**
 * Prices this app has seen for a product, as bars from a zero baseline (one series, so no
 * legend). Each bar is labelled with its price and the date it was last seen; the latest is
 * drawn solid, earlier ones lighter.
 */
export function PriceHistoryChart({ entries }: { entries: PriceHistory[string] }) {
  if (entries.length < 2) {
    return (
      <Text style={styles.note}>
        История появится, когда приложение увидит этот товар в следующих газетках (цены запоминаются при каждом
        обновлении).
      </Text>
    );
  }
  const max = Math.max(...entries.map((e) => e.price));
  const min = Math.min(...entries.map((e) => e.price));
  return (
    <View>
      <View style={styles.chart} accessibilityRole="image" accessibilityLabel={describe(entries)}>
        {entries.map((e, i) => {
          const last = i === entries.length - 1;
          return (
            <View key={`${e.seen}-${i}`} style={styles.column}>
              <Text style={[styles.value, last && styles.valueLast]}>{formatPrice(e.price).replace(' zł', '')}</Text>
              <View
                style={[styles.bar, { height: Math.max(4, (e.price / max) * BAR_AREA), opacity: last ? 1 : 0.45 }]}
              />
              <Text style={styles.date}>{`${e.seen.slice(8, 10)}.${e.seen.slice(5, 7)}`}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.note}>
        Мин. {formatPrice(min)} · макс. {formatPrice(max)} · дата — когда цену видели последний раз
      </Text>
    </View>
  );
}

function describe(entries: PriceHistory[string]): string {
  return `История цены: ${entries.map((e) => `${e.seen} ${formatPrice(e.price)}`).join(', ')}`;
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: {
    width: '70%',
    maxWidth: 36,
    backgroundColor: colors.accentStrong,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  value: { fontSize: 11, color: colors.muted, marginBottom: 3 },
  valueLast: { color: colors.text, fontWeight: '700' },
  date: { fontSize: 11, color: colors.muted, marginTop: 4, position: 'absolute', bottom: -18 },
  note: { fontSize: 12, color: colors.muted, marginTop: 24 },
});
