import { Component, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { TenantContextService } from '../auth/tenant-context.service';

type NavItem = {
  label: string;
  path: string;
};

@Component({
  selector: 'app-admin-shell',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss'
})
export class AdminShellComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly router = inject(Router);

  private readonly document = inject(DOCUMENT);
  private readonly mobileDialog = viewChild<ElementRef<HTMLDialogElement>>('mobileDialog');
  protected readonly mobileMenuOpen = signal(false);
  private previousOverflow: string | null = null;

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) this.closeMobileMenu();
    });
  }

  protected openMobileMenu(): void {
    const dialog = this.mobileDialog()?.nativeElement;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    this.previousOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.mobileMenuOpen.set(true);
  }

  protected closeMobileMenu(): void {
    this.mobileDialog()?.nativeElement.close();
    this.onMobileMenuClosed();
  }

  protected onMobileMenuClosed(): void {
    if (this.mobileDialog()?.nativeElement.open) return;
    this.mobileMenuOpen.set(false);
    if (this.previousOverflow !== null) {
      this.document.body.style.overflow = this.previousOverflow;
      this.previousOverflow = null;
    }
  }

  protected dismissBackdrop(event: MouseEvent): void {
    const dialog = this.mobileDialog()?.nativeElement;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) this.closeMobileMenu();
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (this.document.defaultView?.matchMedia('(min-width: 901px)').matches) this.closeMobileMenu();
  }

  ngOnDestroy(): void {
    this.closeMobileMenu();
  }

  protected readonly navSections: { label: string; items: NavItem[] }[] = [
    {
      label: '',
      items: [{ label: 'Επισκόπηση', path: '/dashboard' }]
    },
    {
      label: 'Παρακολούθηση',
      items: [
        { label: 'Ιστορικό πωλήσεων', path: '/sales-history' },
        { label: 'Αναφορά πωλήσεων', path: '/sales-report' },
        { label: 'Έξοδα', path: '/expenses' },
        { label: 'Απόθεμα', path: '/inventory' },
        { label: 'Κινήσεις αποθέματος', path: '/stock-movements' }
      ]
    },
    {
      label: 'Διαχείριση',
      items: [
        { label: 'Προϊόντα', path: '/products' },
        { label: 'Παραλλαγές', path: '/variants' },
        { label: 'Προσφορές', path: '/promotions' },
        { label: 'Μάρκες', path: '/brands' },
        { label: 'Κατηγορίες', path: '/categories' },
        { label: 'Αναλώσιμα', path: '/consumables' },
        { label: 'Υπάλληλοι', path: '/employees' }
      ]
    }
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
