import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { categoryInfo } from '../core/categories';
import { formatPrice } from '../core/price';
import type { ScoredDeal } from '../core/scoring';
import { STORES } from '../core/stores';
import { StoreBadge, colors } from './ui';

export function formatDateRange(from?: string, to?: string): string | undefined {
  const fmt = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
  if (from && to) return `${fmt(from)}–${fmt(to)}`;
  if (to) return `до ${fmt(to)}`;
  if (from) return `с ${fmt(from)}`;
  return undefined;
}

export function DealCard({ item }: { item: ScoredDeal }) {
  const { deal, discount, hot, matchedKeywords } = item;
  const cat = categoryInfo(deal.category);
  const dates = formatDateRange(deal.validFrom, deal.validTo);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, hot && styles.cardHot, pressed && { opacity: 0.85 }]}
      onPress={() => router.push({ pathname: '/deal/[id]', params: { id: deal.id } })}
    >
      {deal.imageUrl ? (
        <Image source={{ uri: deal.imageUrl }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.placeholderEmoji}>{cat.emoji}</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.row}>
          <StoreBadge store={deal.store} small />
          {hot ? <Text style={styles.hotTag}>🔥</Text> : null}
          {deal.requiresApp ? <Text style={styles.appTag}>📱 {STORES[deal.store].loyaltyApp}</Text> : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {deal.title}
        </Text>
        {deal.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {deal.subtitle}
          </Text>
        ) : null}
        <View style={styles.priceRow}>
          {deal.price ? <Text style={styles.price}>{formatPrice(deal.price)}</Text> : null}
          {deal.oldPrice ? <Text style={styles.oldPrice}>{formatPrice(deal.oldPrice)}</Text> : null}
          {discount > 0 ? <Text style={styles.discount}>−{discount}%</Text> : null}
          {deal.promoLabel ? <Text style={styles.promo}>{deal.promoLabel}</Text> : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {[dates, matchedKeywords.length ? `★ ${matchedKeywords.join(', ')}` : undefined].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHot: { borderColor: colors.hot },
  image: { width: 72, height: 72, borderRadius: 8, marginRight: 12, backgroundColor: '#FAFAFA' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  placeholderEmoji: { fontSize: 32 },
  body: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  hotTag: { fontSize: 14 },
  appTag: { fontSize: 11, color: colors.muted },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  price: { fontSize: 17, fontWeight: '800', color: colors.text },
  oldPrice: { fontSize: 13, color: colors.muted, textDecorationLine: 'line-through' },
  discount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.hot,
    backgroundColor: colors.hotSoft,
    paddingHorizontal: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  promo: { fontSize: 13, fontWeight: '700', color: colors.accent },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
