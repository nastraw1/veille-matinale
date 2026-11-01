import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import React from 'react';
import { View } from 'react-native';

import { TimeField } from '../components/TimeField';
import { Card, Chips, Divider, Hint, Label, Row, Screen, SectionTitle, Stepper, ToggleRow } from '../components/ui';
import { DURATION_PRESETS, SOLAR_EVENT_LABELS } from '../constants/defaults';
import { spacing } from '../constants/theme';
import { useAppStore } from '../hooks/useAppStore';
import type { RootStackParamList } from '../navigation/types';
import type { AppMode, Settings } from '../types';
import { formatCoord, formatMinutes } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MODES: AppMode[] = ['clock', 'program', 'complete'];
const MODE_LABEL: Record<AppMode, string> = { clock: 'Horloge', program: 'Programme spirituel', complete: 'Complet' };
const MODE_HELP: Record<AppMode, string> = {
  clock: "Heure actuelle, aube, lever du soleil et compte à rebours.",
  program: 'Uniquement le programme de prière et son chronomètre.',
  complete: 'Horloge solaire, réveils et programme spirituel réunis.',
};
const DAWNS: Settings['dawnReference'][] = ['civilDawn', 'nauticalDawn', 'astronomicalDawn'];

export default function SettingsScreen() {
  const nav = useNavigation<Nav>();
  const { settings, updateSettings, alarms, programs, location, permissions } = useAppStore();
  const program = programs.find((p) => p.id === settings.activeProgramId);
  const custom = !DURATION_PRESETS.includes(settings.prayerDurationMinutes);
  const permOk = permissions ? permissions.exactAlarms && permissions.notifications && permissions.fullScreenIntent : false;

  return (
    <Screen>
      <SectionTitle>Mode de fonctionnement</SectionTitle>
      <Card>
        <Chips options={MODES} value={settings.appMode} format={(m) => MODE_LABEL[m]} onChange={(appMode) => updateSettings({ appMode })} />
        <Hint>{MODE_HELP[settings.appMode]}</Hint>
      </Card>

      <SectionTitle>Réveils</SectionTitle>
      <Card>
        <Row
          icon="alarm-outline"
          title="Mes réveils"
          value={`${alarms.filter((a) => a.enabled).length} actif(s) / ${alarms.length}`}
          subtitle="Heure, jours, sonnerie, vibreur, répétition, mode solaire"
          onPress={() => nav.navigate('Alarmes')}
        />
        <Divider />
        <Row
          icon="shield-checkmark-outline"
          title="Autorisations et fiabilité"
          value={permOk ? 'OK' : 'À vérifier'}
          onPress={() => nav.navigate('Autorisations')}
        />
      </Card>

      <SectionTitle>Prière</SectionTitle>
      <Card>
        <Label>Heure de début de la prière</Label>
        <TimeField
          label="Heure de début"
          hour={settings.startHour}
          minute={settings.startMinute}
          use24h={settings.use24h}
          onChange={(startHour, startMinute) => updateSettings({ startHour, startMinute })}
        />
        <View style={{ height: spacing.lg }} />
        <Label>Durée de la prière</Label>
        <Chips
          options={[...DURATION_PRESETS, -1]}
          value={custom ? -1 : settings.prayerDurationMinutes}
          format={(v) => (v === -1 ? 'Personnalisée' : formatMinutes(v))}
          onChange={(v) => updateSettings({ prayerDurationMinutes: v === -1 ? (custom ? settings.prayerDurationMinutes : 75) : v })}
        />
        {custom && (
          <View style={{ marginTop: spacing.md }}>
            <Stepper
              value={settings.prayerDurationMinutes}
              onChange={(prayerDurationMinutes) => updateSettings({ prayerDurationMinutes })}
              min={5}
              max={600}
              step={5}
              label="durée personnalisée"
            />
          </View>
        )}
        <ToggleRow
          title="Adapter le programme à cette durée"
          subtitle="Les étapes sont réparties proportionnellement sur la durée choisie"
          value={settings.scaleProgramToDuration}
          onChange={(scaleProgramToDuration) => updateSettings({ scaleProgramToDuration })}
        />
        <Divider />
        <Row icon="list-outline" title="Programme utilisé" value={program?.name ?? '—'} onPress={() => nav.navigate('Tabs', { screen: 'Programmes' })} />
      </Card>

      <SectionTitle>Soleil et localisation</SectionTitle>
      <Card>
        <Row
          icon="location-outline"
          title={location.name}
          subtitle={`${formatCoord(location.latitude, location.longitude)} · ${location.timezone}`}
          onPress={() => nav.navigate('Localisation')}
        />
        <Divider />
        <Label>Aube affichée et utilisée pour « avant l'aube »</Label>
        <Chips options={DAWNS} value={settings.dawnReference} format={(k) => SOLAR_EVENT_LABELS[k]} onChange={(dawnReference) => updateSettings({ dawnReference })} />
        <Hint>Calculs astronomiques locaux (sans Internet ni météo), mis à jour chaque jour selon la saison.</Hint>
      </Card>

      <SectionTitle>Affichage et veille</SectionTitle>
      <Card>
        <ToggleRow title="Format 24 heures" value={settings.use24h} onChange={(use24h) => updateSettings({ use24h })} icon="time-outline" />
        <ToggleRow
          title="Garder l'écran allumé"
          subtitle="Pendant la veille"
          value={settings.keepScreenOn}
          onChange={(keepScreenOn) => updateSettings({ keepScreenOn })}
          icon="sunny-outline"
        />
        <ToggleRow
          title="Notification pendant la veille"
          subtitle="Étape en cours et temps restant dans la barre de notifications"
          value={settings.showVigilNotification}
          onChange={(showVigilNotification) => updateSettings({ showVigilNotification })}
          icon="notifications-outline"
        />
      </Card>

      <Hint>
        VEILLE MATINALE – BOUNA · version {Constants.expoConfig?.version ?? '1.0.0'} · données enregistrées uniquement sur ce téléphone.
      </Hint>
    </Screen>
  );
}
