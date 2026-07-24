import { InjectionToken, Provider } from '@angular/core';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  Firestore,
  connectFirestoreEmulator,
  getFirestore
} from 'firebase/firestore';
import { Functions, connectFunctionsEmulator, getFunctions } from 'firebase/functions';

import { firebaseConfig, isFirebaseConfigured } from './firebase.config';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');
export const FIREBASE_FIRESTORE = new InjectionToken<Firestore>('FIREBASE_FIRESTORE');
export const FIREBASE_FUNCTIONS = new InjectionToken<Functions>('FIREBASE_FUNCTIONS');

let emulatorsConnected = false;

function getOrCreateApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

function connectEmulators(auth: Auth, firestore: Firestore, functions: Functions): void {
  if (!firebaseConfig.useEmulators || emulatorsConnected) {
    return;
  }

  connectAuthEmulator(
    auth,
    `http://${firebaseConfig.emulatorHost}:${firebaseConfig.emulatorAuthPort}`,
    { disableWarnings: true }
  );
  connectFirestoreEmulator(
    firestore,
    firebaseConfig.emulatorHost,
    firebaseConfig.emulatorFirestorePort
  );
  connectFunctionsEmulator(
    functions,
    firebaseConfig.emulatorHost,
    firebaseConfig.emulatorFunctionsPort
  );

  emulatorsConnected = true;
}

export function provideFirebase(): Provider[] {
  if (!isFirebaseConfigured(firebaseConfig)) {
    return [];
  }

  return [
    {
      provide: FIREBASE_APP,
      useFactory: () => getOrCreateApp()
    },
    {
      provide: FIREBASE_AUTH,
      deps: [FIREBASE_APP],
      useFactory: (app: FirebaseApp) => {
        const auth = getAuth(app);
        const firestore = getFirestore(app);
        const functions = getFunctions(app, firebaseConfig.functionsRegion);
        connectEmulators(auth, firestore, functions);
        return auth;
      }
    },
    {
      provide: FIREBASE_FIRESTORE,
      deps: [FIREBASE_APP],
      useFactory: (app: FirebaseApp) => {
        const auth = getAuth(app);
        const firestore = getFirestore(app);
        const functions = getFunctions(app, firebaseConfig.functionsRegion);
        connectEmulators(auth, firestore, functions);
        return firestore;
      }
    },
    {
      provide: FIREBASE_FUNCTIONS,
      deps: [FIREBASE_APP],
      useFactory: (app: FirebaseApp) => {
        const auth = getAuth(app);
        const firestore = getFirestore(app);
        const functions = getFunctions(app, firebaseConfig.functionsRegion);
        connectEmulators(auth, firestore, functions);
        return functions;
      }
    }
  ];
}
