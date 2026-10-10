export const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'pos-inventorysaas.firebaseapp.com',
  projectId: 'pos-inventorysaas',
  storageBucket: 'pos-inventorysaas.firebasestorage.app',
  messagingSenderId: '675049225203',
  appId: '1:675049225203:web:7a89428072bc814671b086',
  functionsRegion: 'us-central1',
  useEmulators: true,
  emulatorHost: '127.0.0.1',
  emulatorAuthPort: 9099,
  emulatorFirestorePort: 8080,
  emulatorFunctionsPort: 5001
};

export function isFirebaseConfigured(config: { projectId: string }): boolean {
  return config.projectId.trim().length > 0;
}