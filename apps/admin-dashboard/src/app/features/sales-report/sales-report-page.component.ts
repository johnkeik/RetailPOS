import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { SalesReportService } from './sales-report.service';

type Totals = {
  cash: number;
  card: number;
  other: number;
  total: number;
  expenses: number;
  cashExpenses: number;
  cardExpenses: number;
};

const emptyTotals = (): Totals => ({
  cash: 0,
  card: 0,
  other: 0,
  total: 0,
  expenses: 0,
  cashExpenses: 0,
  cardExpenses: 0
});

function toInputDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-sales-report-page',
  imports: [PageTitleComponent],
  templateUrl: './sales-report-page.component.html',
  styleUrl: './sales-report-page.component.scss'
})
export class SalesReportPageComponent implements OnInit {
  private readonly service = inject(SalesReportService);

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;
  protected readonly dateFrom = signal(toInputDate(new Date(Date.now() - 29 * 86_400_000)));
  protected readonly dateTo = signal(toInputDate(new Date()));

  protected readonly days = computed(() => {
    const byDay = new Map<string, { label: string; employees: Map<string, Totals & { name: string }>; totals: Totals }>();

    const entries = [
      ...this.service.orders().map((entry) => ({ entry, isExpense: false })),
      ...this.service.expenses().map((entry) => ({ entry, isExpense: true }))
    ];

    for (const { entry: order, isExpense } of entries) {
      const key = toInputDate(order.createdAt);
      const day = byDay.get(key) ?? {
        label: order.createdAt.toLocaleDateString('el-GR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
        employees: new Map(),
        totals: emptyTotals()
      };
      const employee = day.employees.get(order.employeeId) ?? { name: order.employeeName, ...emptyTotals() };
      const field = order.paymentMethod === 'CASH' ? 'cash' : order.paymentMethod === 'CARD' ? 'card' : 'other';

      for (const target of [employee, day.totals]) {
        if (isExpense) {
          target.expenses += order.total;
          if (order.paymentMethod === 'CASH') target.cashExpenses += order.total;
          if (order.paymentMethod === 'CARD') target.cardExpenses += order.total;
        } else {
          target[field] += order.total;
          target.total += order.total;
        }
      }
      day.employees.set(order.employeeId, employee);
      byDay.set(key, day);
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, day]) => ({
        key,
        label: day.label,
        totals: day.totals,
        employees: [...day.employees.values()].sort((a, b) => b.total - a.total || b.expenses - a.expenses)
      }));
  });

  protected readonly hasOther = computed(() => this.days().some((day) => day.totals.other > 0));

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    const from = new Date(`${this.dateFrom()}T00:00:00`);
    const to = new Date(`${this.dateTo()}T23:59:59.999`);
    void this.service.load(from, to);
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(value);
  }

  protected print(): void {
    window.print();
  }

  protected exportCsv(): void {
    const money = (value: number) => value.toFixed(2).replace('.', ',');
    const text = (value: string) => {
      const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const header = [
      'Ημερομηνία',
      'Υπάλληλος',
      'Μετρητά',
      'Κάρτα',
      'Χωρίς τρόπο πληρωμής',
      'Σύνολο',
      'Έξοδα μετρητά',
      'Έξοδα κάρτα',
      'Καθαρά μετρητά'
    ];
    const line = (date: string, name: string, t: Totals) => [
      text(date),
      text(name),
      money(t.cash),
      money(t.card),
      money(t.other),
      money(t.total),
      money(t.cashExpenses),
      money(t.cardExpenses),
      money(t.cash - t.cashExpenses)
    ];

    const rows = [header.map(text)];
    for (const day of [...this.days()].reverse()) {
      for (const employee of day.employees) rows.push(line(day.key, employee.name, employee));
      rows.push(line(day.key, 'Σύνολο ημέρας', day.totals));
    }

    // BOM + ; separator so Greek Excel opens it correctly.
    const csv = '\ufeff' + rows.map((row) => row.join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `anafora-polisewn_${this.dateFrom()}_${this.dateTo()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking immediately can cancel the download in Safari/Firefox.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  protected formatInputDate(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString('el-GR');
  }

  protected setFrom(value: string): void {
    this.dateFrom.set(value);
    this.reload();
  }

  protected setTo(value: string): void {
    this.dateTo.set(value);
    this.reload();
  }
}
