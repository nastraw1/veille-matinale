import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Hint, Screen, StatusPill } from '../components/ui';
import { SOLAR_EVENT_LABELS } from '../constants/defaults';
import { colors, font, spacing } from '../constants/theme';
import { useAppStore } from '../hooks/useAppStore';
import { useNow } from '../hooks/useNow';
import { useSolarTimes } from '../hooks/useSolarTimes';
import { statusLabel } from '../services/alarmService';
import { buildSchedule, startDateFor } from '../services/prayerService';
import { nextTrigger } from '../services/solarService';
import type { RootStackParamList } from '../navigation/types';
import { formatClock, formatCountdown, formatH, formatHM, formatIn, formatLongDate, formatMinutes } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { settings, location, alarms, statuses, programs, permissions, vigil } = useAppStore();
  const now = useNow();
  const { morning, nextSunrise } = useSolarTimes(now, location, settings.dawnReference);
  const use24 = settings.use24h;
  const mode = settings.appMode;

  const program = programs.find((p) => p.id === settings.activeProgramId) ?? programs[0];

  // Prochain réveil : on privilégie l'instant réellement programmé par Android.
  const nextAlarm = useMemo(() => {
    const minute = new Date(Math.floor(now.getTime() / 60000) * 60000);
    let best: { alarmId: number; at: Date } | null = null;
    for (const a of alarms.filter((x) => x.enabled)) {
      const st = statuses[a.id];
      const at = st?.nextTriggerAt
        ? new Date(st.nextTriggerAt)
        : nextTrigger(a, minute, location.latitude, location.longitude, settings.dawnReference)?.at;
      if (at && (!best || at < best.at)) best = { alarmId: a.id, at };
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarms, statuses, location, settings.dawnReference, Math.floor(now.getTime() / 60000)]);

  const nextAlarmObj = nextAlarm ? alarms.find((a) => a.id === nextAlarm.alarmId) : undefined;
  const status = nextAlarmObj ? statusLabel(nextAlarmObj, statuses[nextAlarmObj.id]) : null;
  const permissionProblem = permissions && (!permissions.exactAlarms || !permissions.notifications);

  const secondsToSunrise = nextSunrise ? (nextSunrise.getTime() - now.getTime()) / 1000 : null;
  const dawn = morning[settings.dawnReference];

  const schedule = useMemo(
    () =>
      program
        ? buildSchedule(
            program.activities,
            startDateFor(settings.startHour, settings.startMinute),
            settings.scaleProgramToDuration ? settings.prayerDurationMinutes : null,
          )
        : [],
    [program, settings.startHour, settings.startMinute, settings.scaleProgramToDuration, settings.prayerDurationMinutes],
  );

  const showClock = mode !== 'program';
  const showAlarm = mode === 'complete';
  const showProgram = mode !== 'clock';

  return (
    <Screen>
      <View style={s.header}>
        <Text style={s.brand} accessibilityRole="header">
          VEILLE MATINALE
        </Text>
        <Pressable
          onPress={() => nav.navigate('Localisation')}
          accessibilityRole="button"
          accessibilityLabel={`Ville : ${location.name}. Modifier la localisation`}
          style={s.cityRow}
        >
          <Ionicons name="location-outline" size={16} color={colors.textMuted} />
          <Text style={s.city}>
            {location.name}
            {location.country ? `, ${location.country}` : ''}
          </Text>
        </Pressable>
      </View>

      {showClock && (
        <View style={s.clockBlock} accessible accessibilityLabel={`Il est ${formatHM(now, use24)}`}>
          <Text style={s.clock} adjustsFontSizeToFit numberOfLines={1}>
            {formatHM(now, use24)}
            <Text style={s.seconds}>:{String(now.getSeconds()).padStart(2, '0')}</Text>
          </Text>
          <Text style={s.date}>{formatLongDate(now)}</Text>
        </View>
      )}

      {vigil && (
        <Card style={{ borderColor: colors.gold }}>
          <Text style={s.cardTitle}>Une veille est en cours</Text>
          <Button title="Reprendre ma veille" icon="play" onPress={() => nav.navigate('Tabs', { screen: 'Veille' })} />
        </Card>
      )}

      {showClock && (
        <Card>
          <View style={s.sunRow}>
            <SunCell icon="partly-sunny-outline" label={shortDawn(settings.dawnReference)} value={formatHM(dawn, use24)} />
            <SunCell icon="sunny-outline" label="Lever du soleil" value={formatHM(morning.sunrise, use24)} highlight />
          </View>
          <View style={s.countdown}>
            <Text style={s.countLabel}>Lever du soleil dans</Text>
            <Text style={s.countValue} accessibilityLiveRegion="none">
              {secondsToSunrise != null ? formatCountdown(secondsToSunrise) : '—'}
            </Text>
          </View>
          {morning.warnings.map((w) => (
            <Hint key={w} tone="warn">
              {w}
            </Hint>
          ))}
        </Card>
      )}

      {showAlarm && (
        <Card>
          <Pressable onPress={() => nav.navigate('Alarmes')} accessibilityRole="button" accessibilityLabel="Gérer les réveils">
            <View style={s.alarmHead}>
              <Text style={s.cardTitle}>Réveil programmé</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </View>
            {nextAlarm && nextAlarmObj ? (
              <>
                <Text style={s.alarmTime}>{formatHM(nextAlarm.at, use24)}</Text>
                <Text style={s.muted}>
                  {nextAlarmObj.label} · {formatIn(nextAlarm.at.getTime() - now.getTime())}
                </Text>
                {status && (
                  <View style={{ marginTop: spacing.sm }}>
                    <StatusPill text={status.text} tone={status.tone} />
                  </View>
                )}
              </>
            ) : (
              <Text style={s.muted}>Aucun réveil actif. Touchez pour en programmer un.</Text>
            )}
          </Pressable>
          {permissionProblem && (
            <Button
              title="Corriger les autorisations"
              icon="warning-outline"
              variant="ghost"
              onPress={() => nav.navigate('Autorisations')}
            />
          )}
        </Card>
      )}

      {showProgram && program && (
        <Card>
          <View style={s.alarmHead}>
            <Text style={s.cardTitle}>Durée de prière</Text>
            <Text style={s.gold}>{formatMinutes(schedule.reduce((t, x) => t + x.seconds, 0) / 60)}</Text>
          </View>
          <Text style={s.muted}>
            {program.name} · début {formatClock(settings.startHour, settings.startMinute, use24)}
          </Text>
          {mode === 'program' &&
            schedule.map((st) => (
              <View key={st.activity.id} style={s.stepRow}>
                <Text style={s.stepTime}>
                  {formatH(st.start)}–{formatH(st.end)}
                </Text>
                <Text style={s.stepTitle} numberOfLines={2}>
                  {st.activity.title}
                </Text>
              </View>
            ))}
        </Card>
      )}

      {showProgram && (
        <Button
          title="COMMENCER MA VEILLE"
          icon="flame-outline"
          big
          onPress={() => nav.navigate('Tabs', { screen: 'Veille' })}
        />
      )}
      <Button
        title="PARAMÈTRES"
        icon="settings-outline"
        variant="secondary"
        onPress={() => nav.navigate('Tabs', { screen: 'Parametres' })}
      />
    </Screen>
  );
}

