import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, daysSummary, Hint, Screen, StatusPill } from '../components/ui';
import { DEFAULT_ALARM, SOLAR_EVENT_LABELS } from '../constants/defaults';
import { colors, font, spacing } from '../constants/theme';
import { useAppStore } from '../hooks/useAppStore';
import type { RootStackParamList } from '../navigation/types';
import { isAlarmModuleAvailable, statusLabel } from '../services/alarmService';
import type { Alarm, Settings } from '../types';
import { formatClock, formatHM, formatShortDate } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function alarmRule(a: Alarm, settings: Settings): string {
  const off = (m: number) => {
    const abs = Math.abs(m);
    const h = Math.floor(abs / 60);
    const mm = abs % 60;
    const txt = h ? (mm ? `${h} h ${mm} min` : `${h} h`) : `${mm} min`;
    return { txt, after: m < 0 };
  };
  switch (a.mode) {
    case 'fixed':
      return `Heure fixe · ${formatClock(a.hour, a.minute, settings.use24h)}`;
    case 'beforeSunrise': {
      const o = off(a.offsetMinutes);
      return `${o.txt} ${o.after ? 'après' : 'avant'} le lever du soleil`;
    }
    case 'beforeDawn': {
      const o = off(a.offsetMinutes);
      return `${o.txt} ${o.after ? 'après' : 'avant'} l'${SOLAR_EVENT_LABELS[settings.dawnReference].toLowerCase()}`;
    }
    case 'solarEvent': {
      const o = off(a.offsetMinutes);
      if (a.offsetMinutes === 0) return `À l'événement : ${SOLAR_EVENT_LABELS[a.solarEvent]}`;
      return `${o.txt} ${o.after ? 'après' : 'avant'} : ${SOLAR_EVENT_LABELS[a.solarEvent]}`;
    }
  }
}

export default function AlarmsScreen() {
  const nav = useNavigation<Nav>();
  const { alarms, statuses, settings, saveAlarm, permissions } = useAppStore();
  const problem = permissions && (!permissions.exactAlarms || !permissions.notifications || !permissions.fullScreenIntent);

  const add = async () => {
    const id = await saveAlarm({ ...DEFAULT_ALARM, label: `Réveil ${alarms.length + 1}`, programId: settings.activeProgramId });
    nav.navigate('AlarmeEdition', { id });
  };

  return (
    <Screen>
      {!isAlarmModuleAvailable && (
        <Card style={{ borderColor: colors.warning }}>
          <Hint tone="warn">
            Le module d'alarme Android n'est pas chargé (Expo Go ou web). Installez l'APK de l'application pour que les
            réveils sonnent réellement.
          </Hint>
        </Card>
      )}
      {problem && (
        <Card style={{ borderColor: colors.warning }}>
          <Hint tone="warn">Certaines autorisations Android manquent : les réveils pourraient ne pas sonner.</Hint>
          <Button title="Vérifier les autorisations" icon="shield-checkmark-outline" variant="ghost" onPress={() => nav.navigate('Autorisations')} />
        </Card>
      )}

      {alarms.map((a) => {
        const st = statuses[a.id];
        const label = statusLabel(a, st);
        const next = st?.nextTriggerAt ? new Date(st.nextTriggerAt) : null;
        return (
          <Pressable key={a.id} onPress={() => nav.navigate('AlarmeEdition', { id: a.id })} accessibilityRole="button" accessibilityLabel={`Modifier ${a.label}`}>
            <Card style={[s.card, !a.enabled && { opacity: 0.7 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.time}>
                  {a.mode === 'fixed' ? formatClock(a.hour, a.minute, settings.use24h) : next ? formatHM(next, settings.use24h) : '—'}
                </Text>
                <Text style={s.label}>{a.label}</Text>
                <Text style={s.meta}>{alarmRule(a, settings)}</Text>
                <Text style={s.meta}>{daysSummary(a.days)}</Text>
                {next && a.enabled && (
                  <Text style={s.meta}>
                    Prochain : {formatShortDate(next)} à {formatHM(next, settings.use24h)}
                  </Text>
                )}
                <View style={{ marginTop: spacing.sm }}>
                  <StatusPill text={label.text} tone={label.tone} />
                </View>
              </View>
              <Switch
                value={a.enabled}
                onValueChange={(enabled) => {
                  saveAlarm({ ...a, enabled });
                }}
                accessibilityLabel={`Activer ${a.label}`}
                trackColor={{ false: colors.line, true: colors.goldSoft }}
                thumbColor={a.enabled ? colors.gold : colors.textMuted}
              />
            </Card>
          </Pressable>
        );
      })}
      {alarms.length === 0 && <Hint>Aucun réveil. Ajoutez-en un ci-dessous.</Hint>}
      <Button title="Ajouter un réveil" icon="add" onPress={add} />
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start' },
  time: { color: colors.white, fontSize: 40, fontWeight: '300', fontVariant: ['tabular-nums'] },
  label: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
});
