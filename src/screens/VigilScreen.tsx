import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chips, Hint, Screen, SectionTitle } from '../components/ui';
import { colors, font, radius, spacing } from '../constants/theme';
import { insertSession } from '../database/repositories';
import { type ActiveVigil, useAppStore } from '../hooks/useAppStore';
import { useNow } from '../hooks/useNow';
import { hideVigilNotification, showVigilNotification } from '../services/notificationService';
import { buildSchedule, progressAt, type ScheduledStep } from '../services/prayerService';
import { formatCountdown, formatDuration, formatH, formatMinutes } from '../utils/format';

const KEEP_AWAKE_TAG = 'veille';

function stepsToSchedule(v: ActiveVigil): ScheduledStep[] {
  let offset = 0;
  return v.steps.map((st, i) => {
    const s: ScheduledStep = {
      activity: {
        id: st.activityId,
        programId: v.programId ?? 0,
        position: i,
        title: st.title,
        durationMinutes: st.seconds / 60,
        enabled: true,
        bibleReference: st.bibleReference,
        prayerTopics: st.prayerTopics,
      },
      seconds: st.seconds,
      startOffset: offset,
      start: new Date(v.startedAt + offset * 1000),
      end: new Date(v.startedAt + (offset + st.seconds) * 1000),
    };
    offset += st.seconds;
    return s;
  });
}

function realElapsedMs(v: ActiveVigil, now: number) {
  return (v.pausedAt ?? now) - v.startedAt - v.pausedAccumMs;
}

