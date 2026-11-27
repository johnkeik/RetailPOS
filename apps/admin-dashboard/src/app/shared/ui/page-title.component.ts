import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-title',
  imports: [RouterLink],
  template: `
    <header class="page-title">
      <div class="page-title-text">
        @if (backLink()) {
          <a class="page-back" [routerLink]="backLink()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            {{ backLabel() }}
          </a>
        }
        <h2>{{ title() }}</h2>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <div class="page-title-actions"><ng-content /></div>
    </header>
  `,
  styles: [
    `
      .page-title {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px 24px;
        margin-bottom: 28px;
      }

      .page-title h2 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: -0.02em;
        color: var(--ink);
      }

      .page-title p {
        margin: 6px 0 0;
        max-width: 64ch;
        color: var(--ink-soft);
        font-size: 0.9375rem;
      }

      .page-back {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin: 0 0 8px -4px;
        color: var(--ink-soft);
        font-size: 0.875rem;
        text-decoration: none;
      }

      .page-back:hover {
        color: var(--ink);
      }

      .page-title-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }

      .page-title-actions:empty {
        display: none;
      }
    `
  ]
})
export class PageTitleComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  /** Full-page forms link back to the list they came from. */
  readonly backLink = input<string>('');
  readonly backLabel = input<string>('');
}
