import { Component } from '@angular/core';

import { PageTitleComponent } from '../../shared/ui/page-title.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [PageTitleComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss'
})
export class DashboardPageComponent {}