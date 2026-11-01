import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Hint, Screen, SectionTitle } from '../components/ui';
import { colors, font, spacing } from '../constants/theme';
import { createProgram } from '../database/repositories';
import { useAppStore } from '../hooks/useAppStore';
import type { RootStackParamList } from '../navigation/types';
import { totalMinutes } from '../services/prayerService';
import { formatMinutes } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProgramsScreen() {
  const nav = useNavigation<Nav>();
  const db = useSQLiteContext();
  const { programs, settings, updateSettings, reloadPrograms } = useAppStore();
  const [name, setName] = useState('');

  const create = async (copy: boolean) => {
    const base = programs.find((p) => p.id === settings.activeProgramId);
    const id = await createProgram(db, name.trim() || `Programme ${programs.length + 1}`, copy ? base : undefined);
    setName('');
    await reloadPrograms();
    nav.navigate('ProgrammeEdition', { id });
  };

  return (
    <Screen>
      <SectionTitle>Mes programmes</SectionTitle>
      {programs.map((p) => {
        const active = p.id === settings.activeProgramId;
        return (
          <Pressable
            key={p.id}
            onPress={() => nav.navigate('ProgrammeEdition', { id: p.id })}
            accessibilityRole="button"
            accessibilityLabel={`Modifier ${p.name}`}
          >
            <Card style={[s.item, active && { borderColor: colors.gold }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{p.name}</Text>
                <Text style={s.muted}>
                  {p.activities.filter((a) => a.enabled).length} étapes · {formatMinutes(totalMinutes(p.activities))}
                </Text>
                {active ? (
                  <Text style={s.active}>Programme utilisé</Text>
                ) : (
                  <Pressable onPress={() => updateSettings({ activeProgramId: p.id })} hitSlop={8} accessibilityRole="button">
                    <Text style={s.use}>Utiliser ce programme</Text>
                  </Pressable>
                )}
              </View>
              <Ionicons name="create-outline" size={22} color={colors.gold} />
            </Card>
          </Pressable>
        );
      })}

      <SectionTitle>Nouveau programme</SectionTitle>
      <Card>
        <Field label="Nom" value={name} onChangeText={setName} placeholder="Ex. Veille du vendredi" maxLength={60} />
        <Button title="Créer un programme vide" icon="add" variant="secondary" onPress={() => create(false)} />
        <Button title="Copier le programme utilisé" icon="copy-outline" variant="ghost" onPress={() => create(true)} />
        <Hint>Les horaires de chaque étape sont recalculés automatiquement à partir de l'heure de début.</Hint>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.text, fontSize: font.heading, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  active: { color: colors.gold, fontSize: font.small, marginTop: spacing.sm, fontWeight: '700' },
  use: { color: colors.textMuted, fontSize: font.small, marginTop: spacing.sm, textDecorationLine: 'underline' },
});
