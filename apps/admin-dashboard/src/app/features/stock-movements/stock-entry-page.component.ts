import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { StockEntryComponent } from './stock-entry.component';

@Component({
  selector: 'app-stock-entry-page',
  imports: [PageTitleComponent, StockEntryComponent],
  template: `
    <app-page-title title="Νέα κίνηση αποθέματος" backLink="/stock-movements" backLabel="Κινήσεις αποθέματος" />
    <app-stock-entry (saved)="backToHistory()" />
  `
})
export class StockEntryPageComponent {
  private readonly router = inject(Router);

  protected backToHistory(): void {
    void this.router.navigateByUrl('/stock-movements', { state: { saved: true } });
  }
}
