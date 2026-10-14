import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors } from '../../../components/ui';
import { STORES } from '../../../core/stores';
import type { StoreId } from '../../../core/types';
import type { LeafletPage } from '../../../providers/blix';
import { loadLeafletCache } from '../../../services/storage';

/** Leaflet pages, swipeable, opened at the deal's page with its offer framed. */
export default function LeafletScreen() {
  const params = useLocalSearchParams<{ store: StoreId; id: string; page?: string; box?: string }>();
  const { width, height } = useWindowDimensions();
  const [pages, setPages] = useState<LeafletPage[] | null>(null);
  const [name, setName] = useState<string>();
  const [current, setCurrent] = useState(1);

  useEffect(() => {
    loadLeafletCache().then((cache) => {
      const entry = cache[`${params.store}:${params.id}`];
      setPages(entry?.pages ?? []);
      setName(entry?.name);
    });
  }, [params.store, params.id]);

  const targetPage = Number(params.page) || 1;
  const box = params.box?.split(',').map(Number) as [number, number, number, number] | undefined;
  const initialIndex = Math.max(0, pages?.findIndex((p) => p.page === targetPage) ?? 0);
  const title = `${STORES[params.store]?.name ?? ''}${name ? ` — ${name}` : ''}`;

  if (pages === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (pages.length === 0) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title }} />
        <Text style={styles.muted}>Страницы газетки ещё не загружены — обновите акции и попробуйте снова.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title }} />
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        keyExtractor={(p) => String(p.page)}
        onMomentumScrollEnd={(e) => setCurrent(pages[Math.round(e.nativeEvent.contentOffset.x / width)]?.page ?? 1)}
        onLayout={() => setCurrent(pages[initialIndex]?.page ?? 1)}
        renderItem={({ item }) => {
          // Fit the page into the screen keeping its aspect ratio; the frame uses the same box.
          const scale = Math.min(width / item.width, (height - 140) / item.height);
          const w = item.width * scale;
          const h = item.height * scale;
          return (
            <View style={[styles.page, { width }]}>
              <View style={{ width: w, height: h }}>
                <Image source={{ uri: item.url }} style={{ width: w, height: h }} resizeMode="contain" />
                {box && item.page === targetPage ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.frame,
                      {
                        left: box[0] * w,
                        top: box[1] * h,
                        width: (box[2] - box[0]) * w,
                        height: (box[3] - box[1]) * h,
                      },
                    ]}
                  />
                ) : null}
              </View>
            </View>
          );
        }}
      />
      <Text style={styles.counter}>
        Страница {current} из {pages.length} · листайте влево-вправо
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  muted: { color: colors.muted, textAlign: 'center' },
  page: { alignItems: 'center', justifyContent: 'center' },
  frame: { position: 'absolute', borderWidth: 3, borderColor: colors.hot, borderRadius: 6 },
  counter: { textAlign: 'center', color: colors.muted, paddingVertical: 10 },
});
