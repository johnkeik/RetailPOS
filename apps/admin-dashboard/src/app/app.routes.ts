import { Routes } from '@angular/router';

import { AdminShellComponent } from './core/layout/admin-shell.component';
import { BrandsPageComponent } from './features/brands/brands-page.component';
import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';

export const routes: Routes = [
	{
		path: '',
		component: AdminShellComponent,
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'dashboard'
			},
			{
				path: 'dashboard',
				component: DashboardPageComponent
			},
			{
				path: 'brands',
				component: BrandsPageComponent
			}
		]
	},
	{
		path: '**',
		redirectTo: ''
	}
];
