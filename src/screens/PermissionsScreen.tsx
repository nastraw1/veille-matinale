import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Hint, Screen, SectionTitle } from '../components/ui';
import { colors, font, spacing } from '../constants/theme';
import { useAppStore } from '../hooks/useAppStore';
import * as alarms from '../services/alarmService';
import { requestNotificationPermission } from '../services/notificationService';
import { formatHMS } from '../utils/format';

function Item({
  ok,
  title,
  text,
  action,
  onPress,
  optional,
}: {
  ok: boolean;
  title: string;
  text: string;
  action: string;
  onPress: () => void;
  optional?: boolean;
}) {
  return (
    <Card style={!ok && !optional ? { borderColor: colors.warning } : undefined}>
      <View style={s.head}>
        <Ionicons
          name={ok ? 'checkmark-circle' : optional ? 'information-circle-outline' : 'alert-circle'}
          size={24}
          color={ok ? colors.success : optional ? colors.textMuted : colors.warning}
        />
        <Text style={s.title}>{title}</Text>
      </View>
      <Text style={s.text}>{text}</Text>
      {!ok && <Button title={action} variant={optional ? 'secondary' : 'primary'} onPress={onPress} />}
    </Card>
  );
}

export default function PermissionsScreen() {
  const { permissions, refreshPermissions, refreshAlarms, scheduleTestAlarm } = useAppStore();
  const [testAt, setTestAt] = useState<Date | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshPermissions();
    }, [refreshPermissions]),
  );

  if (!alarms.isAlarmModuleAvailable || !permissions) {
    return (
      <Screen>
        <Card style={{ borderColor: colors.warning }}>
          <Hint tone="warn">
            Le module d'alarme Android n'est pas disponible dans cette version (Expo Go ou web). Installez l'APK VEILLE
            MATINALE pour programmer de vrais réveils.
          </Hint>
        </Card>
      </Screen>
    );
  }

  const p = permissions;
  const brand = p.manufacturer.toLowerCase();
  const aggressive = ['xiaomi', 'redmi', 'poco', 'tecno', 'infinix', 'itel', 'transsion', 'oppo', 'realme', 'vivo', 'huawei', 'honor', 'samsung', 'oneplus'].some((b) =>
    brand.includes(b),
  );

  return (
    <Screen>
      <Hint>
        Un réveil n'est affiché « Actif » que lorsqu'Android l'a réellement accepté. Vérifiez chaque point ci-dessous, puis
        faites un test.
      </Hint>
      <SectionTitle>Indispensable</SectionTitle>
      <Item
        ok={p.notifications}
        title="Notifications"
        text="Nécessaires pour afficher l'alarme et ses boutons (Arrêter, Répéter, Commencer ma veille)."
        action="Autoriser les notifications"
        onPress={async () => {
          const r = await requestNotificationPermission();
          if (r === 'blocked') alarms.openNotificationSettings();
          await refreshAlarms();
        }}
      />
      <Item
        ok={p.exactAlarms}
        title="Alarmes et rappels"
        text="Permet de sonner à la minute exacte, même en veille prolongée."
        action="Ouvrir le réglage « Alarmes et rappels »"
        onPress={() => alarms.openExactAlarmSettings()}
      />
      <Item
        ok={p.fullScreenIntent}
        title="Affichage plein écran"
        text="Affiche l'écran d'alarme par-dessus l'écran verrouillé (Android 14 et plus)."
        action="Autoriser le plein écran"
        onPress={() => alarms.openFullScreenSettings()}
      />

      <SectionTitle>Recommandé</SectionTitle>
      <Item
        optional
        ok={p.ignoringBatteryOptimizations}
        title="Optimisation de la batterie"
        text={
          aggressive
            ? `Sur les téléphones ${p.manufacturer}, choisissez « Non optimisée » / « Aucune restriction » pour VEILLE MATINALE, et activez le démarrage automatique si l'option existe.`
            : 'Choisissez « Non optimisée » pour VEILLE MATINALE afin d’éviter toute fermeture par le système.'
        }
        action="Ouvrir les réglages de batterie"
        onPress={() => alarms.openBatterySettings()}
      />
      <Button title="Réglages de l'application" icon="open-outline" variant="ghost" onPress={() => alarms.openAppSettings()} />

      <SectionTitle>Tester</SectionTitle>
      <Card>
        <Text style={s.text}>
          Programme un réveil unique dans 1 minute. Verrouillez le téléphone pour vérifier qu'il sonne bien écran éteint.
        </Text>
        <Button
          title="Tester l'alarme dans 1 minute"
          icon="alarm-outline"
          onPress={async () => {
            const st = await scheduleTestAlarm(60);
            const t = st[alarms.TEST_ALARM_ID];
            if (t?.scheduled && t.nextTriggerAt) setTestAt(new Date(t.nextTriggerAt));
            else {
              setTestAt(null);
              Alert.alert('Test impossible', "Android refuse la programmation : vérifiez l'autorisation « Alarmes et rappels ».");
            }
          }}
        />
        {testAt && <Hint tone="ok">Test programmé à {formatHMS(testAt)}.</Hint>}
      </Card>
      <Hint>Android {p.sdkInt >= 0 ? `(API ${p.sdkInt})` : ''} · {p.manufacturer}</Hint>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  title: { color: colors.text, fontSize: font.heading, fontWeight: '700', marginLeft: spacing.sm, flex: 1 },
  text: { color: colors.textMuted, fontSize: font.body, lineHeight: 21, marginBottom: spacing.sm },
});
