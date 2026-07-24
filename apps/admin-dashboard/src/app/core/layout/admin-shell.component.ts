import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

type NavItem = {
  label: string;
  path: string;
};

@Component({
  selector: 'app-admin-shell',
  imports: [NgFor, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss'
})
export class AdminShellComponent {
  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Products', path: '/products' },
    { label: 'Brands', path: '/brands' },
    { label: 'Categories', path: '/categories' },
    { label: 'Variants', path: '/variants' },
    { label: 'Inventory', path: '/inventory' },
    { label: 'Stock Movements', path: '/stock-movements' },
    { label: 'Sales History', path: '/sales-history' }
  ];
}