export default function VigilScreen() {
  const db = useSQLiteContext();
  const { vigil, setVigil, programs, settings, reloadSessions, updateSettings } = useAppStore();
  const now = useNow();
  const [summary, setSummary] = useState<{ status: 'completed' | 'interrupted'; seconds: number; name: string } | null>(
    null,
  );
  const ending = useRef(false);

  const program = programs.find((p) => p.id === settings.activeProgramId) ?? programs[0];
  const target = settings.scaleProgramToDuration ? settings.prayerDurationMinutes : null;

  // Écran allumé pendant la veille si demandé.
  useEffect(() => {
    if (vigil && settings.keepScreenOn) {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      return () => {
        deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      };
    }
    return undefined;
  }, [vigil, settings.keepScreenOn]);

  const schedule = useMemo(() => (vigil ? stepsToSchedule(vigil) : []), [vigil]);
  const realMs = vigil ? realElapsedMs(vigil, now.getTime()) : 0;
  const progElapsed = vigil ? Math.floor((realMs + vigil.skipAdjustMs) / 1000) : 0;
  const progress = progressAt(schedule, progElapsed);
  const paused = !!vigil?.pausedAt;

  // Notification persistante : mise à jour à chaque changement d'étape / pause.
  useEffect(() => {
    if (!vigil || !settings.showVigilNotification || progress.finished) {
      hideVigilNotification();
      return;
    }
    const step = schedule[progress.index];
    if (!step) return;
    if (paused) {
      showVigilNotification('Veille en pause', step.activity.title, new Date());
      return;
    }
    showVigilNotification(
      `Étape ${progress.index + 1}/${schedule.length} · ${step.activity.title}`,
      step.activity.bibleReference || 'Veille matinale en cours',
      new Date(Date.now() + progress.remainingInStep * 1000),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vigil?.startedAt, progress.index, paused, settings.showVigilNotification, vigil?.skipAdjustMs]);

  const finish = async (status: 'completed' | 'interrupted') => {
    if (!vigil || ending.current) return;
    ending.current = true;
    const endedAt = Date.now();
    const actual = Math.round(realElapsedMs(vigil, endedAt) / 1000);
    const total = schedule.reduce((t, s) => t + s.seconds, 0);
    const p = progressAt(schedule, Math.floor((realElapsedMs(vigil, endedAt) + vigil.skipAdjustMs) / 1000));
    await insertSession(db, {
      programId: vigil.programId,
      programName: vigil.programName,
      startedAt: vigil.startedAt,
      endedAt,
      plannedSeconds: total,
      actualSeconds: Math.max(0, actual),
      status,
      stepsCompleted: p.finished ? schedule.length : p.index,
      stepsTotal: schedule.length,
    });
    hideVigilNotification();
    await setVigil(null);
    await reloadSessions();
    setSummary({ status, seconds: actual, name: vigil.programName });
    ending.current = false;
  };

  useEffect(() => {
    if (vigil && progress.finished && !paused) finish('completed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.finished, vigil]);

  // ------------------------------------------------------------- Préparation
  if (!vigil) {
    const preview = program ? buildSchedule(program.activities, now, target) : [];
    const total = preview.reduce((t, s) => t + s.seconds, 0);
    return (
      <Screen>
        {summary && (
          <Card style={{ borderColor: summary.status === 'completed' ? colors.gold : colors.line }}>
            <Ionicons
              name={summary.status === 'completed' ? 'checkmark-circle' : 'pause-circle'}
              size={36}
              color={summary.status === 'completed' ? colors.gold : colors.textMuted}
            />
            <Text style={s.title}>{summary.status === 'completed' ? 'Veille terminée' : 'Veille interrompue'}</Text>
            <Text style={s.muted}>
              {summary.name} · {formatDuration(summary.seconds)} de prière. Enregistrée dans l'historique.
            </Text>
          </Card>
        )}
        <SectionTitle>Programme</SectionTitle>
        {programs.length > 1 && (
          <Chips
            options={programs.map((p) => p.id)}
            value={program?.id ?? null}
            format={(id) => programs.find((p) => p.id === id)?.name ?? ''}
            onChange={(id) => updateSettings({ activeProgramId: id })}
          />
        )}
        <Card style={{ marginTop: spacing.md }}>
          <Text style={s.title}>{program?.name ?? 'Aucun programme'}</Text>
          <Text style={s.muted}>
            Durée : {formatMinutes(total / 60)}
            {target ? ' (adaptée à la durée de prière choisie)' : ''}
          </Text>
          {preview.map((st) => (
            <View key={st.activity.id} style={s.previewRow}>
              <Text style={s.previewTime}>
                {formatH(st.start)}–{formatH(st.end)}
              </Text>
              <Text style={s.previewTitle}>{st.activity.title}</Text>
            </View>
          ))}
          {preview.length === 0 && <Hint tone="warn">Ce programme ne contient aucune étape active.</Hint>}
        </Card>
        <Button
          title="COMMENCER MA VEILLE"
          icon="flame-outline"
          big
          disabled={!program || preview.length === 0}
          onPress={() => {
            setSummary(null);
            const startedAt = Date.now();
            setVigil({
              programId: program!.id,
              programName: program!.name,
              startedAt,
              steps: preview.map((p) => ({
                activityId: p.activity.id,
                title: p.activity.title,
                seconds: p.seconds,
                bibleReference: p.activity.bibleReference,
                prayerTopics: p.activity.prayerTopics,
              })),
              pausedAccumMs: 0,
              pausedAt: null,
              skipAdjustMs: 0,
              alarmId: null,
            });
          }}
        />
      </Screen>
    );
  }

  // ------------------------------------------------------------- Veille en cours
  const step = schedule[progress.index];
  const stepRatio = step ? progress.elapsedInStep / Math.max(1, step.seconds) : 1;
  const totalRatio = progress.totalSeconds ? Math.min(1, progress.totalElapsed / progress.totalSeconds) : 1;

  return (
    <Screen>
      <Text style={s.kicker}>
        {vigil.programName} · étape {Math.max(1, progress.index + 1)}/{schedule.length}
      </Text>
      {step && (
        <Card style={s.current}>
          <Text style={s.stepTitle} accessibilityRole="header">
            {step.activity.title}
          </Text>
          <Text style={s.timer} accessibilityLabel={`Temps restant pour cette étape : ${formatCountdown(progress.remainingInStep)}`}>
            {formatCountdown(progress.remainingInStep)}
          </Text>
          <View style={s.bar}>
            <View style={[s.barFill, { width: `${Math.round(stepRatio * 100)}%` }]} />
          </View>
          {paused && <Text style={[s.muted, { color: colors.warning, marginTop: spacing.sm }]}>En pause</Text>}
          {step.activity.bibleReference ? (
            <View style={s.extra}>
              <Ionicons name="book-outline" size={18} color={colors.gold} />
              <Text style={s.extraText}>{step.activity.bibleReference}</Text>
            </View>
          ) : null}
          {step.activity.prayerTopics ? (
            <View style={s.extra}>
              <Ionicons name="heart-outline" size={18} color={colors.gold} />
              <Text style={s.extraText}>{step.activity.prayerTopics}</Text>
            </View>
          ) : null}
        </Card>
      )}

      <View style={s.totalRow}>
        <Text style={s.muted}>Écoulé {formatCountdown(progress.totalElapsed)}</Text>
        <Text style={s.muted}>Reste {formatCountdown(progress.totalSeconds - progress.totalElapsed)}</Text>
      </View>
      <View style={[s.bar, { marginBottom: spacing.lg }]}>
        <View style={[s.barFill, { width: `${Math.round(totalRatio * 100)}%`, backgroundColor: colors.goldSoft }]} />
      </View>

      <View style={s.controls}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Button
            title={paused ? 'Reprendre' : 'Pause'}
            icon={paused ? 'play' : 'pause'}
            variant="secondary"
            onPress={() => {
              const t = Date.now();
              if (paused) setVigil({ ...vigil, pausedAccumMs: vigil.pausedAccumMs + (t - vigil.pausedAt!), pausedAt: null });
              else setVigil({ ...vigil, pausedAt: t });
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Étape suivante"
            icon="play-skip-forward"
            variant="secondary"
            disabled={paused}
            onPress={() => setVigil({ ...vigil, skipAdjustMs: vigil.skipAdjustMs + progress.remainingInStep * 1000 })}
          />
        </View>
      </View>
      <Button
        title="Terminer la veille"
        icon="stop-circle-outline"
        variant="danger"
        onPress={() =>
          Alert.alert('Terminer la veille ?', 'La séance sera enregistrée comme interrompue.', [
            { text: 'Continuer', style: 'cancel' },
            { text: 'Terminer', style: 'destructive', onPress: () => finish('interrupted') },
          ])
        }
      />

      <SectionTitle>Déroulement</SectionTitle>
      <Card>
        {schedule.map((st, i) => {
          const done = i < progress.index || progress.finished;
          const active = i === progress.index;
          return (
            <View key={`${st.activity.id}-${i}`} style={s.listRow}>
              <Ionicons
                name={done ? 'checkmark-circle' : active ? 'radio-button-on' : 'ellipse-outline'}
                size={20}
                color={done || active ? colors.gold : colors.textFaint}
              />
              <Text style={[s.listTitle, active && { color: colors.white, fontWeight: '700' }, done && { color: colors.textMuted }]}>
                {st.activity.title}
              </Text>
              <Text style={s.listDur}>{formatMinutes(st.seconds / 60)}</Text>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { color: colors.text, fontSize: font.title, fontWeight: '700', marginTop: spacing.xs },
  muted: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  kicker: { color: colors.gold, fontSize: font.small, letterSpacing: 1, textAlign: 'center', marginBottom: spacing.md },
  current: { alignItems: 'center', paddingVertical: spacing.xl, borderColor: colors.goldSoft },
  stepTitle: { color: colors.white, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  timer: { color: colors.gold, fontSize: 64, fontWeight: '200', fontVariant: ['tabular-nums'], marginVertical: spacing.md },
  bar: { height: 6, backgroundColor: colors.deepRaised, borderRadius: radius.pill, overflow: 'hidden', alignSelf: 'stretch' },
  barFill: { height: 6, backgroundColor: colors.gold },
  extra: { flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch', marginTop: spacing.md },
  extraText: { color: colors.text, fontSize: font.body, marginLeft: spacing.sm, flex: 1, lineHeight: 21 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  controls: { flexDirection: 'row' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  listTitle: { color: colors.text, flex: 1, marginLeft: spacing.sm },
  listDur: { color: colors.textMuted, fontSize: font.small },
  previewRow: { flexDirection: 'row', marginTop: spacing.sm },
  previewTime: { color: colors.gold, width: 112, fontVariant: ['tabular-nums'] },
  previewTitle: { color: colors.text, flex: 1 },
});
