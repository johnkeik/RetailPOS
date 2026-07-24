export type AppUserRole = 'OWNER' | 'EMPLOYEE';

export type AppUser = {
  uid: string;
  tenantId: string;
  role: AppUserRole;
  email: string;
};
