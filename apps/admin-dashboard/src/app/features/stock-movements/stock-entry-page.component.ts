import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { StockEntryComponent } from './stock-entry.component';

@Component({
  selector: 'app-stock-entry-page',
  imports: [RouterLink, PageTitleComponent, StockEntryComponent],
  template: `
    <app-page-title
      title="Νέα Κίνηση Αποθέματος"
      subtitle="Καταχωρίστε παραλαβή, απογραφή ή απώλεια για πολλά είδη με μία κίνηση."
    />
    <a class="back-link" routerLink="/stock-movements">← Πίσω στο ιστορικό</a>
    <app-stock-entry (saved)="backToHistory()" />
  `,
  styles: [
    `
      .back-link {
        display: inline-block;
        margin-bottom: 12px;
        color: #1d4ed8;
        font-size: 0.9rem;
        text-decoration: none;
      }

      .back-link:hover {
        text-decoration: underline;
      }
    `
  ]
})
export class StockEntryPageComponent {
  private readonly router = inject(Router);

  protected backToHistory(): void {
    void this.router.navigateByUrl('/stock-movements', { state: { saved: true } });
  }
}
