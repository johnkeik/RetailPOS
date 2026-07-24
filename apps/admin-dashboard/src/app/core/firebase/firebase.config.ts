export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  functionsRegion: string;
  useEmulators: boolean;
  emulatorHost: string;
  emulatorAuthPort: number;
  emulatorFirestorePort: number;
  emulatorFunctionsPort: number;
};

export const firebaseConfig: FirebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'pos-inventorysaas.firebaseapp.com',
  projectId: 'pos-inventorysaas',
  storageBucket: 'pos-inventorysaas.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:localdev',
  functionsRegion: 'us-central1',
  useEmulators: true,
  emulatorHost: '127.0.0.1',
  emulatorAuthPort: 9099,
  emulatorFirestorePort: 8080,
  emulatorFunctionsPort: 5001
};

export function isFirebaseConfigured(config: FirebaseConfig): boolean {
  return config.projectId.trim().length > 0;
}
