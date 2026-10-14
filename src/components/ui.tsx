import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { STORES } from '../core/stores';
import type { StoreId } from '../core/types';

import { colors } from '../theme';

export { colors };

export function StoreBadge({ store, small }: { store: StoreId; small?: boolean }) {
  const s = STORES[store];
  return (
    <View style={[styles.badge, { backgroundColor: s.color }, small && styles.badgeSmall]}>
      <Text style={[styles.badgeText, { color: s.textColor }, small && styles.badgeTextSmall]}>{s.name}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  const active = color ?? colors.accentStrong;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && { backgroundColor: active, borderColor: active }]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Section({
  title,
  hint,
  children,
  style,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function Banner({
  text,
  tone = 'warn',
  action,
  onAction,
}: {
  text: string;
  tone?: 'warn' | 'info';
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={[
        styles.banner,
        tone === 'warn' ? { backgroundColor: colors.warnSoft } : { backgroundColor: colors.accentSoft },
      ]}
    >
      <Text style={styles.bannerText}>{text}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.bannerButton}>
          <Text style={styles.bannerButtonText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  badgeSmall: { paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontWeight: '700', fontSize: 13 },
  badgeTextSmall: { fontSize: 11 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextSelected: { color: colors.onAccent, fontWeight: '600' },
  section: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  sectionHint: { fontSize: 13, color: colors.muted, marginBottom: 12 },
  banner: { borderRadius: 10, padding: 12, marginBottom: 12 },
  bannerText: { color: colors.text, fontSize: 14 },
  bannerButton: { marginTop: 8, alignSelf: 'flex-start' },
  bannerButtonText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
});
