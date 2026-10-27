import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const ownerGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.authReady;

  const user = authService.currentUser();
  if (user?.role === 'OWNER') return true;
  if (user?.role === 'EMPLOYEE') return router.createUrlTree(['/employee/receiving']);
  return router.createUrlTree(['/login']);
};

export const employeeGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.authReady;

  const user = authService.currentUser();
  if (user?.role === 'EMPLOYEE') return true;
  if (user?.role === 'OWNER') return router.createUrlTree(['/dashboard']);
  return router.createUrlTree(['/login']);
};
