import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DrawerComponent } from '../../shared/ui/drawer.component';
import { EntityActionsComponent } from '../../shared/ui/entity-actions.component';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { VariantsService } from '../variants/variants.service';
import { PromotionRow, PromotionsService } from './promotions.service';

@Component({
  selector: 'app-promotions-page',
  imports: [PageTitleComponent, ReactiveFormsModule, DrawerComponent, EntityActionsComponent],
  templateUrl: './promotions-page.component.html',
  styleUrl: './promotions-page.component.scss'
})
export class PromotionsPageComponent {
  private readonly service = inject(PromotionsService);
  private readonly variantsService = inject(VariantsService);
  private readonly fb = inject(FormBuilder);
  protected readonly rows = this.service.promotions;
  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;
  protected readonly variantsError = this.variantsService.error;
  protected readonly editingId = signal<string | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly selectedIds = signal<string[]>([]);
  private readonly pinnedIds = signal<string[]>([]);
  protected readonly search = signal('');
  protected readonly variants = computed(() => {
    const search = this.search().trim().toLowerCase();
    const selected = new Set(this.selectedIds());
    // Variants the offer already had come first; the order stays put while ticking boxes.
    const pinned = new Set(this.pinnedIds());
    return this.variantsService.variants()
      .filter((item) =>
        (item.active || selected.has(item.id)) &&
        (!search || `${item.name} ${item.code ?? ''}`.toLowerCase().includes(search))
      )
      .sort((left, right) => Number(pinned.has(right.id)) - Number(pinned.has(left.id)));
  });
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    rule: ['2'], giftQuantity: [2], giftVariantTemplateId: [''], repeat: [true], active: [true], startsAt: [''], endsAt: ['']
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.service.load(), this.variantsService.loadAll()]);
  }

  protected toggleVariant(id: string): void {
    this.selectedIds.update((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  protected variantNames(row: PromotionRow): string {
    const names = new Map(this.variantsService.variants().map((item) => [item.id, item.name]));
    return row.variantTemplateIds.map((id) => names.get(id) ?? 'Μη διαθέσιμη παραλλαγή').join(', ');
  }

  protected readonly giftVariants = computed(() => this.variantsService.variants().filter((item) => item.active));

  protected giftName(row: PromotionRow): string {
    return this.variantsService.variants().find((item) => item.id === row.giftVariantTemplateId)?.name ?? 'Μη διαθέσιμη παραλλαγή';
  }

  protected status(row: PromotionRow): string {
    if (!row.active) return 'Ανενεργή';
    const now = Date.now();
    if (row.startsAt && Date.parse(row.startsAt) > now) return 'Προγραμματισμένη';
    if (row.endsAt && Date.parse(row.endsAt) <= now) return 'Έληξε';
    return 'Ενεργή';
  }

  protected date(value: string | null): string {
    return value ? new Date(value).toLocaleString('el-GR') : 'Χωρίς περιορισμό';
  }

  private localDate(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  protected edit(row: PromotionRow): void {
    this.editingId.set(row.id);
    this.selectedIds.set([...row.variantTemplateIds]);
    this.pinnedIds.set([...row.variantTemplateIds]);
    this.form.setValue({ name: row.name, rule: row.kind === 'GIFT_VARIANT' ? 'gift' : String(row.groupSize),
      giftQuantity: row.kind === 'GIFT_VARIANT' ? row.groupSize : 2,
      giftVariantTemplateId: row.giftVariantTemplateId ?? '', repeat: row.repeat,
      active: row.active, startsAt: this.localDate(row.startsAt), endsAt: this.localDate(row.endsAt) });
    this.formError.set(null);
    this.message.set(null);
    this.search.set('');
    this.drawerOpen.set(true);
  }

  protected openCreate(): void {
    this.reset();
    this.message.set(null);
    this.drawerOpen.set(true);
  }

  /** Plain-language rule, e.g. "Στα 3 της ίδιας παραλλαγής, το φθηνότερο δωρεάν". */
  protected ruleText(row: PromotionRow): string {
    if (row.kind === 'GIFT_VARIANT') return `Αγορά ${row.groupSize}, δώρο 1 ${this.giftName(row)}`;
    return row.groupSize === 2 ? 'Στα 2 της ίδιας παραλλαγής, το φθηνότερο −50%' : 'Στα 3 της ίδιας παραλλαγής, το φθηνότερο δωρεάν';
  }

  protected period(row: PromotionRow): string {
    const format = (value: string) => new Date(value).toLocaleDateString('el-GR', { day: 'numeric', month: 'short' });
    if (!row.startsAt && !row.endsAt) return 'Χωρίς λήξη';
    if (row.startsAt && row.endsAt) return `${format(row.startsAt)} – ${format(row.endsAt)}`;
    return row.startsAt ? `Από ${format(row.startsAt)}` : `Έως ${format(row.endsAt!)}`;
  }

  protected editingRow(): PromotionRow | null {
    return this.rows().find((row) => row.id === this.editingId()) ?? null;
  }

  protected reset(): void {
    this.drawerOpen.set(false);
    this.editingId.set(null);
    this.selectedIds.set([]);
    this.pinnedIds.set([]);
    this.search.set('');
    this.formError.set(null);
    this.form.reset({ name: '', rule: '2', giftQuantity: 2, giftVariantTemplateId: '', repeat: true, active: true, startsAt: '', endsAt: '' });
  }

  protected async save(): Promise<void> {
    const form = this.form.getRawValue();
    if (this.saving()) return;
    if (this.form.invalid || !form.name.trim() || !this.selectedIds().length) {
      this.form.markAllAsTouched();
      this.formError.set('Συμπληρώστε όνομα και επιλέξτε τουλάχιστον μία παραλλαγή.');
      return;
    }
    if (form.rule === 'gift' && (!form.giftVariantTemplateId ||
        this.selectedIds().includes(form.giftVariantTemplateId) || !Number.isInteger(form.giftQuantity) ||
        form.giftQuantity < 1 || form.giftQuantity > 20)) {
      this.formError.set('Επιλέξτε ξεχωριστή παραλλαγή δώρου και ποσότητα αγοράς από 1 έως 20.');
      return;
    }
    if ((form.startsAt && !Number.isFinite(Date.parse(form.startsAt))) ||
        (form.endsAt && !Number.isFinite(Date.parse(form.endsAt))) ||
        (form.startsAt && form.endsAt && Date.parse(form.startsAt) >= Date.parse(form.endsAt))) {
      this.formError.set('Ελέγξτε τις ημερομηνίες: η λήξη πρέπει να είναι μετά την έναρξη.');
      return;
    }
    this.formError.set(null);
    this.message.set(null);
    this.saving.set(true);
    try {
      const ok = await this.service.save({
        name: form.name.trim(), variantTemplateIds: this.selectedIds(),
        kind: form.rule === 'gift' ? 'GIFT_VARIANT' : 'CHEAPEST',
        giftVariantTemplateId: form.rule === 'gift' ? form.giftVariantTemplateId : null,
        groupSize: form.rule === 'gift' ? form.giftQuantity : form.rule === '2' ? 2 : 3,
        discountPercent: form.rule === '2' ? 50 : 100,
        repeat: form.repeat, active: form.active,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null
      }, this.editingId() ?? undefined);
      if (ok) { this.reset(); this.message.set('Η προσφορά αποθηκεύτηκε. Ανανεώστε τον κατάλογο στο POS για ενημέρωση.'); }
    } finally { this.saving.set(false); }
  }

  protected async delete(row: PromotionRow): Promise<void> {
    if (this.saving() || !window.confirm(`Θέλετε να διαγράψετε οριστικά την προσφορά «${row.name}»; Οι υπάρχουσες παραγγελίες δεν επηρεάζονται.`)) return;
    this.saving.set(true);
    this.message.set(null);
    try {
      if (await this.service.delete(row.id)) {
        if (this.editingId() === row.id) this.reset();
        this.message.set('Η προσφορά διαγράφηκε. Ανανεώστε τον κατάλογο στο POS.');
      }
    } finally { this.saving.set(false); }
  }

  protected async toggle(row: PromotionRow): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.message.set(null);
    try { await this.service.save({ ...row, active: !row.active }, row.id); }
    finally { this.saving.set(false); }
  }
}
