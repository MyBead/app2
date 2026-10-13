import { StyleSheet, Text } from 'react-native';

import type { PriceInsight } from '../core/compare';
import { formatPrice } from '../core/price';
import { STORES } from '../core/stores';
import { colors } from './ui';

/** One line explaining the price: saving vs regular price, other chains or the last price seen. */
export function PriceInsightLine({ insight, large }: { insight: PriceInsight; large?: boolean }) {
  const style = [styles.line, large && styles.large];
  switch (insight.kind) {
    case 'saving':
      return (
        <Text style={[...style, styles.good]}>
          💰 Экономия {formatPrice(insight.amount)}
          {insight.percent ? ` (−${insight.percent}%)` : ''}
        </Text>
      );
    case 'mechanic':
      return (
        <Text style={[...style, styles.good]}>
          🏷️ «{insight.label}» — в среднем −{insight.percent}% (≈{formatPrice(insight.amount)} за штуку)
        </Text>
      );
    case 'cheapest':
      return (
        <Text style={[...style, styles.good]}>
          📉 Дешевле, чем в {STORES[insight.store].name}, на {formatPrice(insight.amount)}
        </Text>
      );
    case 'cheaperElsewhere':
      return (
        <Text style={[...style, styles.bad]}>
          ⚠️ В {STORES[insight.store].name} дешевле: {formatPrice(insight.price)} (−{formatPrice(insight.amount)})
        </Text>
      );
    case 'history':
      return insight.amount > 0 ? (
        <Text style={[...style, styles.good]}>
          🕑 Раньше {formatPrice(insight.previous)} — сейчас дешевле на {formatPrice(insight.amount)}
        </Text>
      ) : (
        <Text style={[...style, styles.bad]}>
          🕑 Раньше было дешевле: {formatPrice(insight.previous)} (+{formatPrice(-insight.amount)})
        </Text>
      );
    default:
      return <Text style={[...style, styles.muted]}>Цена из газетки — обычную цену магазин не указал</Text>;
  }
}

const styles = StyleSheet.create({
  line: { fontSize: 12, marginTop: 4 },
  large: { fontSize: 15, marginTop: 10 },
  good: { color: colors.accent, fontWeight: '600' },
  bad: { color: colors.warn, fontWeight: '600' },
  muted: { color: colors.muted },
});
