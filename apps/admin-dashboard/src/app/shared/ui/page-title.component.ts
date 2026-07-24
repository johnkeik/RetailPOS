import { NgIf } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-title',
  imports: [NgIf],
  template: `
    <header class="page-title">
      <h2>{{ title() }}</h2>
      <p *ngIf="subtitle()">{{ subtitle() }}</p>
    </header>
  `,
  styles: [
    `
      .page-title {
        margin-bottom: 16px;
      }

      .page-title h2 {
        margin: 0;
        font-size: 1.25rem;
      }

      .page-title p {
        margin: 4px 0 0;
        color: #4b5563;
        font-size: 0.95rem;
      }
    `
  ]
})
export class PageTitleComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
