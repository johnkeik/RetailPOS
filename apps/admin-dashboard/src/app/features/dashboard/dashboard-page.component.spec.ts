import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ExpensesService } from '../expenses/expenses.service';
import { InventoryService } from '../inventory/inventory.service';
import { SalesHistoryService } from '../sales-history/sales-history.service';
import { DashboardPageComponent } from './dashboard-page.component';
import { DashboardTempSeedService } from './dashboard-temp-seed.service';

// Currency formatting uses a non-breaking space before the euro sign.
const normalize = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();

describe('DashboardPageComponent month summary', () => {
  let fixture: ComponentFixture<DashboardPageComponent>;
  let loadOrders: jasmine.Spy;
  let loadExpenses: jasmine.Spy;
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 10);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15, 10);

  beforeEach(async () => {
    loadOrders = jasmine.createSpy('loadOrders').and.resolveTo();
    loadExpenses = jasmine.createSpy('loadExpenses').and.resolveTo();
    const order = (total: number, paymentMethod: string, createdAt: Date, status = 'COMPLETED') =>
      ({ id: Math.random().toString(36), total, paymentMethod, createdAt: createdAt.toISOString(), status, employeeName: 'Μαρία', itemCount: 1 });
    const expense = (amount: number, paymentMethod: string, voided = false) =>
      ({ id: Math.random().toString(36), amount, paymentMethod, createdAt: thisMonth, voided });

    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideRouter([]),
        { provide: DashboardTempSeedService, useValue: { loading: signal(false), status: signal(null), error: signal(null) } },
        { provide: InventoryService, useValue: { inventoryRows: signal([]), loading: signal(false), error: signal(null), loadInventory: () => Promise.resolve() } },
        {
          provide: SalesHistoryService,
          useValue: {
            orders: signal([
              order(100, 'CASH', thisMonth),
              order(50, 'CARD', thisMonth),
              order(40, 'CARD', thisMonth, 'CANCELLED'),
              order(999, 'CASH', lastMonth)
            ]),
            loading: signal(false),
            error: signal(null),
            loadOrders
          }
        },
        {
          provide: ExpensesService,
          useValue: {
            expenses: signal([expense(30, 'CASH'), expense(20, 'CASH', true)]),
            loading: signal(false),
            error: signal(null),
            load: loadExpenses
          }
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
  });

  it('counts only this month, without cancelled orders or voided expenses', () => {
    const figures = [...fixture.nativeElement.querySelectorAll('.month-figures dd')].map((el: HTMLElement) => normalize(el.textContent));
    expect(figures).toEqual(['150,00 €', '30,00 €', '120,00 €']);
    expect(normalize(fixture.nativeElement.querySelector('.month-balance').textContent)).toContain('70,00 €');
  });

  it('fetches orders from whichever is earlier, the 1st of the month or 7 days ago, and only this month of expenses', () => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const expectedFrom = weekStart < monthStart ? weekStart : monthStart;
    expect(loadOrders).toHaveBeenCalledOnceWith({ from: expectedFrom });
    expect(loadExpenses).toHaveBeenCalledOnceWith({ from: monthStart, to: null });
  });
});
