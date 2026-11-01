import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { colors } from '../theme';

export function Card({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {hint ? <Text style={styles.cardHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipOn,
        disabled && styles.chipDisabled,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)} accessibilityRole="switch">
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.cardHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#FFFFFF"
      />
    </Pressable>
  );
}

export function Banner({
  title,
  text,
  action,
  onAction,
  secondary,
  onSecondary,
}: {
  title: string;
  text: string;
  action: string;
  onAction: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerTitle}>{title}</Text>
      <Text style={styles.bannerText}>{text}</Text>
      <View style={styles.bannerActions}>
        <Button label={action} onPress={onAction} />
        {secondary && onSecondary ? <Button label={secondary} onPress={onSecondary} subtle /> : null}
      </View>
    </View>
  );
}

export function Button({ label, onPress, subtle }: { label: string; onPress: () => void; subtle?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, subtle && styles.buttonSubtle, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.buttonText, subtle && styles.buttonTextSubtle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardHint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipDisabled: { opacity: 0.6 },
  chipText: { fontSize: 15, color: colors.text },
  chipTextOn: { color: '#FFFFFF', fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 15, color: colors.text, fontWeight: '600' },
  banner: { backgroundColor: colors.warnSoft, borderRadius: 16, padding: 16, gap: 8 },
  bannerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  bannerText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  bannerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  button: { backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  buttonSubtle: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  buttonTextSubtle: { color: colors.text, fontWeight: '600' },
});
