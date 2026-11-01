/**
 * Liste de villes disponible hors connexion (coordonnées indicatives du centre-ville).
 * L'utilisateur peut aussi saisir des coordonnées exactes ou utiliser le GPS.
 */
export interface City {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

const CI = "Côte d'Ivoire";
const ABJ = 'Africa/Abidjan';

export const CITIES: City[] = [
  { name: 'Bouna', country: CI, latitude: 9.27, longitude: -2.99, timezone: ABJ },
  { name: 'Abidjan', country: CI, latitude: 5.36, longitude: -4.01, timezone: ABJ },
  { name: 'Yamoussoukro', country: CI, latitude: 6.83, longitude: -5.29, timezone: ABJ },
  { name: 'Bouaké', country: CI, latitude: 7.69, longitude: -5.03, timezone: ABJ },
  { name: 'Korhogo', country: CI, latitude: 9.46, longitude: -5.63, timezone: ABJ },
  { name: 'Daloa', country: CI, latitude: 6.88, longitude: -6.45, timezone: ABJ },
  { name: 'San-Pédro', country: CI, latitude: 4.75, longitude: -6.64, timezone: ABJ },
  { name: 'Man', country: CI, latitude: 7.41, longitude: -7.55, timezone: ABJ },
  { name: 'Gagnoa', country: CI, latitude: 6.13, longitude: -5.95, timezone: ABJ },
  { name: 'Abengourou', country: CI, latitude: 6.73, longitude: -3.49, timezone: ABJ },
  { name: 'Bondoukou', country: CI, latitude: 8.04, longitude: -2.8, timezone: ABJ },
  { name: 'Tanda', country: CI, latitude: 7.8, longitude: -3.17, timezone: ABJ },
  { name: 'Nassian', country: CI, latitude: 8.45, longitude: -3.47, timezone: ABJ },
  { name: 'Doropo', country: CI, latitude: 9.81, longitude: -3.35, timezone: ABJ },
  { name: 'Odienné', country: CI, latitude: 9.51, longitude: -7.56, timezone: ABJ },
  { name: 'Ferkessédougou', country: CI, latitude: 9.59, longitude: -5.19, timezone: ABJ },
  { name: 'Katiola', country: CI, latitude: 8.14, longitude: -5.1, timezone: ABJ },
  { name: 'Séguéla', country: CI, latitude: 7.96, longitude: -6.67, timezone: ABJ },
  { name: 'Touba', country: CI, latitude: 8.28, longitude: -7.68, timezone: ABJ },
  { name: 'Divo', country: CI, latitude: 5.84, longitude: -5.36, timezone: ABJ },
  { name: 'Soubré', country: CI, latitude: 5.79, longitude: -6.61, timezone: ABJ },
  { name: 'Dabou', country: CI, latitude: 5.32, longitude: -4.38, timezone: ABJ },
  { name: 'Grand-Bassam', country: CI, latitude: 5.21, longitude: -3.74, timezone: ABJ },
  { name: 'Ouagadougou', country: 'Burkina Faso', latitude: 12.37, longitude: -1.52, timezone: 'Africa/Ouagadougou' },
  { name: 'Bobo-Dioulasso', country: 'Burkina Faso', latitude: 11.18, longitude: -4.3, timezone: 'Africa/Ouagadougou' },
  { name: 'Accra', country: 'Ghana', latitude: 5.6, longitude: -0.19, timezone: 'Africa/Accra' },
  { name: 'Kumasi', country: 'Ghana', latitude: 6.69, longitude: -1.62, timezone: 'Africa/Accra' },
  { name: 'Bamako', country: 'Mali', latitude: 12.64, longitude: -8.0, timezone: 'Africa/Bamako' },
  { name: 'Dakar', country: 'Sénégal', latitude: 14.72, longitude: -17.47, timezone: 'Africa/Dakar' },
  { name: 'Conakry', country: 'Guinée', latitude: 9.64, longitude: -13.58, timezone: 'Africa/Conakry' },
  { name: 'Monrovia', country: 'Liberia', latitude: 6.3, longitude: -10.8, timezone: 'Africa/Monrovia' },
  { name: 'Lomé', country: 'Togo', latitude: 6.13, longitude: 1.22, timezone: 'Africa/Lome' },
  { name: 'Cotonou', country: 'Bénin', latitude: 6.37, longitude: 2.39, timezone: 'Africa/Porto-Novo' },
  { name: 'Niamey', country: 'Niger', latitude: 13.51, longitude: 2.11, timezone: 'Africa/Niamey' },
  { name: 'Lagos', country: 'Nigeria', latitude: 6.52, longitude: 3.38, timezone: 'Africa/Lagos' },
  { name: 'Douala', country: 'Cameroun', latitude: 4.05, longitude: 9.7, timezone: 'Africa/Douala' },
  { name: 'Yaoundé', country: 'Cameroun', latitude: 3.85, longitude: 11.5, timezone: 'Africa/Douala' },
  { name: 'Kinshasa', country: 'RD Congo', latitude: -4.32, longitude: 15.31, timezone: 'Africa/Kinshasa' },
  { name: 'Paris', country: 'France', latitude: 48.86, longitude: 2.35, timezone: 'Europe/Paris' },
];
