/** Composants d'interface réutilisables (bleu nuit / or doux). */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DAY_LETTER, DAY_ORDER, DAY_SHORT } from '../constants/defaults';
import { colors, font, radius, spacing } from '../constants/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const inner = padded ? styles.padded : undefined;
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[inner, { paddingBottom: spacing.xxl }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Label({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <Text style={[styles.label, muted && { color: colors.textMuted }]}>{children}</Text>;
}

export function Hint({ children, tone }: { children: React.ReactNode; tone?: 'warn' | 'ok' }) {
  const color = tone === 'warn' ? colors.warning : tone === 'ok' ? colors.success : colors.textMuted;
  return <Text style={[styles.hint, { color }]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  big,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  big?: boolean;
  accessibilityHint?: string;
}) {
  const fg =
    variant === 'primary' ? colors.night : variant === 'danger' ? colors.danger : variant === 'ghost' ? colors.gold : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        big && styles.btnBig,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'danger' && styles.btnDanger,
        variant === 'ghost' && styles.btnGhost,
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.8 },
      ]}
    >
      {icon && <Ionicons name={icon} size={big ? 22 : 18} color={fg} style={{ marginRight: spacing.sm }} />}
      <Text style={[styles.btnText, big && { fontSize: 17, letterSpacing: 1 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color = colors.textMuted,
  disabled,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, (pressed || disabled) && { opacity: disabled ? 0.3 : 0.6 }]}
    >
      <Ionicons name={icon} size={22} color={color} />
    </Pressable>
  );
}

/** Ligne de réglage cliquable. */
export function Row({
  icon,
  title,
  value,
  onPress,
  right,
  subtitle,
}: {
  icon?: IconName;
  title: string;
  value?: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const content = (
    <View style={styles.row}>
      {icon && <Ionicons name={icon} size={20} color={colors.gold} style={{ marginRight: spacing.md }} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title} ${value ?? ''}`}>
      {({ pressed }) => <View style={pressed && { opacity: 0.7 }}>{content}</View>}
    </Pressable>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  icon,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: IconName;
}) {
  return (
    <Row
      icon={icon}
      title={title}
      subtitle={subtitle}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          accessibilityLabel={title}
          trackColor={{ false: colors.line, true: colors.goldSoft }}
          thumbColor={value ? colors.gold : colors.textMuted}
        />
      }
    />
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

/** Choix parmi des options, en pastilles. */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  format,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={String(o)}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{format ? format(o) : String(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DaySelector({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
  const toggle = (d: number) => {
    const has = days.includes(d);
    if (has && days.length === 1) return; // au moins un jour
    onChange(has ? days.filter((x) => x !== d) : [...days, d].sort());
  };
  return (
    <View>
      <View style={styles.days}>
        {DAY_ORDER.map((d) => {
          const on = days.includes(d);
          return (
            <Pressable
              key={d}
              onPress={() => toggle(d)}
              accessibilityRole="checkbox"
              accessibilityLabel={DAY_SHORT[d]}
              accessibilityState={{ checked: on }}
              style={[styles.day, on && styles.dayOn]}
            >
              <Text style={[styles.dayText, on && { color: colors.night }]}>{DAY_LETTER[d]}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.chips, { marginTop: spacing.sm }]}>
        <Pressable onPress={() => onChange([0, 1, 2, 3, 4, 5, 6])} style={styles.chip}>
          <Text style={styles.chipText}>Tous les jours</Text>
        </Pressable>
        <Pressable onPress={() => onChange([1, 2, 3, 4, 5])} style={styles.chip}>
          <Text style={styles.chipText}>Lun–Ven</Text>
        </Pressable>
        <Pressable onPress={() => onChange([0, 6])} style={styles.chip}>
          <Text style={styles.chipText}>Week-end</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function daysSummary(days: number[]): string {
  if (days.length === 7) return 'Tous les jours';
  const s = [...days].sort().join(',');
  if (s === '1,2,3,4,5') return 'Du lundi au vendredi';
  if (s === '0,6') return 'Le week-end';
  return DAY_ORDER.filter((d) => days.includes(d))
    .map((d) => DAY_SHORT[d])
    .join(' · ');
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.gold}
        accessibilityLabel={label}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

/** Sélecteur numérique − / + (minutes). */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  suffix = 'min',
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  label?: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <View style={styles.stepper} accessibilityLabel={label}>
      <IconButton icon="remove-circle-outline" label={`Diminuer ${label ?? ''}`} onPress={() => set(value - step)} color={colors.gold} disabled={value <= min} />
      <Text style={styles.stepperValue}>
        {value} {suffix}
      </Text>
      <IconButton icon="add-circle-outline" label={`Augmenter ${label ?? ''}`} onPress={() => set(value + step)} color={colors.gold} disabled={value >= max} />
    </View>
  );
}

export function StatusPill({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'off' }) {
  const c = tone === 'ok' ? colors.success : tone === 'warn' ? colors.warning : colors.textFaint;
  return (
    <View style={[styles.pill, { borderColor: c }]}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={[styles.pillText, { color: c }]}>{text}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  padded: { padding: spacing.lg },
  card: {
    backgroundColor: colors.deep,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  section: {
    color: colors.gold,
    fontSize: font.small,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  label: { color: colors.text, fontSize: font.body, marginBottom: spacing.sm, fontWeight: '600' },
  hint: { fontSize: font.small, lineHeight: 18, marginTop: spacing.xs },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    marginVertical: spacing.xs,
  },
  btnBig: { minHeight: 60 },
  btnPrimary: { backgroundColor: colors.gold },
  btnSecondary: { backgroundColor: colors.deepRaised, borderWidth: 1, borderColor: colors.line },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.goldSoft },
  btnText: { fontSize: font.body, fontWeight: '700' },
  iconBtn: { padding: spacing.sm, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: spacing.sm },
  rowTitle: { color: colors.text, fontSize: font.body },
  rowSub: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  rowValue: { color: colors.gold, fontSize: font.body, marginLeft: spacing.sm, marginRight: spacing.xs, flexShrink: 1, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.deepRaised,
    minHeight: 38,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  chipTextActive: { color: colors.night },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.deepRaised,
  },
  dayOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  dayText: { color: colors.text, fontWeight: '700' },
  fieldLabel: { color: colors.textMuted, fontSize: font.small, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.deepRaised,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.body,
    borderWidth: 1,
    borderColor: colors.line,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepperValue: { color: colors.text, fontSize: font.heading, fontWeight: '700', minWidth: 90, textAlign: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  pillText: { fontSize: font.small, fontWeight: '600' },
});
