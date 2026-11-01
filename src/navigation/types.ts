import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Accueil: undefined;
  Veille: undefined;
  Programmes: undefined;
  Historique: undefined;
  Parametres: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Alarmes: undefined;
  AlarmeEdition: { id: number };
  ProgrammeEdition: { id: number };
  ActiviteEdition: { programId: number; activityId: number };
  Localisation: undefined;
  Autorisations: undefined;
};
