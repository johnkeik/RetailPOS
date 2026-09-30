import { Component, inject } from '@angular/core';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { DashboardTempSeedService } from './dashboard-temp-seed.service';

@Component({
  selector: 'app-dashboard-page',
  imports: [PageTitleComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss'
})
export class DashboardPageComponent {
  private readonly tempSeedService = inject(DashboardTempSeedService);

  protected readonly seedLoading = this.tempSeedService.loading;
  protected readonly seedStatus = this.tempSeedService.status;
  protected readonly seedError = this.tempSeedService.error;

  protected async seedMockCatalog(): Promise<void> {
    await this.tempSeedService.seedMockCatalog();
  }

  protected async seedMockInventory(): Promise<void> {
    await this.tempSeedService.seedMockInventory();
  }

  protected async seedMockSalesHistory(): Promise<void> {
    await this.tempSeedService.seedMockSalesHistory();
  }
}