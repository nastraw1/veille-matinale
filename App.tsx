import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DATABASE_NAME, migrateDatabase } from './src/database/schema';
import { getKV, setKV } from './src/database/repositories';
import { AppStoreProvider, useAppStore } from './src/hooks/useAppStore';
import AppNavigator from './src/navigation/AppNavigator';
import { stopRinging } from './src/services/alarmService';
import { requestNotificationPermission } from './src/services/notificationService';

/** Effets globaux : premier lancement, liens depuis l'écran d'alarme. */
function GlobalEffects() {
  const db = useSQLiteContext();
  const { refreshAlarms, alarms, updateSettings } = useAppStore();

  useEffect(() => {
    (async () => {
      if (!(await getKV<boolean>(db, 'onboarded'))) {
        await requestNotificationPermission();
        await setKV(db, 'onboarded', true);
        await refreshAlarms();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // « Commencer ma veille » depuis l'alarme : on arrête la sonnerie et on ouvre le programme associé.
    const handle = (url: string | null | undefined) => {
      if (!url || !url.startsWith('veillematinale://veille')) return;
      stopRinging();
      const m = url.match(/alarmId=(\d+)/);
      const alarm = m ? alarms.find((a) => a.id === Number(m[1])) : undefined;
      if (alarm?.programId) updateSettings({ activeProgramId: alarm.programId });
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [alarms, updateSettings]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
        <AppStoreProvider>
          <GlobalEffects />
          <AppNavigator />
        </AppStoreProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
