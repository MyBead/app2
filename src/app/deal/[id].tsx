import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDateRange } from '../../components/DealCard';
import { Section, StoreBadge, colors } from '../../components/ui';
import { categoryInfo } from '../../core/categories';
import { formatPrice } from '../../core/price';
import { STORES } from '../../core/stores';
import { useDeals } from '../../state/DealsContext';

export default function DealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ranked, results, prefs, updatePrefs } = useDeals();
  // Hidden deals aren't in `ranked`, so fall back to the raw list.
  const scored = ranked.find((s) => s.deal.id === id);
  const deal = scored?.deal ?? results.flatMap((r) => r.deals).find((d) => d.id === id);

  if (!deal) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Акция больше не доступна.</Text>
      </View>
    );
  }

  const store = STORES[deal.store];
  const cat = categoryInfo(deal.category);
  const dates = formatDateRange(deal.validFrom, deal.validTo);
  const firstWord = deal.title
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^\p{L}\d-]/gu, '');
  const following = prefs.keywords.includes(firstWord);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: store.name }} />
      {deal.imageUrl ? <Image source={{ uri: deal.imageUrl }} style={styles.image} resizeMode="contain" /> : null}
      <Section title={deal.title}>
        {deal.subtitle ? <Text style={styles.subtitle}>{deal.subtitle}</Text> : null}
        <View style={styles.priceRow}>
          {deal.price ? <Text style={styles.price}>{formatPrice(deal.price)}</Text> : null}
          {deal.oldPrice ? <Text style={styles.oldPrice}>{formatPrice(deal.oldPrice)}</Text> : null}
          {scored && scored.discount > 0 ? <Text style={styles.discount}>−{scored.discount}%</Text> : null}
        </View>
        {deal.promoLabel ? <Text style={styles.promo}>{deal.promoLabel}</Text> : null}
        <View style={styles.meta}>
          <StoreBadge store={deal.store} />
          <Text style={styles.muted}>
            {cat.emoji} {cat.label}
          </Text>
        </View>
        {dates ? <Text style={styles.line}>📅 Действует: {dates}</Text> : null}
        {deal.requiresApp ? <Text style={styles.line}>📱 Только с {store.loyaltyApp}</Text> : null}
        {scored?.matchedKeywords.length ? (
          <Text style={styles.line}>★ Совпадает с: {scored.matchedKeywords.join(', ')}</Text>
        ) : null}
        {deal.source === 'demo' ? <Text style={[styles.line, styles.muted]}>Демо-данные: цена примерная.</Text> : null}
      </Section>

      <Pressable style={styles.button} onPress={() => WebBrowser.openBrowserAsync(deal.url ?? store.website)}>
        <Text style={styles.buttonText}>Открыть на сайте {store.name}</Text>
      </Pressable>
      <Pressable
        style={[styles.button, styles.buttonSecondary]}
        onPress={() =>
          updatePrefs((p) => ({
            ...p,
            keywords: following ? p.keywords.filter((k) => k !== firstWord) : [...p.keywords, firstWord],
          }))
        }
      >
        <Text style={[styles.buttonText, { color: colors.text }]}>
          {following ? `★ Не следить за «${firstWord}»` : `☆ Следить за «${firstWord}»`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 220, backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12 },
  subtitle: { fontSize: 15, color: colors.muted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 12 },
  price: { fontSize: 28, fontWeight: '800', color: colors.text },
  oldPrice: { fontSize: 16, color: colors.muted, textDecorationLine: 'line-through' },
  discount: { fontSize: 16, fontWeight: '700', color: colors.hot },
  promo: { fontSize: 16, fontWeight: '700', color: colors.accent, marginTop: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  line: { fontSize: 15, color: colors.text, marginTop: 10 },
  muted: { color: colors.muted },
  button: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
