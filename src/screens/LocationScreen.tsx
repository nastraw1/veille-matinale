import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Hint, IconButton, Screen, SectionTitle } from '../components/ui';
import { colors, font, spacing } from '../constants/theme';
import { useAppStore } from '../hooks/useAppStore';
import { deviceTimeZone, locateWithGps, parseCoordinate, searchCities, validateCoordinates } from '../services/locationService';
import { getSolarTimes } from '../services/solarService';
import { formatCoord, formatHM } from '../utils/format';

export default function LocationScreen() {
  const { location, locations, selectLocation, chooseSavedLocation, removeLocation, settings } = useAppStore();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [tz, setTz] = useState(deviceTimeZone());
  const [manualError, setManualError] = useState<string | null>(null);

  const today = getSolarTimes(new Date(), location.latitude, location.longitude);
  const results = searchCities(query).slice(0, query ? 20 : 8);

  const gps = async () => {
    setBusy(true);
    setGpsError(null);
    const r = await locateWithGps();
    setBusy(false);
    if (r.ok) await selectLocation(r.location);
    else setGpsError(r.error);
  };

  const saveManual = async () => {
    const la = parseCoordinate(lat);
    const lo = parseCoordinate(lon);
    const err = validateCoordinates(la, lo) ?? (name.trim() ? null : 'Indiquez un nom de ville.');
    setManualError(err);
    if (err) return;
    await selectLocation({ name: name.trim(), country: '', latitude: la, longitude: lo, timezone: tz.trim() || deviceTimeZone(), source: 'manual' });
    setName('');
    setLat('');
    setLon('');
    Alert.alert('Localisation enregistrée', `${name.trim()} est maintenant utilisée pour les calculs solaires.`);
  };

  return (
    <Screen>
      <Card style={{ borderColor: colors.gold }}>
        <Text style={s.current}>{location.name}</Text>
        <Text style={s.muted}>
          {location.country ? `${location.country} · ` : ''}
          {formatCoord(location.latitude, location.longitude)}
        </Text>
        <Text style={s.muted}>Fuseau : {location.timezone}</Text>
        <Text style={[s.muted, { marginTop: spacing.sm }]}>
          Aujourd'hui : aube {formatHM(today[settings.dawnReference], settings.use24h)} · lever {formatHM(today.sunrise, settings.use24h)}
        </Text>
        {location.timezone !== deviceTimeZone() && (
          <Hint tone="warn">
            Le téléphone est réglé sur le fuseau {deviceTimeZone()}. Les heures sont affichées et les réveils sonnent à
            l'heure du téléphone.
          </Hint>
        )}
      </Card>

      <SectionTitle>Géolocalisation</SectionTitle>
      <Card>
        <Button title={busy ? 'Recherche de la position…' : 'Utiliser ma position (GPS)'} icon="navigate-outline" onPress={gps} disabled={busy} />
        {busy && <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.sm }} />}
        {gpsError && <Hint tone="warn">{gpsError}</Hint>}
        <Hint>Le GPS fonctionne sans Internet. Votre position reste sur ce téléphone.</Hint>
      </Card>

      <SectionTitle>Choisir une ville</SectionTitle>
      <Card>
        <Field value={query} onChangeText={setQuery} placeholder="Rechercher (ex. Bondoukou)" accessibilityLabel="Rechercher une ville" />
        {results.map((c) => (
          <Pressable
            key={`${c.name}-${c.country}`}
            onPress={() => selectLocation({ ...c, source: 'list' })}
            style={({ pressed }) => [s.cityRow, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={`Choisir ${c.name}`}
          >
            <Text style={s.cityName}>{c.name}</Text>
            <Text style={s.muted}>{c.country}</Text>
          </Pressable>
        ))}
        {results.length === 0 && <Hint>Ville absente de la liste : utilisez le GPS ou la saisie manuelle ci-dessous.</Hint>}
      </Card>

      <SectionTitle>Saisie manuelle</SectionTitle>
      <Card>
        <Field label="Nom de la ville" value={name} onChangeText={setName} placeholder="Ex. Bouna" />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field label="Latitude (N +, S −)" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" placeholder="9.27" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Longitude (E +, O −)" value={lon} onChangeText={setLon} keyboardType="numbers-and-punctuation" placeholder="-2.99" />
          </View>
        </View>
        <Field label="Fuseau horaire" value={tz} onChangeText={setTz} autoCapitalize="none" placeholder="Africa/Abidjan" />
        {manualError && <Hint tone="warn">{manualError}</Hint>}
        <Button title="Enregistrer et utiliser" icon="save-outline" variant="secondary" onPress={saveManual} />
      </Card>

      {locations.length > 1 && (
        <>
          <SectionTitle>Localisations enregistrées</SectionTitle>
          <Card>
            {locations.map((l) => {
              const active = l.id === location.id;
              return (
                <View key={l.id} style={s.savedRow}>
                  <Pressable style={{ flex: 1 }} onPress={() => chooseSavedLocation(l.id)} accessibilityRole="button" accessibilityLabel={`Utiliser ${l.name}`}>
                    <Text style={[s.cityName, active && { color: colors.gold }]}>
                      {active && <Ionicons name="checkmark" size={16} color={colors.gold} />} {l.name}
                    </Text>
                    <Text style={s.muted}>{formatCoord(l.latitude, l.longitude)}</Text>
                  </Pressable>
                  {!active && <IconButton icon="trash-outline" label={`Supprimer ${l.name}`} onPress={() => removeLocation(l.id)} />}
                </View>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  current: { color: colors.white, fontSize: font.title, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  cityRow: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  cityName: { color: colors.text, fontSize: font.body },
  savedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
});
