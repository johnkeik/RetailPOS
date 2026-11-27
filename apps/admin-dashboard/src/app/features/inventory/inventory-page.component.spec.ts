import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InventoryPageComponent } from './inventory-page.component';
import { InventoryRow, InventoryService } from './inventory.service';

function row(partial: Partial<InventoryRow>): InventoryRow {
  return {
    id: partial.id ?? Math.random().toString(36),
    tenantId: 't',
    productId: 'p1',
    variantId: '',
    variantTemplateId: 'perfume',
    quantity: 0,
    updatedAt: '2026-11-20T10:00:00.000Z',
    productName: 'Sauvage',
    productCode: '226',
    variantTemplateName: '',
    packagingType: 'BULK',
    isBulk: true,
    isConsumable: false,
    displayQty: '',
    consumableParts: [],
    ...partial
  } as InventoryRow;
}

describe('InventoryPageComponent', () => {
  let fixture: ComponentFixture<InventoryPageComponent>;
  const rows = signal<InventoryRow[]>([]);

  beforeEach(async () => {
    rows.set([
      row({ id: 'a', productId: 'p1', variantTemplateId: 'perfume', quantity: 2000 }),
      row({ id: 'b', productId: 'p1', variantTemplateId: 'essence', quantity: 0, updatedAt: '2026-11-25T10:00:00.000Z' }),
      row({ id: 'c', productId: 'p2', productName: 'Aventus', variantTemplateId: 'perfume', quantity: 300 }),
      row({ id: 'd', productId: 'c1', productName: 'Μπουκάλι 50ml', variantTemplateId: 'consumable', isBulk: false, isConsumable: true, quantity: 40 })
    ]);
    await TestBed.configureTestingModule({
      imports: [InventoryPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: InventoryService,
          useValue: { inventoryRows: rows, loading: signal(false), error: signal(null), loadInventory: () => Promise.resolve() }
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryPageComponent);
    fixture.detectChanges();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const bodyRows = () => fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;

  it('shows base and essence of a perfume on one row, flagged by its worst level', () => {
    expect(bodyRows().length).toBe(2);
    const sauvage = [...bodyRows()].find((tr) => tr.textContent?.includes('Sauvage'))!;
    expect(sauvage.textContent).toContain('2 L');
    expect(sauvage.textContent).toContain('Εξαντλήθηκε');
    expect(sauvage.textContent).toContain('25 Νοε');
  });

  it('counts and filters by stock status within the active tab', () => {
    const chips = fixture.nativeElement.querySelectorAll('.chip') as NodeListOf<HTMLButtonElement>;
    expect(chips[0].textContent).toContain('2');
    expect(chips[1].textContent).toContain('1');
    expect(chips[2].textContent).toContain('1');

    chips[2].click();
    fixture.detectChanges();
    expect(bodyRows().length).toBe(1);
    expect(bodyRows()[0].textContent).toContain('Sauvage');
  });

  it('lists consumables under their own tab', () => {
    const tabs = fixture.nativeElement.querySelectorAll('.tab') as NodeListOf<HTMLButtonElement>;
    expect([...tabs].map((tab) => tab.textContent?.trim().split(' ')[0])).toEqual(['Αρώματα', 'Αναλώσιμα']);
    tabs[1].click();
    fixture.detectChanges();
    expect(bodyRows().length).toBe(1);
    expect(text()).toContain('40 τεμ.');
  });

  const headerButton = (label: string) => [...fixture.nativeElement.querySelectorAll('.sort-btn')]
    .find((button: HTMLButtonElement) => button.textContent?.trim() === label) as HTMLButtonElement;
  const firstNames = () => [...bodyRows()].map((tr) => tr.querySelector('.cell-title')?.textContent?.trim());

  it('sorts by base, lowest first, and reverses on a second click', () => {
    expect(firstNames()).toEqual(['Aventus', 'Sauvage']);
    headerButton('Βάση').click(); fixture.detectChanges();
    expect(firstNames()).toEqual(['Aventus', 'Sauvage']);
    expect(headerButton('Βάση').closest('th')!.getAttribute('aria-sort')).toBe('ascending');
    headerButton('Βάση').click(); fixture.detectChanges();
    expect(firstNames()).toEqual(['Sauvage', 'Aventus']);
    expect(headerButton('Βάση').closest('th')!.getAttribute('aria-sort')).toBe('descending');
  });

  it('pages long lists 25 at a time', () => {
    rows.set(Array.from({ length: 30 }, (_, index) =>
      row({ id: `r${index}`, productId: `p${index}`, productName: `Άρωμα ${String(index).padStart(2, '0')}`, quantity: 1000 + index })
    ));
    fixture.detectChanges();
    expect(bodyRows().length).toBe(25);
    const next = [...fixture.nativeElement.querySelectorAll('.pagination-bar button')]
      .find((button: HTMLButtonElement) => button.textContent?.trim() === 'Επόμενη') as HTMLButtonElement;
    next.click(); fixture.detectChanges();
    expect(bodyRows().length).toBe(5);
    expect((fixture.nativeElement.querySelector('.pagination-bar span') as HTMLElement).textContent!.replace(/\s+/g, ' ').trim())
      .toBe('26–30 από 30 είδη');
  });
});
