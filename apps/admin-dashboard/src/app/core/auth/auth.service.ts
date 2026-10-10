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
import { doc, getDoc } from 'firebase/firestore';

import { FIREBASE_AUTH, FIREBASE_FIRESTORE } from '../firebase/firebase.providers';
import { AppUser } from '../types/app-user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly firestore = inject(FIREBASE_FIRESTORE);
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
        if (user) {
          void this.restoreUser(user);
        } else {
          this.currentUser.set(null);
          this.resolveAuthReady();
        }
      },
      () => {
        this.currentUser.set(null);
        this.resolveAuthReady();
      }
    );
  }

  async signIn(email: string, password: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await setPersistence(this.auth, browserLocalPersistence);
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      this.currentUser.set(await this.readAdminProfile(credential.user));
    } catch (error) {
      console.error(error);
      if (this.auth.currentUser) {
        await firebaseSignOut(this.auth);
      }
      this.currentUser.set(null);
      this.error.set(error instanceof Error && error.message.startsWith('Ο λογαριασμός')
        ? error.message
        : 'Αποτυχία σύνδεσης. Ελέγξτε email και κωδικό.');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
    this.currentUser.set(null);
    this.error.set(null);
  }

  private async restoreUser(user: User): Promise<void> {
    try {
      this.currentUser.set(await this.readAdminProfile(user));
    } catch (error) {
      this.currentUser.set(null);
      this.error.set(error instanceof Error ? error.message : 'Ο λογαριασμός δεν είναι εξουσιοδοτημένος.');
      await firebaseSignOut(this.auth);
    } finally {
      this.resolveAuthReady();
    }
  }

  private async readAdminProfile(user: User): Promise<AppUser> {
    const profile = await getDoc(doc(this.firestore, 'users', user.uid));
    const data = profile.data() as { tenantId?: string; role?: string; active?: boolean } | undefined;
    if (!profile.exists() || data?.active === false || !data?.tenantId || data.role !== 'OWNER') {
      throw new Error('Ο λογαριασμός δεν έχει ενεργό προφίλ διαχειριστή.');
    }

    return {
      uid: user.uid,
      tenantId: data.tenantId,
      role: 'OWNER',
      email: user.email ?? ''
    };
  }
}
