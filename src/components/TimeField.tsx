import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';
import { formatClock } from '../utils/format';

/** Champ d'heure : ouvre l'horloge Android native. */
export function TimeField({
  hour,
  minute,
  onChange,
  use24h = true,
  label,
}: {
  hour: number;
  minute: number;
  onChange: (h: number, m: number) => void;
  use24h?: boolean;
  label: string;
}) {
  const open = () => {
    const value = new Date();
    value.setHours(hour, minute, 0, 0);
    DateTimePickerAndroid.open({
      value,
      mode: 'time',
      is24Hour: use24h,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(date.getHours(), date.getMinutes());
      },
    });
  };
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${formatClock(hour, minute, use24h)}. Modifier`}
      style={({ pressed }) => [s.box, pressed && { opacity: 0.75 }]}
    >
      <Text style={s.time}>{formatClock(hour, minute, use24h)}</Text>
      <Text style={s.edit}>Modifier</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  box: {
    backgroundColor: colors.deepRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  time: { color: colors.white, fontSize: 44, fontWeight: '300', fontVariant: ['tabular-nums'] },
  edit: { color: colors.gold, fontSize: 13, marginTop: 2 },
});
