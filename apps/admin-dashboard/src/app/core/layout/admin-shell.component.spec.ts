import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { TenantContextService } from '../auth/tenant-context.service';
import { AdminShellComponent } from './admin-shell.component';

@Component({ template: '' })
class EmptyPage {}

describe('Admin mobile navigation', () => {
  let fixture: ComponentFixture<AdminShellComponent>;
  let dialog: HTMLDialogElement;
  let toggle: HTMLButtonElement;
  let originalOverflow: string;

  beforeEach(async () => {
    originalOverflow = document.body.style.overflow;
    await TestBed.configureTestingModule({
      imports: [AdminShellComponent],
      providers: [
        provideRouter([{ path: 'products', component: EmptyPage }]),
        { provide: AuthService, useValue: { currentUser: signal(null), signOut: jasmine.createSpy().and.resolveTo() } },
        { provide: TenantContextService, useValue: { setTenant: jasmine.createSpy() } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();
    dialog = fixture.nativeElement.querySelector('dialog');
    toggle = fixture.nativeElement.querySelector('.menu-toggle');
  });

  afterEach(() => {
    fixture.destroy();
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  function open(): void {
    toggle.focus(); toggle.click(); fixture.detectChanges();
  }

  it('opens an accessible modal with all grouped destinations and restores focus on close', async () => {
    open();
    expect(dialog.open).toBeTrue();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(dialog.querySelectorAll('.nav-group').length).toBe(3);
    expect(dialog.querySelectorAll('a').length).toBe(13);
    const close = dialog.querySelector('.menu-close') as HTMLButtonElement;
    expect(document.activeElement).toBe(close);
    close.click(); await fixture.whenStable(); fixture.detectChanges();
    expect(dialog.open).toBeFalse();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('closes on cancel and backdrop clicks', () => {
    open(); dialog.dispatchEvent(new Event('cancel', { cancelable: true })); fixture.detectChanges();
    expect(dialog.open).toBeFalse();
    open();
    const rect = dialog.getBoundingClientRect();
    dialog.dispatchEvent(new MouseEvent('click', { clientX: rect.right + 10, clientY: rect.top + 10 }));
    expect(dialog.open).toBeFalse();
  });

  it('keeps the menu state correct if reopened before the previous close event arrives', async () => {
    open(); (dialog.querySelector('.menu-close') as HTMLButtonElement).click();
    open(); await fixture.whenStable(); fixture.detectChanges();
    expect(dialog.open).toBeTrue();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on navigation and marks the destination as current', async () => {
    open();
    (dialog.querySelector('a[href="/products"]') as HTMLAnchorElement).click();
    await fixture.whenStable(); fixture.detectChanges();
    expect(dialog.open).toBeFalse();
    expect(TestBed.inject(Router).url).toBe('/products');
    expect(fixture.nativeElement.querySelector('.sidebar a[href="/products"]').getAttribute('aria-current')).toBe('page');
  });

  it('closes when resizing to desktop and restores scrolling on destruction', () => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    open(); window.dispatchEvent(new Event('resize')); fixture.detectChanges();
    expect(dialog.open).toBeFalse();
    open(); fixture.destroy();
    expect(document.body.style.overflow).toBe(originalOverflow);
  });
});
