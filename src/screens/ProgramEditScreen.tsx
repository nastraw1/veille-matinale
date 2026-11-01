import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Chips, Field, Hint, IconButton, Screen, SectionTitle, Stepper } from '../components/ui';
import { DURATION_PRESETS } from '../constants/defaults';
import { colors, font, spacing } from '../constants/theme';
import * as repo from '../database/repositories';
import { useAppStore } from '../hooks/useAppStore';
import type { RootStackParamList } from '../navigation/types';
import { buildSchedule, enabledActivities, scaleDurations, startDateFor, totalMinutes } from '../services/prayerService';
import { formatH, formatMinutes } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProgramEditScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ProgrammeEdition'>>();
  const db = useSQLiteContext();
  const { programs, settings, reloadPrograms, updateSettings } = useAppStore();
  const program = programs.find((p) => p.id === params.id);
  const [name, setName] = useState(program?.name ?? '');
  const [scaleTo, setScaleTo] = useState<number>(settings.prayerDurationMinutes);

  useEffect(() => {
    nav.setOptions({ title: program?.name ?? 'Programme' });
  }, [nav, program?.name]);

  const sorted = useMemo(() => [...(program?.activities ?? [])].sort((a, b) => a.position - b.position), [program]);
  const schedule = useMemo(
    () => (program ? buildSchedule(program.activities, startDateFor(settings.startHour, settings.startMinute)) : []),
    [program, settings.startHour, settings.startMinute],
  );

  if (!program) {
    return (
      <Screen>
        <Hint>Ce programme n'existe plus.</Hint>
      </Screen>
    );
  }

  const saveName = async () => {
    const n = name.trim();
    if (n && n !== program.name) {
      await repo.renameProgram(db, program.id, n);
      await reloadPrograms();
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= sorted.length) return;
    const ids = sorted.map((a) => a.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    await repo.reorderActivities(db, ids);
    await reloadPrograms();
  };

  const toggle = async (id: number, enabled: boolean) => {
    const a = sorted.find((x) => x.id === id);
    if (!a) return;
    await repo.updateActivity(db, { ...a, enabled });
    await reloadPrograms();
  };

  const add = async () => {
    const id = await repo.addActivity(db, program.id, 'Nouvelle activité', 10);
    await reloadPrograms();
    nav.navigate('ActiviteEdition', { programId: program.id, activityId: id });
  };

  const applyScale = async () => {
    const list = enabledActivities(program.activities);
    if (!list.length) return;
    const mins = scaleDurations(
      list.map((a) => a.durationMinutes),
      scaleTo,
    );
    await repo.setDurations(
      db,
      list.map((a, i) => ({ id: a.id, minutes: mins[i] })),
    );
    await reloadPrograms();
  };

  const remove = () => {
    if (programs.length <= 1) {
      Alert.alert('Impossible', 'Conservez au moins un programme.');
      return;
    }
    Alert.alert('Supprimer ce programme ?', program.name, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await repo.deleteProgram(db, program.id);
          if (settings.activeProgramId === program.id) {
            const other = programs.find((p) => p.id !== program.id);
            await updateSettings({ activeProgramId: other?.id ?? null });
          }
          await reloadPrograms();
          nav.goBack();
        },
      },
    ]);
  };

  const scheduleById = new Map(schedule.map((s) => [s.activity.id, s]));

  return (
    <Screen>
      <Field label="Nom du programme" value={name} onChangeText={setName} onEndEditing={saveName} onBlur={saveName} maxLength={60} />
      {settings.activeProgramId !== program.id && (
        <Button title="Utiliser ce programme" icon="checkmark" variant="ghost" onPress={() => updateSettings({ activeProgramId: program.id })} />
      )}

      <SectionTitle>Étapes · {formatMinutes(totalMinutes(program.activities))}</SectionTitle>
      <Card>
        {sorted.map((a, i) => {
          const sc = scheduleById.get(a.id);
          return (
            <View key={a.id} style={[s.row, i > 0 && s.rowBorder]}>
              <View style={s.order}>
                <IconButton icon="chevron-up" label={`Monter ${a.title}`} onPress={() => move(i, -1)} disabled={i === 0} />
                <IconButton icon="chevron-down" label={`Descendre ${a.title}`} onPress={() => move(i, 1)} disabled={i === sorted.length - 1} />
              </View>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => nav.navigate('ActiviteEdition', { programId: program.id, activityId: a.id })}
                accessibilityRole="button"
                accessibilityLabel={`Modifier ${a.title}`}
              >
                <Text style={[s.title, !a.enabled && { color: colors.textFaint, textDecorationLine: 'line-through' }]}>{a.title}</Text>
                <Text style={s.meta}>
                  {sc ? `${formatH(sc.start)}–${formatH(sc.end)} · ` : ''}
                  {a.durationMinutes} min
                  {a.bibleReference ? ` · ${a.bibleReference}` : ''}
                </Text>
              </Pressable>
              <Switch
                value={a.enabled}
                onValueChange={(v) => toggle(a.id, v)}
                accessibilityLabel={`Activer ${a.title}`}
                trackColor={{ false: colors.line, true: colors.goldSoft }}
                thumbColor={a.enabled ? colors.gold : colors.textMuted}
              />
            </View>
          );
        })}
        {sorted.length === 0 && <Hint>Aucune étape. Ajoutez votre première activité.</Hint>}
        <Button title="Ajouter une activité" icon="add" variant="secondary" onPress={add} />
      </Card>

      <SectionTitle>Adapter à une durée totale</SectionTitle>
      <Card>
        <Chips options={DURATION_PRESETS} value={DURATION_PRESETS.includes(scaleTo) ? scaleTo : null} onChange={setScaleTo} format={(v) => `${v} min`} />
        <View style={{ marginTop: spacing.md }}>
          <Stepper value={scaleTo} onChange={setScaleTo} min={Math.max(1, enabledActivities(program.activities).length)} max={600} step={5} label="durée totale" />
        </View>
        <Button title={`Répartir sur ${formatMinutes(scaleTo)}`} icon="resize-outline" variant="ghost" onPress={applyScale} />
        <Hint>Les durées des étapes actives sont ajustées proportionnellement (1 minute minimum par étape).</Hint>
      </Card>

      <Button title="Supprimer ce programme" icon="trash-outline" variant="danger" onPress={remove} />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  order: { marginRight: spacing.xs },
  title: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
});
