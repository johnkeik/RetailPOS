import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { SalesHistoryService } from './sales-history.service';

@Component({
  selector: 'app-sales-history-page',
  imports: [PageTitleComponent],
  templateUrl: './sales-history-page.component.html',
  styleUrl: './sales-history-page.component.scss'
})
export class SalesHistoryPageComponent implements OnInit {
  private readonly service = inject(SalesHistoryService);

  protected readonly searchQuery = signal('');

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  ngOnInit(): void {
    void this.service.loadOrders();
  }

  protected readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    return this.service.orders().filter((row) => {
      return (
        !query ||
        row.employeeId.toLowerCase().includes(query) ||
        row.id.toLowerCase().includes(query)
      );
    });
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }
}
