import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SalesHistoryPageComponent } from './sales-history-page.component';
import { SalesHistoryRow, SalesHistoryService } from './sales-history.service';

function orders(count: number): SalesHistoryRow[] {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => ({
    id: `order-${String(index).padStart(3, '0')}`,
    status: index < 4 ? 'CANCELLED' : 'COMPLETED',
    tenantId: 't',
    employeeId: 'e1',
    employeeName: index % 2 ? 'Μαρία' : 'Νίκος',
    paymentMethod: 'CASH',
    total: 10,
    items: [],
    itemCount: 1,
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, index).toISOString()
  }) as unknown as SalesHistoryRow);
}

describe('SalesHistoryPageComponent pagination', () => {
  let fixture: ComponentFixture<SalesHistoryPageComponent>;
  let loadOrders: jasmine.Spy;
  const rows = signal<SalesHistoryRow[]>([]);

  beforeEach(async () => {
    rows.set(orders(60));
    loadOrders = jasmine.createSpy('loadOrders').and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [SalesHistoryPageComponent],
      providers: [provideRouter([]), { provide: SalesHistoryService, useValue: { orders: rows, loading: signal(false), error: signal(null), loadOrders } }]
    }).compileComponents();
    fixture = TestBed.createComponent(SalesHistoryPageComponent);
    fixture.detectChanges();
  });

  const bodyRows = () => fixture.nativeElement.querySelectorAll('tbody tr').length;
  const summary = () => (fixture.nativeElement.querySelector('.pagination-bar span') as HTMLElement).textContent!.replace(/\s+/g, ' ').trim();
  const button = (label: string) => [...fixture.nativeElement.querySelectorAll('.pagination-bar button')]
    .find((item: HTMLButtonElement) => item.textContent?.trim() === label) as HTMLButtonElement;

  it('loads the current month and shows 25 orders per page', () => {
    const now = new Date();
    expect(loadOrders.calls.mostRecent().args[0].from).toEqual(new Date(now.getFullYear(), now.getMonth(), 1));
    expect(bodyRows()).toBe(25);
    expect(summary()).toBe('1–25 από 60 παραγγελίες');
    expect(button('Προηγούμενη').disabled).toBeTrue();
  });

  it('moves between pages and stops at the last one', () => {
    button('Επόμενη').click(); fixture.detectChanges();
    button('Επόμενη').click(); fixture.detectChanges();
    expect(bodyRows()).toBe(10);
    expect(summary()).toBe('51–60 από 60 παραγγελίες');
    expect(button('Επόμενη').disabled).toBeTrue();
  });

  it('returns to the first page when the search changes', () => {
    button('Επόμενη').click(); fixture.detectChanges();
    const search = fixture.nativeElement.querySelector('.search input') as HTMLInputElement;
    search.value = 'Μαρία';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(summary()).toBe('1–25 από 30 παραγγελίες');
  });

  it('filters by status with counts on the chips', () => {
    const chips = [...fixture.nativeElement.querySelectorAll('.status-filter .chip')] as HTMLButtonElement[];
    expect(chips.map((chip) => chip.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Όλες 60', 'Ολοκληρωμένες 56', 'Ακυρωμένες 4', 'Χειροκίνητες εκπτώσεις 0']);
    chips[2].click(); fixture.detectChanges();
    expect(summary()).toBe('1–4 από 4 παραγγελίες');
  });

  it('narrows to manual discounts and sums them per reason, skipping cancelled orders', () => {
    const discounts = [
      { percentage: 20, details: 'Προσωπικό', amount: 2 },
      { percentage: 100, details: 'Αυτοπαράδοση', amount: 10 },
      { percentage: 20, details: 'Προσωπικό', amount: 2.5 },
    ];
    // order-003 is cancelled, so its discount is listed but not summed.
    rows.update((list) => list.map((row, index) =>
      index === 3 ? { ...row, manualDiscount: { percentage: 50, details: 'Άλλο', amount: 5 } } :
      index >= 10 && index < 13 ? { ...row, manualDiscount: discounts[index - 10] } : row));
    fixture.detectChanges();
    const chip = [...fixture.nativeElement.querySelectorAll('.status-filter .chip')].pop() as HTMLButtonElement;
    expect(chip.textContent!.replace(/\s+/g, ' ').trim()).toBe('Χειροκίνητες εκπτώσεις 4');
    chip.click(); fixture.detectChanges();
    expect(summary()).toBe('1–4 από 4 παραγγελίες');
    const text = (fixture.nativeElement.querySelector('.discount-summary') as HTMLElement).textContent!.replace(/\s+/g, ' ').trim();
    expect(text).toContain('3 παραγγελίες με έκπτωση:');
    expect(text).toContain('Αυτοπαράδοση');
    expect(text).not.toContain('Άλλο');
    expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('Αυτοπαράδοση 100%');
  });
});
