# VEILLE MATINALE – BOUNA

Application Android de prière avant le lever du soleil : horloge solaire, réveils exacts, programme spirituel chronométré et historique. Tout fonctionne **sans Internet**.

Localisation par défaut : Bouna (Côte d'Ivoire) · 9,27° N · 2,99° O · Africa/Abidjan (UTC+0).

---

## 1. Obtenir l'APK

Le projet est une application Expo (SDK 58) avec un module natif Kotlin. Trois façons de produire l'APK :

### A. GitHub Actions (recommandé, gratuit, aucun outil à installer)
1. Créez un dépôt GitHub et envoyez-y le dossier du projet (`git push`).
2. Onglet **Actions** › « APK Android » : la compilation démarre automatiquement (≈ 15 min).
3. Ouvrez l'exécution terminée › **Artifacts** › `veille-matinale-apk` › décompressez : `veille-matinale.apk`.
4. Pour une version publiée : `git tag v1.0.0 && git push --tags` › l'APK est joint à la « Release ».

### B. Sur un ordinateur avec Android Studio (JDK 17, SDK Android)
```bash
npm install
npm run apk          # = expo prebuild + ./gradlew assembleRelease
# APK : android/app/build/outputs/apk/release/app-release.apk
```
Téléphone branché en USB (débogage activé) : `npx expo run:android --variant release`.

### C. EAS Build (compte Expo gratuit)
```bash
npx eas-cli@latest build -p android --profile apk
```

> L'APK release est signé avec la clé de débogage générée par Expo : il s'installe directement (« Sources inconnues »). Pour le Play Store, configurez votre propre clé de signature.

## 2. Installation sur le téléphone
1. Copiez `veille-matinale.apk` sur le téléphone (WhatsApp, câble, Bluetooth…).
2. Ouvrez-le › autorisez l'installation depuis cette source › **Installer**.
3. Au premier lancement, acceptez les **notifications**.
4. **Paramètres › Autorisations et fiabilité** : chaque ligne doit être verte.
   - *Alarmes et rappels* (Android 12) · *Affichage plein écran* (Android 14+).
   - *Batterie : non optimisée* — fortement conseillé sur Tecno, Infinix, itel, Xiaomi, Samsung… Activez aussi le « démarrage automatique » si votre téléphone le propose.
5. Touchez **Tester l'alarme dans 1 minute**, verrouillez l'écran et attendez la sonnerie.

## 3. Utilisation

| Écran | Rôle |
|---|---|
| **Accueil** | Heure, date, aube, lever du soleil, compte à rebours, prochain réveil et son état réel, durée de prière, COMMENCER MA VEILLE, PARAMÈTRES |
| **Veille** | Chronomètre étape par étape : passage biblique, sujets de prière, pause, étape suivante, terminer. Notification persistante facultative, écran maintenu allumé |
| **Programmes** | Plusieurs programmes ; ajouter, renommer, réordonner (▲▼), activer/désactiver, supprimer une étape ; répartir sur une durée totale |
| **Historique** | Séances terminées / interrompues, durée réelle, jours consécutifs, statistiques hebdomadaires et mensuelles |
| **Paramètres** | Mode (Horloge / Programme / Complet), heure de début, durée (15 → 120 min ou personnalisée), aube de référence, localisation, affichage |

**Réveils** (Paramètres › Mes réveils) : plusieurs réveils indépendants, chacun avec
- mode : *heure fixe*, *avant le lever du soleil*, *avant l'aube* (civile, nautique ou astronomique), ou *événement solaire* ± décalage — ex. « 2 h avant le lever du soleil » ;
- jours de la semaine, vibreur, sonnerie du téléphone (écoute possible), répétition (snooze), durée de sonnerie, programme associé ;
- heure de secours si l'événement solaire n'existe pas (latitudes extrêmes).

Quand le réveil sonne (même application fermée, écran verrouillé ou après redémarrage) : **Commencer ma veille**, **Répéter**, ou **Arrêter**.

Toutes les modifications sont enregistrées immédiatement et les réveils sont reprogrammés aussitôt.

## 4. Fiabilité des réveils
- `AlarmManager.setAlarmClock` : alarme de type réveil, exemptée du mode Doze.
- Service de premier plan : son sur le flux **Alarme**, vibration, arrêt automatique.
- Écran d'alarme natif au-dessus de l'écran verrouillé + notification plein écran.
- Reprogrammation automatique : redémarrage, mise à jour de l'appli, changement d'heure ou de fuseau, changement d'autorisation.
- Les alarmes fixes sont recalculées par Android dans le fuseau courant ; les alarmes solaires sont des instants astronomiques précalculés sur 120 jours (actualisés à chaque ouverture), avec heure de secours au-delà.
- Un réveil n'est affiché **« Active »** que si Android l'a effectivement accepté.

## 5. Calculs solaires
Algorithme astronomique SunCalc (formules de J. Meeus), exécuté localement — jamais de météo. Seuils : lever −0,833°, aube civile −6°, nautique −12°, astronomique −18°. Vérifié à ±2 min contre l'algorithme NOAA pour Bouna (solstices, équinoxe). Les jours où un événement n'existe pas (nuit/jour polaire, aube astronomique absente en été à haute latitude) sont signalés.

## 6. Architecture
```
App.tsx                         Fournisseur SQLite, état global, liens profonds
src/
  constants/   defaults.ts, theme.ts, cities.ts (villes hors ligne)
  types/       modèles (Alarm, Program, Activity, Settings, PrayerSession…)
  database/    schema.ts (migrations), repositories.ts (accès SQLite)
  services/    solarService.ts · alarmService.ts · notificationService.ts
               locationService.ts · prayerService.ts
  hooks/       useAppStore (état + sauvegarde auto), useNow, useSolarTimes
  navigation/  AppNavigator (onglets + piles, lien veillematinale://veille)
  screens/     Accueil, Veille, Programmes, Historique, Paramètres,
               Réveils, Édition réveil/programme/activité, Localisation, Autorisations
  components/  ui.tsx, TimeField.tsx
modules/veille-alarm/           Module natif Expo (Kotlin)
  AlarmScheduler, AlarmReceiver, SystemEventsReceiver, AlarmService,
  AlarmActivity, AlarmStore, AlarmBridge, VeilleAlarmModule
__tests__/                      Tests du moteur solaire, du programme et des statistiques
```
Base SQLite locale : paramètres, localisations, réveils, programmes, activités, historique.

## 7. Développement
```bash
npm install
npm test             # 28 tests (fuseau Africa/Abidjan)
npm run typecheck
npx expo run:android # build de développement sur un téléphone
```
Le dossier `android/` est généré par `expo prebuild` : ne pas le modifier à la main (tout le natif est dans `modules/veille-alarm`).
