import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-entity-actions',
  standalone: true,
  template: `
    <div class="actions-group">
      <!-- Edit button -->
      <button
        type="button"
        class="icon-btn edit-btn"
        title="Επεξεργασία"
        aria-label="Επεξεργασία"
        (click)="edit.emit()"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>

      <!-- Toggle Active button -->
      <button
        type="button"
        class="icon-btn toggle-btn"
        [class.active]="active()"
        [title]="active() ? 'Απενεργοποίηση' : 'Ενεργοποίηση'"
        [attr.aria-label]="active() ? 'Απενεργοποίηση' : 'Ενεργοποίηση'"
        (click)="toggleActive.emit()"
      >
        @if (active()) {
          <!-- Power Active -->
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
            <line x1="12" y1="2" x2="12" y2="12"></line>
          </svg>
        } @else {
          <!-- Power Inactive -->
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18.36 6.64a9 9 0 0 1 0 12.72m-12.72 0a9 9 0 0 1 0-12.72"></path>
            <line x1="12" y1="2" x2="12" y2="12"></line>
            <line x1="2" y1="2" x2="22" y2="22"></line>
          </svg>
        }
      </button>

      <!-- Delete button -->
      <button
        type="button"
        class="icon-btn delete-btn"
        title="Διαγραφή"
        aria-label="Διαγραφή"
        (click)="delete.emit()"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    </div>
  `,
  styles: [
    `
      .actions-group {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        background: #ffffff;
        color: #475569;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .icon-btn:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }

      .edit-btn:hover {
        color: #2563eb;
        background: #eff6ff;
        border-color: #bfdbfe;
      }

      .toggle-btn {
        color: #94a3b8;
      }

      .toggle-btn.active {
        color: #16a34a;
        background: #f0fdf4;
        border-color: #bbf7d0;
      }

      .toggle-btn.active:hover {
        background: #dcfce7;
        color: #15803d;
      }

      .toggle-btn:not(.active):hover {
        color: #ca8a04;
        background: #fefce8;
        border-color: #fef08a;
      }

      .delete-btn {
        color: #64748b;
      }

      .delete-btn:hover {
        color: #dc2626;
        background: #fef2f2;
        border-color: #fecaca;
      }
    `
  ]
})
export class EntityActionsComponent {
  readonly active = input<boolean>(true);
  readonly edit = output<void>();
  readonly toggleActive = output<void>();
  readonly delete = output<void>();
}
