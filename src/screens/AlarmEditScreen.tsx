import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TimeField } from '../components/TimeField';
import { Button, Card, Chips, DaySelector, Field, Hint, Label, Screen, SectionTitle, Stepper, ToggleRow } from '../components/ui';
import { RING_PRESETS, SNOOZE_PRESETS, SOLAR_EVENT_LABELS } from '../constants/defaults';
import { colors, font, spacing } from '../constants/theme';
import { useAppStore } from '../hooks/useAppStore';
import type { RootStackParamList } from '../navigation/types';
import type { AlarmSound } from '../../modules/veille-alarm';
import { listSounds, previewSound, stopPreview } from '../services/alarmService';
import { upcomingTriggers } from '../services/solarService';
import type { Alarm, AlarmMode, SolarEventKey } from '../types';
import { formatHM, formatShortDate } from '../utils/format';

const MODES: AlarmMode[] = ['fixed', 'beforeSunrise', 'beforeDawn', 'solarEvent'];
const MODE_LABEL: Record<AlarmMode, string> = {
  fixed: 'Heure fixe',
  beforeSunrise: 'Avant le lever',
  beforeDawn: "Avant l'aube",
  solarEvent: 'Événement solaire',
};
const OFFSET_PRESETS = [0, 30, 60, 90, 120, 150, 180];
const DAWNS: Exclude<SolarEventKey, 'sunrise'>[] = ['civilDawn', 'nauticalDawn', 'astronomicalDawn'];
const EVENTS: SolarEventKey[] = ['sunrise', 'civilDawn', 'nauticalDawn', 'astronomicalDawn'];

