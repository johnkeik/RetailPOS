import { Component, inject, OnInit } from '@angular/core';
import { NgFor } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { TenantContextService } from '../auth/tenant-context.service';

type NavItem = {
  label: string;
  path: string;
};

@Component({
  selector: 'app-admin-shell',
  imports: [NgFor, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss'
})
export class AdminShellComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly router = inject(Router);

  protected readonly navItems: NavItem[] = [
    { label: 'Πίνακας Ελέγχου', path: '/dashboard' },
    { label: 'Προϊόντα', path: '/products' },
    { label: 'Μάρκες', path: '/brands' },
    { label: 'Κατηγορίες', path: '/categories' },
    { label: 'Υπάλληλοι', path: '/employees' },
    { label: 'Αναλώσιμα', path: '/consumables' },
    { label: 'Παραλλαγές', path: '/variants' },
    { label: 'Απόθεμα', path: '/inventory' },
    { label: 'Κινήσεις Αποθέματος', path: '/stock-movements' },
    { label: 'Ιστορικό Πωλήσεων', path: '/sales-history' }
  ];

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user?.tenantId) {
      this.tenantContext.setTenant(user.tenantId);
    }
  }

  protected async signOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigate(['/login']);
  }
}
