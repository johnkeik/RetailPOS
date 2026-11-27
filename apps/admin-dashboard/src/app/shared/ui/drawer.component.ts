import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

let nextId = 0;

/**
 * Slide-over panel for create/edit forms. Built on a modal <dialog> so focus is
 * trapped and Esc closes it. The parent owns the open state.
 */
@Component({
  selector: 'app-drawer',
  template: `
    <dialog #dialog class="drawer" [class.wide]="size() === 'wide'" [attr.aria-labelledby]="titleId"
      (cancel)="$event.preventDefault(); closed.emit()" (click)="onBackdropClick($event)">
      <header class="drawer-header">
        <h3 [id]="titleId">{{ title() }}</h3>
        <button type="button" class="drawer-close" aria-label="Κλείσιμο" (click)="closed.emit()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div class="drawer-body"><ng-content /></div>
    </dialog>
  `,
  styles: [
    `
      .drawer {
        position: fixed;
        inset: 0 0 0 auto;
        width: min(440px, 100vw);
        max-width: none;
        height: 100dvh;
        max-height: 100dvh;
        margin: 0;
        padding: 0;
        border: 0;
        background: var(--surface);
        color: var(--ink);
        box-shadow: -12px 0 40px rgb(42 36 51 / 0.16);
      }

      .drawer.wide {
        width: min(600px, 100vw);
      }

      .drawer[open] {
        display: flex;
        flex-direction: column;
        animation: drawer-in 180ms ease-out;
      }

      .drawer::backdrop {
        background: rgb(42 36 51 / 0.35);
      }

      .drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 16px 14px 24px;
        border-bottom: 1px solid var(--line);
      }

      .drawer-header h3 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
      }

      .drawer-close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--ink-soft);
        cursor: pointer;
      }

      .drawer-close:hover {
        background: var(--paper);
        color: var(--ink);
      }

      .drawer-body {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-height: 0;
        overflow-y: auto;
      }

      @keyframes drawer-in {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }

      @media (prefers-reduced-motion: reduce) {
        .drawer.wide {
        width: min(600px, 100vw);
      }

      .drawer[open] { animation: none; }
      }
    `
  ]
})
export class DrawerComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  /** 'wide' for forms with lists to pick from, such as promotions. */
  readonly size = input<'default' | 'wide'>('default');
  readonly closed = output<void>();

  protected readonly titleId = `drawer-title-${++nextId}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      if (!this.open() && dialog.open) dialog.close();
    });
  }

  protected onBackdropClick(event: MouseEvent): void {
    const dialog = this.dialog().nativeElement;
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) this.closed.emit();
  }
}