export default function AlarmEditScreen() {
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'AlarmeEdition'>>();
  const { alarms, saveAlarm, deleteAlarm, settings, updateSettings, location, programs, statuses } = useAppStore();
  const original = alarms.find((a) => a.id === params.id);
  const [a, setA] = useState<Alarm | undefined>(original);
  const [sounds, setSounds] = useState<AlarmSound[] | null>(null);
  const [previewing, setPreviewing] = useState<string | null | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(a);
  latest.current = a;

  useEffect(() => () => stopPreview(), []);

  // Sauvegarde automatique + reprogrammation Android après chaque modification.
  const update = (patch: Partial<Alarm>) => {
    setA((x) => (x ? { ...x, ...patch } : x));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (latest.current) saveAlarm(latest.current);
    }, 400);
  };
  useEffect(
    () => () => {
      if (timer.current && latest.current) {
        clearTimeout(timer.current);
        saveAlarm(latest.current);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const preview = useMemo(
    () =>
      a ? upcomingTriggers(a, new Date(), location.latitude, location.longitude, settings.dawnReference, 8).slice(0, 3) : [],
    [a, location, settings.dawnReference],
  );

  if (!a) {
    return (
      <Screen>
        <Hint>Ce réveil n'existe plus.</Hint>
      </Screen>
    );
  }

  const solar = a.mode !== 'fixed';
  const st = statuses[a.id];
  const signed = a.mode === 'solarEvent';
  const after = a.offsetMinutes < 0;

  return (
    <Screen>
      <Card>
        <Field label="Nom du réveil" value={a.label} onChangeText={(label) => update({ label })} maxLength={50} />
        <ToggleRow title="Réveil activé" value={a.enabled} onChange={(enabled) => update({ enabled })} icon="alarm-outline" />
      </Card>

      <SectionTitle>Mode de calcul</SectionTitle>
      <Card>
        <Chips options={MODES} value={a.mode} format={(m) => MODE_LABEL[m]} onChange={(mode) => update({ mode })} />

        {a.mode === 'fixed' && (
          <View style={{ marginTop: spacing.lg }}>
            <TimeField label="Heure de réveil" hour={a.hour} minute={a.minute} use24h={settings.use24h} onChange={(hour, minute) => update({ hour, minute })} />
          </View>
        )}

        {a.mode === 'beforeDawn' && (
          <View style={{ marginTop: spacing.lg }}>
            <Label>Aube de référence</Label>
            <Chips options={DAWNS} value={settings.dawnReference} format={(k) => SOLAR_EVENT_LABELS[k]} onChange={(dawnReference) => updateSettings({ dawnReference })} />
            <Hint>Réglage commun à l'écran d'accueil et à tous les réveils « avant l'aube ».</Hint>
          </View>
        )}

        {a.mode === 'solarEvent' && (
          <View style={{ marginTop: spacing.lg }}>
            <Label>Événement solaire</Label>
            <Chips options={EVENTS} value={a.solarEvent} format={(k) => SOLAR_EVENT_LABELS[k]} onChange={(solarEvent) => update({ solarEvent })} />
            <View style={{ marginTop: spacing.md }}>
              <Chips
                options={['avant', 'après'] as const}
                value={after ? 'après' : 'avant'}
                onChange={(v) => update({ offsetMinutes: (v === 'après' ? -1 : 1) * Math.abs(a.offsetMinutes) })}
              />
            </View>
          </View>
        )}

        {solar && (
          <View style={{ marginTop: spacing.lg }}>
            <Label>Décalage {signed ? (after ? 'après' : 'avant') : 'avant'} l'événement</Label>
            <Chips
              options={OFFSET_PRESETS}
              value={OFFSET_PRESETS.includes(Math.abs(a.offsetMinutes)) ? Math.abs(a.offsetMinutes) : null}
              format={(m) => (m === 0 ? '0' : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60) ? Math.floor(m / 60) + ' h ' : ''}${m % 60} min`)}
              onChange={(m) => update({ offsetMinutes: (signed && after ? -1 : 1) * m })}
            />
            <View style={{ marginTop: spacing.md }}>
              <Stepper
                value={Math.abs(a.offsetMinutes)}
                onChange={(m) => update({ offsetMinutes: (signed && after ? -1 : 1) * m })}
                min={0}
                max={720}
                step={5}
                label="décalage"
              />
            </View>
            <Label muted>Heure de secours</Label>
            <TimeField label="Heure de secours" hour={a.hour} minute={a.minute} use24h={settings.use24h} onChange={(hour, minute) => update({ hour, minute })} />
            <Hint>Utilisée uniquement si l'événement solaire ne peut pas être calculé (latitudes extrêmes).</Hint>
          </View>
        )}

        <View style={s.preview}>
          <Text style={s.previewTitle}>Prochains réveils · {location.name}</Text>
          {preview.map((p) => (
            <Text key={p.at.getTime()} style={s.previewLine}>
              {formatShortDate(p.at)} à {formatHM(p.at, settings.use24h)}
              {p.fallback ? ' (heure de secours)' : ''}
            </Text>
          ))}
          {st && !st.scheduled && a.enabled && <Hint tone="warn">Android n'a pas encore accepté ce réveil : vérifiez les autorisations.</Hint>}
        </View>
      </Card>

      <SectionTitle>Jours</SectionTitle>
      <Card>
        <DaySelector days={a.days} onChange={(days) => update({ days })} />
      </Card>

      <SectionTitle>Sonnerie</SectionTitle>
      <Card>
        <ToggleRow title="Vibreur" value={a.vibrate} onChange={(vibrate) => update({ vibrate })} icon="phone-portrait-outline" />
        <Pressable
          onPress={async () => setSounds(sounds ? null : await listSounds())}
          style={s.soundHead}
          accessibilityRole="button"
          accessibilityLabel="Choisir la sonnerie"
        >
          <Ionicons name="musical-notes-outline" size={20} color={colors.gold} />
          <Text style={s.soundName}>{a.soundName ?? 'Sonnerie d’alarme par défaut'}</Text>
          <Ionicons name={sounds ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
        </Pressable>
        {sounds && (
          <View>
            {[{ title: 'Sonnerie d’alarme par défaut', uri: null as string | null }, ...sounds].map((snd) => {
              const selected = (a.soundUri ?? null) === snd.uri;
              const playing = previewing === snd.uri;
              return (
                <View key={snd.uri ?? 'default'} style={s.soundRow}>
                  <Pressable
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => update({ soundUri: snd.uri, soundName: snd.uri ? snd.title : null })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.gold : colors.textFaint} />
                    <Text style={s.soundItem} numberOfLines={1}>
                      {snd.title}
                    </Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={playing ? 'Arrêter l’écoute' : `Écouter ${snd.title}`}
                    onPress={() => {
                      if (playing) {
                        stopPreview();
                        setPreviewing(undefined);
                      } else {
                        previewSound(snd.uri);
                        setPreviewing(snd.uri);
                      }
                    }}
                  >
                    <Ionicons name={playing ? 'stop-circle-outline' : 'play-circle-outline'} size={26} color={colors.gold} />
                  </Pressable>
                </View>
              );
            })}
            {sounds.length === 0 && <Hint>Aucune sonnerie trouvée sur ce téléphone : la sonnerie par défaut sera utilisée.</Hint>}
          </View>
        )}
        <Label muted>Répétition (snooze)</Label>
        <Chips options={SNOOZE_PRESETS} value={a.snoozeMinutes} format={(m) => (m === 0 ? 'Désactivée' : `${m} min`)} onChange={(snoozeMinutes) => update({ snoozeMinutes })} />
        <View style={{ height: spacing.md }} />
        <Label muted>Durée de sonnerie avant arrêt automatique</Label>
        <Chips options={RING_PRESETS} value={a.ringMinutes} format={(m) => `${m} min`} onChange={(ringMinutes) => update({ ringMinutes })} />
      </Card>

      {programs.length > 0 && (
        <>
          <SectionTitle>Programme associé</SectionTitle>
          <Card>
            <Chips
              options={programs.map((p) => p.id)}
              value={a.programId}
              format={(id) => programs.find((p) => p.id === id)?.name ?? ''}
              onChange={(programId) => update({ programId })}
            />
            <Hint>« Commencer ma veille » depuis l'alarme ouvre ce programme.</Hint>
          </Card>
        </>
      )}

      <Button
        title="Supprimer ce réveil"
        icon="trash-outline"
        variant="danger"
        onPress={() =>
          Alert.alert('Supprimer ce réveil ?', a.label, [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Supprimer',
              style: 'destructive',
              onPress: async () => {
                if (timer.current) clearTimeout(timer.current);
                timer.current = null;
                latest.current = undefined;
                await deleteAlarm(a.id);
                nav.goBack();
              },
            },
          ])
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  preview: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  previewTitle: { color: colors.gold, fontSize: font.small, fontWeight: '700', marginBottom: spacing.xs },
  previewLine: { color: colors.text, fontSize: font.body, marginTop: 2, fontVariant: ['tabular-nums'] },
  soundHead: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  soundName: { color: colors.text, flex: 1, marginLeft: spacing.md, fontSize: font.body },
  soundRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: spacing.sm },
  soundItem: { color: colors.text, marginLeft: spacing.sm, flex: 1 },
});