function shortDawn(k: keyof typeof SOLAR_EVENT_LABELS) {
  return SOLAR_EVENT_LABELS[k].replace(/ \(.*\)/, '');
}

function SunCell({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={s.sunCell} accessible accessibilityLabel={`${label} : ${value}`}>
      <Ionicons name={icon} size={22} color={colors.gold} />
      <Text style={s.sunLabel}>{label}</Text>
      <Text style={[s.sunValue, highlight && { color: colors.gold }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { alignItems: 'center', marginTop: spacing.sm },
  brand: { color: colors.gold, fontSize: font.heading, fontWeight: '800', letterSpacing: 4 },
  cityRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, padding: spacing.xs },
  city: { color: colors.textMuted, fontSize: font.body, marginLeft: 4 },
  clockBlock: { alignItems: 'center', marginVertical: spacing.lg },
  clock: { color: colors.white, fontSize: 76, fontWeight: '200', fontVariant: ['tabular-nums'] },
  seconds: { fontSize: 30, color: colors.textMuted },
  date: { color: colors.text, fontSize: font.body, marginTop: -4 },
  sunRow: { flexDirection: 'row' },
  sunCell: { flex: 1, alignItems: 'center' },
  sunLabel: { color: colors.textMuted, fontSize: font.small, marginTop: 4 },
  sunValue: { color: colors.white, fontSize: 30, fontWeight: '300', fontVariant: ['tabular-nums'] },
  countdown: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    alignItems: 'center',
  },
  countLabel: { color: colors.textMuted, fontSize: font.small },
  countValue: { color: colors.gold, fontSize: 32, fontWeight: '300', fontVariant: ['tabular-nums'] },
  cardTitle: { color: colors.text, fontSize: font.heading, fontWeight: '700' },
  alarmHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alarmTime: { color: colors.white, fontSize: 40, fontWeight: '300', marginTop: spacing.xs, fontVariant: ['tabular-nums'] },
  muted: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  gold: { color: colors.gold, fontSize: font.heading, fontWeight: '700' },
  stepRow: { flexDirection: 'row', marginTop: spacing.sm },
  stepTime: { color: colors.gold, width: 112, fontVariant: ['tabular-nums'] },
  stepTitle: { color: colors.text, flex: 1 },
});
