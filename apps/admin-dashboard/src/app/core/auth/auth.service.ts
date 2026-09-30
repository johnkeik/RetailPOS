import { Injectable, inject, signal } from '@angular/core';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { FIREBASE_AUTH } from '../firebase/firebase.providers';
import { AppUser } from '../types/app-user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);

  readonly currentUser = signal<AppUser | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  async signIn(email: string, password: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = credential.user;

      this.currentUser.set({
        uid: user.uid,
        tenantId: 'store001',
        role: 'OWNER',
        email: user.email ?? email
      });
    } catch (error) {
      console.error(error);
      this.error.set('Unable to sign in. Check the emulator and credentials.');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  signOut(): void {
    this.currentUser.set(null);
    this.error.set(null);
  }
}
