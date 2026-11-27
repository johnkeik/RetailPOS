import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { StockMovementsPageComponent } from './stock-movements-page.component';
import { StockMovementRow, StockMovementsService } from './stock-movements.service';

describe('StockMovementsPageComponent period', () => {
  let fixture: ComponentFixture<StockMovementsPageComponent>;
  let loadMovements: jasmine.Spy;
  const rows = signal<StockMovementRow[]>([]);

  beforeEach(async () => {
    rows.set([]);
    loadMovements = jasmine.createSpy('loadMovements').and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [StockMovementsPageComponent],
      providers: [
        provideRouter([]),
        { provide: StockMovementsService, useValue: { movementRows: rows, loading: signal(false), error: signal(null), loadMovements } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(StockMovementsPageComponent);
    fixture.detectChanges();
  });

  it('opens on the current month with "Αυτός ο μήνας" selected', () => {
    const now = new Date();
    const { from, to } = loadMovements.calls.mostRecent().args[0] as { from: Date; to: Date };
    expect(from).toEqual(new Date(now.getFullYear(), now.getMonth(), 1));
    expect(to).toEqual(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const period = fixture.nativeElement.querySelector('#period') as HTMLSelectElement;
    expect(period.selectedOptions[0].textContent?.trim()).toBe('Αυτός ο μήνας');
  });

  it('switches the range when another period is picked', () => {
    const period = fixture.nativeElement.querySelector('#period') as HTMLSelectElement;
    period.value = '7D';
    period.dispatchEvent(new Event('change'));
    const now = new Date();
    const { from } = loadMovements.calls.mostRecent().args[0] as { from: Date };
    expect(from).toEqual(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  });

  it('pages the list 25 at a time and goes back to page 1 when the type changes', () => {
    const today = new Date();
    rows.set(Array.from({ length: 30 }, (_, index) => ({
      id: `m${index}`,
      type: index < 5 ? 'LOSS' : 'PURCHASE',
      productName: 'Άρωμα',
      productCode: 'P1',
      variantTemplateName: '50ml',
      quantityDelta: 1,
      displayDelta: '+1',
      createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, index).toISOString()
    }) as unknown as StockMovementRow));
    fixture.detectChanges();
    const summary = () => (fixture.nativeElement.querySelector('.pagination-bar span') as HTMLElement).textContent!.replace(/\s+/g, ' ').trim();
    expect(summary()).toBe('1–25 από 30 συναλλαγές');

    const next = [...fixture.nativeElement.querySelectorAll('.pagination-bar button')].find((b: HTMLButtonElement) => b.textContent?.trim() === 'Επόμενη') as HTMLButtonElement;
    next.click(); fixture.detectChanges();
    expect(summary()).toBe('26–30 από 30 συναλλαγές');

    const loss = [...fixture.nativeElement.querySelectorAll('.type-filter .chip')].find((b: HTMLButtonElement) => b.textContent?.includes('Απώλειες')) as HTMLButtonElement;
    expect(loss.textContent!.replace(/\s+/g, ' ').trim()).toBe('Απώλειες 5');
    loss.click(); fixture.detectChanges();
    expect(summary()).toBe('1–5 από 5 συναλλαγές');
  });
});
