import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesReportPageComponent } from './sales-report-page.component';
import { DailySalesOrder, SalesReportService } from './sales-report.service';

const entry = (total: number, paymentMethod: 'CASH' | 'CARD'): DailySalesOrder =>
  ({ employeeId: 'e1', employeeName: 'Μαρία', paymentMethod, total, createdAt: new Date() });
// Currency formatting uses a non-breaking space before the euro sign.
const normalize = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();

describe('SalesReportPageComponent period', () => {
  let fixture: ComponentFixture<SalesReportPageComponent>;
  let load: jasmine.Spy;

  beforeEach(async () => {
    load = jasmine.createSpy('load').and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [SalesReportPageComponent],
      providers: [{ provide: SalesReportService, useValue: {
        orders: signal([entry(100, 'CASH'), entry(60, 'CARD')]),
        expenses: signal([entry(25, 'CASH')]),
        loading: signal(false), error: signal(null), load
      } }]
    }).compileComponents();
    fixture = TestBed.createComponent(SalesReportPageComponent);
    fixture.detectChanges();
  });

  it('starts on the 1st of the current month and ends today', () => {
    const now = new Date();
    const [from, to] = load.calls.mostRecent().args as [Date, Date];
    expect(from).toEqual(new Date(now.getFullYear(), now.getMonth(), 1));
    expect(to.toDateString()).toBe(now.toDateString());
  });

  it('falls back to the 1st of the month when "Από" is cleared', () => {
    const fromInput = fixture.nativeElement.querySelector('#from') as HTMLInputElement;
    fromInput.value = '';
    fromInput.dispatchEvent(new Event('change'));
    const now = new Date();
    expect((load.calls.mostRecent().args[0] as Date)).toEqual(new Date(now.getFullYear(), now.getMonth(), 1));
  });

  it('shows the totals of the chosen range on screen only', () => {
    const totals = fixture.nativeElement.querySelector('app-period-totals') as HTMLElement;
    expect(totals.classList).toContain('no-print');
    const figures = [...totals.querySelectorAll('dd')].map((el) => normalize(el.textContent));
    expect(figures).toEqual(['160,00 €', '25,00 €', '135,00 €']);
  });
});
