/** Tests unitaires de la logique pure (calcul solaire, programme, statistiques). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, target: 'ES2020', module: 'node16', moduleResolution: 'node16', isolatedModules: true, rootDir: '.', types: ['jest'] }, diagnostics: true }] },
};
