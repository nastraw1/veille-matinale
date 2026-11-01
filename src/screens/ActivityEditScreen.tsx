import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, Field, Hint, Screen, SectionTitle, Stepper, ToggleRow } from '../components/ui';
import * as repo from '../database/repositories';
import { useAppStore } from '../hooks/useAppStore';
import type { RootStackParamList } from '../navigation/types';
import type { Activity } from '../types';

export default function ActivityEditScreen() {
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ActiviteEdition'>>();
  const db = useSQLiteContext();
  const { programs, reloadPrograms } = useAppStore();
  const original = programs.find((p) => p.id === params.programId)?.activities.find((a) => a.id === params.activityId);
  const [a, setA] = useState<Activity | undefined>(original);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(a);
  latest.current = a;

  // Sauvegarde automatique (légèrement différée pendant la saisie).
  const persist = async () => {
    const cur = latest.current;
    if (!cur) return;
    await repo.updateActivity(db, { ...cur, title: cur.title.trim() || 'Activité' });
    await reloadPrograms();
  };
  const update = (patch: Partial<Activity>) => {
    setA((x) => (x ? { ...x, ...patch } : x));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, 500);
  };
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        persist();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!a) {
    return (
      <Screen>
        <Hint>Cette activité n'existe plus.</Hint>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Field label="Titre" value={a.title} onChangeText={(title) => update({ title })} maxLength={80} />
        <SectionTitle>Durée</SectionTitle>
        <Stepper value={a.durationMinutes} onChange={(durationMinutes) => update({ durationMinutes })} min={1} max={300} label="durée" />
        <ToggleRow title="Étape active" subtitle="Une étape désactivée est ignorée pendant la veille" value={a.enabled} onChange={(enabled) => update({ enabled })} />
      </Card>
      <Card>
        <Field
          label="Passage biblique"
          value={a.bibleReference}
          onChangeText={(bibleReference) => update({ bibleReference })}
          placeholder="Ex. Psaume 63:1-8"
          maxLength={200}
        />
        <Field
          label="Sujets de prière"
          value={a.prayerTopics}
          onChangeText={(prayerTopics) => update({ prayerTopics })}
          placeholder="Un sujet par ligne"
          multiline
          numberOfLines={5}
          style={{ minHeight: 110, textAlignVertical: 'top' }}
          maxLength={2000}
        />
      </Card>
      <Button
        title="Supprimer cette activité"
        icon="trash-outline"
        variant="danger"
        onPress={() =>
          Alert.alert('Supprimer cette activité ?', a.title, [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Supprimer',
              style: 'destructive',
              onPress: async () => {
                if (timer.current) clearTimeout(timer.current);
                timer.current = null;
                latest.current = undefined;
                await repo.deleteActivity(db, a.id);
                await reloadPrograms();
                nav.goBack();
              },
            },
          ])
        }
      />
    </Screen>
  );
}
