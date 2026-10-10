import { Injectable, inject, signal } from '@angular/core';
import {
  Auth,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User
} from 'firebase/auth';

import { FIREBASE_AUTH } from '../firebase/firebase.providers';
import { AppUser } from '../types/app-user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private resolveAuthReady: () => void = () => {};
  readonly authReady = new Promise<void>((resolve) => {
    this.resolveAuthReady = resolve;
  });

  readonly currentUser = signal<AppUser | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    onAuthStateChanged(
      this.auth,
      (user) => {
        this.currentUser.set(user ? this.toAppUser(user) : null);
        this.resolveAuthReady();
      },
      () => {
        this.currentUser.set(null);
        this.resolveAuthReady();
      }
    );
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  async signIn(email: string, password: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await setPersistence(this.auth, browserLocalPersistence);
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      this.currentUser.set(this.toAppUser(credential.user, email));
    } catch (error) {
      console.error(error);
      this.error.set('Unable to sign in. Check the emulator and credentials.');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
    this.error.set(null);
  }

  private toAppUser(user: User, fallbackEmail?: string): AppUser {
    return {
      uid: user.uid,
      tenantId: 'store001',
      role: 'OWNER',
      email: user.email ?? fallbackEmail ?? ''
    };
  }
}
