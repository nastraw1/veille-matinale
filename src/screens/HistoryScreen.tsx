import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Card, Chips, Hint, IconButton, Screen, SectionTitle } from '../components/ui';
import { colors, font, radius, spacing } from '../constants/theme';
import { deleteSession } from '../database/repositories';
import { useAppStore } from '../hooks/useAppStore';
import { bestStreak, currentStreak, startOfMonth, startOfWeek, statsBetween, type PeriodStats } from '../services/prayerService';
import { formatDuration, formatH, formatLongDate, monthName } from '../utils/format';

type Period = 'semaine' | 'mois';

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const { sessions, reloadSessions } = useAppStore();
  const [period, setPeriod] = useState<Period>('semaine');
  const now = new Date();

  const streak = currentStreak(sessions, now);
  const best = bestStreak(sessions);

  const { stats, bars, title } = useMemo(() => {
    if (period === 'semaine') {
      const from = startOfWeek(now);
      const to = new Date(from.getTime() + 7 * 86_400_000);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d0 = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
        const d1 = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i + 1);
        return { label: ['L', 'M', 'M', 'J', 'V', 'S', 'D'][i], seconds: statsBetween(sessions, d0, d1).totalSeconds };
      });
      return { stats: statsBetween(sessions, from, to), bars: days, title: 'Cette semaine' };
    }
    const from = startOfMonth(now);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    const weeks: { label: string; seconds: number }[] = [];
    for (let w = startOfWeek(from); w < to; w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)) {
      const end = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7);
      weeks.push({ label: `S${weeks.length + 1}`, seconds: statsBetween(sessions, w < from ? from : w, end > to ? to : end).totalSeconds });
    }
    return { stats: statsBetween(sessions, from, to), bars: weeks, title: `${monthName(now.getMonth())} ${now.getFullYear()}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, period]);

  const max = Math.max(1, ...bars.map((b) => b.seconds));

  // Regroupement par jour.
  const groups = useMemo(() => {
    const map = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const k = new Date(s.startedAt).toDateString();
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()].slice(0, 60);
  }, [sessions]);

  return (
    <Screen>
      <View style={s.streaks}>
        <Card style={s.streakCard}>
          <Ionicons name="flame" size={24} color={colors.gold} />
          <Text style={s.big}>{streak}</Text>
          <Text style={s.small}>jour{streak > 1 ? 's' : ''} consécutif{streak > 1 ? 's' : ''}</Text>
        </Card>
        <Card style={s.streakCard}>
          <Ionicons name="trophy-outline" size={24} color={colors.gold} />
          <Text style={s.big}>{best}</Text>
          <Text style={s.small}>meilleure série</Text>
        </Card>
      </View>

      <Chips options={['semaine', 'mois'] as const} value={period} onChange={setPeriod} format={(p) => (p === 'semaine' ? 'Semaine' : 'Mois')} />
      <Card style={{ marginTop: spacing.md }}>
        <Text style={s.cardTitle}>{title.charAt(0).toUpperCase() + title.slice(1)}</Text>
        <StatsGrid st={stats} />
        <View style={s.chart} accessibilityLabel="Temps de prière par période">
          {bars.map((b, i) => (
            <View key={i} style={s.barCol}>
              <View style={s.barTrack}>
                <View style={[s.bar, { height: `${Math.round((b.seconds / max) * 100)}%` }]} />
              </View>
              <Text style={s.barLabel}>{b.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <SectionTitle>Séances</SectionTitle>
      {groups.length === 0 && <Hint>Aucune séance enregistrée pour l'instant. Vos veilles apparaîtront ici.</Hint>}
      {groups.map(([day, list]) => (
        <Card key={day}>
          <Text style={s.day}>{formatLongDate(new Date(list[0].startedAt))}</Text>
          {list.map((x) => (
            <View key={x.id} style={s.sessionRow}>
              <Ionicons
                name={x.status === 'completed' ? 'checkmark-circle' : 'pause-circle-outline'}
                size={22}
                color={x.status === 'completed' ? colors.gold : colors.textMuted}
              />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={s.sessionTitle}>
                  {formatH(new Date(x.startedAt))} · {x.programName}
                </Text>
                <Text style={s.small}>
                  {x.status === 'completed' ? 'Terminée' : 'Interrompue'} · {formatDuration(x.actualSeconds)} sur{' '}
                  {formatDuration(x.plannedSeconds)} · {x.stepsCompleted}/{x.stepsTotal} étapes
                </Text>
              </View>
              <IconButton
                icon="trash-outline"
                label="Supprimer cette séance"
                onPress={() =>
                  Alert.alert('Supprimer cette séance ?', '', [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Supprimer',
                      style: 'destructive',
                      onPress: async () => {
                        await deleteSession(db, x.id);
                        await reloadSessions();
                      },
                    },
                  ])
                }
              />
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

function StatsGrid({ st }: { st: PeriodStats }) {
  const items = [
    { v: String(st.sessions), l: 'séances' },
    { v: String(st.completed), l: 'terminées' },
    { v: String(st.interrupted), l: 'interrompues' },
    { v: formatDuration(st.totalSeconds), l: 'de prière' },
    { v: String(st.activeDays), l: 'jours actifs' },
  ];
  return (
    <View style={s.grid}>
      {items.map((i) => (
        <View key={i.l} style={s.gridItem}>
          <Text style={s.gridValue}>{i.v}</Text>
          <Text style={s.small}>{i.l}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  streaks: { flexDirection: 'row', gap: spacing.md },
  streakCard: { flex: 1, alignItems: 'center' },
  big: { color: colors.white, fontSize: 36, fontWeight: '300' },
  small: { color: colors.textMuted, fontSize: font.small },
  cardTitle: { color: colors.text, fontSize: font.heading, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  gridItem: { width: '33%', paddingVertical: spacing.sm },
  gridValue: { color: colors.gold, fontSize: font.heading, fontWeight: '700' },
  chart: { flexDirection: 'row', height: 110, marginTop: spacing.md, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { width: 18, height: 90, justifyContent: 'flex-end', backgroundColor: colors.deepRaised, borderRadius: radius.sm, overflow: 'hidden' },
  bar: { width: '100%', backgroundColor: colors.gold, borderRadius: radius.sm },
  barLabel: { color: colors.textMuted, fontSize: font.tiny, marginTop: 4 },
  day: { color: colors.gold, fontSize: font.small, fontWeight: '700', marginBottom: spacing.xs },
  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  sessionTitle: { color: colors.text, fontSize: font.body },
});
