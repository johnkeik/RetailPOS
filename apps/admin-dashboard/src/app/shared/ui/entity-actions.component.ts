import { Component, input, output } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';

/**
 * Row actions for list tables: a visible edit button, with the less frequent
 * (and destructive) actions tucked into a "more" menu.
 */
@Component({
  selector: 'app-entity-actions',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem],
  template: `
    <div class="actions-group">
      <button type="button" class="icon-btn" title="Επεξεργασία" aria-label="Επεξεργασία" (click)="edit.emit()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-4-4L4 16v4Z" />
          <path d="m13.5 6.5 4 4" />
        </svg>
      </button>
      <button type="button" class="icon-btn" title="Περισσότερα" aria-label="Περισσότερες ενέργειες" [cdkMenuTriggerFor]="menu">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
    </div>

    <ng-template #menu>
      <div class="row-menu" cdkMenu>
        @if (showToggle()) {
          <button type="button" class="row-menu-item" cdkMenuItem (cdkMenuItemTriggered)="toggleActive.emit()">
            {{ active() ? 'Απενεργοποίηση' : 'Ενεργοποίηση' }}
          </button>
        }
        <button type="button" class="row-menu-item danger" cdkMenuItem (cdkMenuItemTriggered)="delete.emit()">
          {{ deleteLabel() }}
        </button>
      </div>
    </ng-template>
  `,
  styles: [
    `
      .actions-group {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }

      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        padding: 0;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--ink-soft);
        cursor: pointer;
      }

      .icon-btn:hover,
      .icon-btn[aria-expanded='true'] {
        background: var(--paper);
        color: var(--ink);
      }
    `
  ]
})
export class EntityActionsComponent {
  readonly active = input<boolean>(true);
  readonly showToggle = input<boolean>(true);
  /** Some records are voided rather than deleted, e.g. expenses. */
  readonly deleteLabel = input('Διαγραφή');
  readonly edit = output<void>();
  readonly toggleActive = output<void>();
  readonly delete = output<void>();
}
