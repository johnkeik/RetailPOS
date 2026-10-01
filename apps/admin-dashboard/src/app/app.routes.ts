import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { LoginPageComponent } from './core/auth/login-page.component';
import { AdminShellComponent } from './core/layout/admin-shell.component';
import { BrandsPageComponent } from './features/brands/brands-page.component';
import { CategoriesPageComponent } from './features/categories/categories-page.component';
import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';
import { EmployeesPageComponent } from './features/employees/employees-page.component';
import { ConsumablesPageComponent } from './features/consumables/consumables-page.component';
import { InventoryPageComponent } from './features/inventory/inventory-page.component';
import { ProductsPageComponent } from './features/products/products-page.component';
import { SalesHistoryPageComponent } from './features/sales-history/sales-history-page.component';
import { StockMovementsPageComponent } from './features/stock-movements/stock-movements-page.component';
import { VariantsPageComponent } from './features/variants/variants-page.component';

export const routes: Routes = [
	{
		path: 'login',
		component: LoginPageComponent
	},
	{
		path: '',
		component: AdminShellComponent,
		canActivate: [authGuard],
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
				path: 'products',
				component: ProductsPageComponent
			},
			{
				path: 'brands',
				component: BrandsPageComponent
			},
			{
				path: 'categories',
				component: CategoriesPageComponent
			},
			{
				path: 'employees',
				component: EmployeesPageComponent
			},
			{
				path: 'consumables',
				component: ConsumablesPageComponent
			},
			{
				path: 'variants',
				component: VariantsPageComponent
			},
			{
				path: 'inventory',
				component: InventoryPageComponent
			},
			{
				path: 'stock-movements',
				component: StockMovementsPageComponent
			},
			{
				path: 'sales-history',
				component: SalesHistoryPageComponent
			}
		]
	},
	{
		path: '**',
		redirectTo: ''
	}
];
