import { Injectable, signal } from '@angular/core';
import { AppUser } from '../types/app-user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<AppUser | null>(null);

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }
}
