import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DealCard } from '../components/DealCard';
import { colors } from '../components/ui';
import { WatchModal } from '../components/WatchModal';
import { dealsForProduct, isProductBarcode, productQuery, type ScannedProduct } from '../core/barcode';
import { lookupProduct } from '../providers/products';
import { useDeals } from '../state/DealsContext';
import { useShoppingList } from '../state/ShoppingList';

type Step =
  | { kind: 'scanning' }
  | { kind: 'loading'; code: string }
  | { kind: 'unknown'; code: string; error?: string }
  | { kind: 'found'; product: ScannedProduct };

/** Scan a product's barcode in a shop and see whether it's on offer anywhere right now. */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>({ kind: 'scanning' });
  const busy = useRef(false);

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    if (busy.current || !isProductBarcode(data)) return;
    busy.current = true;
    setStep({ kind: 'loading', code: data });
    try {
      const product = await lookupProduct(data);
      setStep(product ? { kind: 'found', product } : { kind: 'unknown', code: data });
    } catch (e) {
      setStep({ kind: 'unknown', code: data, error: e instanceof Error ? e.message : String(e) });
    }
  };
  const again = () => {
    busy.current = false;
    setStep({ kind: 'scanning' });
  };

  if (step.kind === 'found') return <Result product={step.product} onAgain={again} />;
  if (step.kind === 'unknown')
    return (
      <Unknown
        code={step.code}
        error={step.error}
        onAgain={again}
        onName={(name) => setStep({ kind: 'found', product: { code: step.code, name } })}
      />
    );

  if (!permission) return <View style={styles.center} />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Чтобы сканировать штрихкоды, приложению нужен доступ к камере.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Разрешить камеру</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={step.kind === 'scanning' ? onScanned : undefined}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.window} />
        <Text style={styles.overlayText}>
          {step.kind === 'loading' ? `Ищу товар ${step.code}…` : 'Наведите камеру на штрихкод товара'}
        </Text>
        {step.kind === 'loading' ? <ActivityIndicator color="#fff" /> : null}
      </View>
    </View>
  );
}

function Unknown({
  code,
  error,
  onAgain,
  onName,
}: {
  code: string;
  error?: string;
  onAgain: () => void;
  onName: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{error ? 'Нет связи с базой товаров' : 'Товар не найден в базе'}</Text>
      <Text style={styles.muted}>
        Штрихкод {code}
        {error ? ` · ${error}` : ''}
      </Text>
      <Text style={[styles.text, { marginTop: 16 }]}>Напишите название по-польски — поищу его в акциях:</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        onSubmitEditing={() => name.trim() && onName(name.trim())}
        placeholder="np. kawa lavazza"
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      <View style={styles.row}>
        <Pressable style={[styles.button, styles.secondary]} onPress={onAgain}>
          <Text style={[styles.buttonText, { color: colors.text }]}>Сканировать ещё</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => name.trim() && onName(name.trim())}>
          <Text style={styles.buttonText}>Искать</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Result({ product, onAgain }: { product: ScannedProduct; onAgain: () => void }) {
  const { ranked } = useDeals();
  const { addText } = useShoppingList();
  const [watching, setWatching] = useState(false);
  const [added, setAdded] = useState(false);
  const query = productQuery(product);

  const matches = useMemo(() => {
    const byId = new Map(ranked.map((s) => [s.deal.id, s]));
    return dealsForProduct(
      product,
      ranked.map((s) => s.deal),
    ).map((m) => ({ ...m, item: byId.get(m.deal.id)! }));
  }, [product, ranked]);
  const exactCount = matches.filter((m) => m.exact).length;

  return (
    <>
      <FlatList
        data={matches}
        keyExtractor={(m) => m.deal.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{product.name}</Text>
            <Text style={styles.muted}>
              {[product.brand, product.quantity, product.code].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.button, added && styles.secondary]}
                onPress={() => {
                  addText(query);
                  setAdded(true);
                }}
                disabled={added}
              >
                <Text style={[styles.buttonText, added && { color: colors.text }]}>
                  {added ? '✓ В списке' : '+ в список'}
                </Text>
              </Pressable>
              <Pressable style={styles.button} onPress={() => setWatching(true)}>
                <Text style={styles.buttonText}>🎯 Следить</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.secondary]} onPress={onAgain}>
                <Text style={[styles.buttonText, { color: colors.text }]}>📷 Ещё</Text>
              </Pressable>
            </View>
            <Text style={styles.section}>
              {matches.length === 0
                ? `Сейчас этого товара нет в акциях ваших магазинов. Добавьте его в список или следите за ценой — пришлю уведомление, когда появится («${query}»).`
                : exactCount > 0
                  ? `Этот товар по акции: ${exactCount}`
                  : 'Точно этого товара в акциях нет, но есть похожие:'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View>
            {index === exactCount && exactCount > 0 ? <Text style={styles.section}>Похожие товары</Text> : null}
            <DealCard item={item.item} />
          </View>
        )}
      />
      {watching ? <WatchModal initialText={query} onClose={() => setWatching(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  list: { padding: 12, backgroundColor: colors.bg, flexGrow: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  window: { width: '75%', height: 150, borderWidth: 3, borderColor: '#fff', borderRadius: 14 },
  overlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  text: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.muted, marginTop: 4 },
  section: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
    marginTop: 8,
  },
  button: { backgroundColor: colors.accentStrong, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.onAccent, fontWeight: '700' },
});
