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
  apiKey: 'AIzaSyA5fgbHc2iHMMuQTKqM2sbztAHEqLa0skw',
  authDomain: 'pos-inventorysaas.firebaseapp.com',
  projectId: 'pos-inventorysaas',
  storageBucket: 'pos-inventorysaas.firebasestorage.app',
  messagingSenderId: '675049225203',
  appId: '1:675049225203:web:7a89428072bc814671b086',
  functionsRegion: 'us-central1',
  useEmulators: false,
  emulatorHost: '127.0.0.1',
  emulatorAuthPort: 9099,
  emulatorFirestorePort: 8080,
  emulatorFunctionsPort: 5001
};

export function isFirebaseConfigured(config: FirebaseConfig): boolean {
  return config.projectId.trim().length > 0;
}
