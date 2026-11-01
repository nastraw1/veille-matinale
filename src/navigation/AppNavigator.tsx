import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { colors } from '../constants/theme';
import ActivityEditScreen from '../screens/ActivityEditScreen';
import AlarmEditScreen from '../screens/AlarmEditScreen';
import AlarmsScreen from '../screens/AlarmsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import HomeScreen from '../screens/HomeScreen';
import LocationScreen from '../screens/LocationScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
import ProgramEditScreen from '../screens/ProgramEditScreen';
import ProgramsScreen from '../screens/ProgramsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import VigilScreen from '../screens/VigilScreen';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.night,
    card: colors.deep,
    text: colors.text,
    border: colors.line,
    notification: colors.gold,
  },
};

/** Liens profonds : l'écran d'alarme natif ouvre « veillematinale://veille ». */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['veillematinale://'],
  config: {
    screens: {
      Tabs: { screens: { Veille: 'veille', Accueil: 'accueil' } },
      Alarmes: 'alarmes',
    },
  },
};

const ICONS: Record<keyof TabParamList, [React.ComponentProps<typeof Ionicons>['name'], React.ComponentProps<typeof Ionicons>['name']]> = {
  Accueil: ['home', 'home-outline'],
  Veille: ['flame', 'flame-outline'],
  Programmes: ['list', 'list-outline'],
  Historique: ['stats-chart', 'stats-chart-outline'],
  Parametres: ['settings', 'settings-outline'],
};

const headerOptions = {
  headerStyle: { backgroundColor: colors.night },
  headerTintColor: colors.gold,
  headerTitleStyle: { color: colors.text },
  headerShadowVisible: false,
} as const;

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...headerOptions,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.deep, borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 11 },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={ICONS[route.name][focused ? 0 : 1]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="Accueil" component={HomeScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Veille" component={VigilScreen} options={{ title: 'Ma veille' }} />
      <Tab.Screen name="Programmes" component={ProgramsScreen} />
      <Tab.Screen name="Historique" component={HistoryScreen} />
      <Tab.Screen name="Parametres" component={SettingsScreen} options={{ title: 'Paramètres' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer theme={theme} linking={linking}>
      <Stack.Navigator screenOptions={{ ...headerOptions, contentStyle: { backgroundColor: colors.night } }}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Alarmes" component={AlarmsScreen} options={{ title: 'Réveils' }} />
        <Stack.Screen name="AlarmeEdition" component={AlarmEditScreen} options={{ title: 'Modifier le réveil' }} />
        <Stack.Screen name="ProgrammeEdition" component={ProgramEditScreen} options={{ title: 'Programme' }} />
        <Stack.Screen name="ActiviteEdition" component={ActivityEditScreen} options={{ title: 'Activité' }} />
        <Stack.Screen name="Localisation" component={LocationScreen} options={{ title: 'Localisation' }} />
        <Stack.Screen name="Autorisations" component={PermissionsScreen} options={{ title: 'Autorisations' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
