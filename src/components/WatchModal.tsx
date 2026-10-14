import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { parsePrice } from '../core/price';
import { useShoppingList } from '../state/ShoppingList';
import { colors } from './ui';

/** "Notify me when <product> costs at most <price>". Render only while open. */
export function WatchModal({
  initialText = '',
  initialPrice,
  onClose,
}: {
  initialText?: string;
  initialPrice?: number;
  onClose: () => void;
}) {
  const { addWatch } = useShoppingList();
  const [text, setText] = useState(initialText);
  const [price, setPrice] = useState(initialPrice ? initialPrice.toFixed(2).replace('.', ',') : '');
  const save = () => {
    if (!text.trim()) return;
    addWatch(text, price.trim() ? parsePrice(price) : undefined);
    onClose();
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>🎯 Следить за ценой</Text>
          <Text style={styles.label}>Товар (по-польски)</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="kawa lavazza, telewizor lg 55…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.label}>Сообщить, когда цена не выше, zł (необязательно)</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="любая акция"
            placeholderTextColor={colors.muted}
            style={styles.input}
            keyboardType="decimal-pad"
          />
          <View style={styles.buttons}>
            <Pressable onPress={onClose} style={[styles.button, styles.secondary]}>
              <Text style={[styles.buttonText, { color: colors.text }]}>Отмена</Text>
            </Pressable>
            <Pressable onPress={save} style={styles.button}>
              <Text style={styles.buttonText}>Следить</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 18 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  button: { backgroundColor: colors.accentStrong, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  secondary: { backgroundColor: colors.bg },
  buttonText: { color: colors.onAccent, fontWeight: '700' },
});
