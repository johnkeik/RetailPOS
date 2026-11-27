import { Component, computed, input } from '@angular/core';

export type PaymentSplit = { total: number; cash: number; card: number };

/** Sums amounts by payment method. Entries without a method count towards the total only. */
export function splitByPayment(entries: { amount: number; method?: string | null }[]): PaymentSplit {
  return entries.reduce(
    (acc, entry) => ({
      total: acc.total + entry.amount,
      cash: acc.cash + (entry.method === 'CASH' ? entry.amount : 0),
      card: acc.card + (entry.method === 'CARD' ? entry.amount : 0)
    }),
    { total: 0, cash: 0, card: 0 }
  );
}

/** Income, expenses and balance for a period. Used on the Overview (this month) and the sales report (chosen range). */
@Component({
  selector: 'app-period-totals',
  template: `
    <dl class="month-figures">
      <div>
        <dt>Έσοδα</dt>
        <dd>{{ money(income().total) }}</dd>
        <span class="split">Μετρητά {{ money(income().cash) }}, κάρτα {{ money(income().card) }}</span>
      </div>
      <div>
        <dt>Έξοδα</dt>
        <dd>{{ money(expenses().total) }}</dd>
        <span class="split">Μετρητά {{ money(expenses().cash) }}, κάρτα {{ money(expenses().card) }}</span>
      </div>
      <div class="month-balance" [class.negative]="balance() < 0">
        <dt>Υπόλοιπο</dt>
        <dd>{{ money(balance()) }}</dd>
        <span class="split">Μετρητά μείον έξοδα μετρητών {{ money(income().cash - expenses().cash) }}</span>
      </div>
    </dl>
  `,
  styles: [
    `
      :host { display: block; }

      .month-figures {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin: 0;
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        background: var(--surface);
        font-variant-numeric: tabular-nums;
      }

      .month-figures > div {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        padding: 16px 18px;
      }

      .month-figures > div + div {
        border-left: 1px solid var(--line);
      }

      dt {
        color: var(--ink-soft);
        font-size: 0.875rem;
      }

      dd {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .split {
        color: var(--ink-soft);
        font-size: 0.8125rem;
      }

      .month-balance dd { color: var(--ok); }
      .month-balance.negative dd { color: var(--alert); }

      @media (max-width: 640px) {
        .month-figures { grid-template-columns: minmax(0, 1fr); }

        .month-figures > div + div {
          border-top: 1px solid var(--line);
          border-left: 0;
        }
      }
    `
  ]
})
export class PeriodTotalsComponent {
  readonly income = input.required<PaymentSplit>();
  readonly expenses = input.required<PaymentSplit>();
  protected readonly balance = computed(() => this.income().total - this.expenses().total);

  protected money(value: number): string {
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
