import {
  Component,
  ElementRef,
  Injector,
  Input,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild
} from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { ConsumablesService } from '../consumables/consumables.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';
import { StockActionsService } from './stock-actions.service';

type EntryMode = 'PURCHASE' | 'ADJUSTMENT' | 'LOSS';
type QtyField = 'qty' | 'essenceQty';

type StockItem = {
  key: string;
  kind: 'BULK' | 'CONSUMABLE' | 'PACKAGED';
  productId: string;
  templateId: string;
  code: string;
  name: string;
  detail: string;
  search: string;
};

type DraftRow = { item: StockItem; qty: string; essenceQty: string };

type StoredDraft = { mode: EntryMode; reason: string; rows: DraftRow[] };

type PartView = {
  templateId: string;
  field: QtyField;
  label: string;
  raw: string;
  volume: boolean;
  current: number;
  state: 'empty' | 'invalid' | 'ok';
  quantity: number;
  delta: number;
  error: string;
};

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

@Component({
  selector: 'app-stock-entry',
  templateUrl: './stock-entry.component.html',
  styleUrl: './stock-entry.component.scss'
})
export class StockEntryComponent implements OnInit {
  private readonly injector = inject(Injector);
  private readonly productsService = inject(ProductsService);
  private readonly consumablesService = inject(ConsumablesService);
  private readonly inventoryService = inject(InventoryService);
  private readonly stockActions = inject(StockActionsService);
  private readonly auth = inject(AuthService);

  readonly saved = output<void>();
  @Input() receiveOnly = false;

  protected readonly modes: Array<{ value: EntryMode; label: string; hint: string; inputLabel: string }> = [
    {
      value: 'PURCHASE',
      label: 'Παραλαβή',
      hint: 'Αγορά από προμηθευτή: γράψτε την ποσότητα που παραλάβατε. Προστίθεται στο απόθεμα.',
      inputLabel: 'Ποσότητα παραλαβής'
    },
    {
      value: 'ADJUSTMENT',
      label: 'Απογραφή',
      hint: 'Γράψτε ό,τι μετρήσατε στο ράφι. Το απόθεμα γίνεται ίσο με αυτό και η διαφορά (+ ή −) καταγράφεται αυτόματα.',
      inputLabel: 'Μετρημένη ποσότητα'
    },
    {
      value: 'LOSS',
      label: 'Απώλεια',
      hint: 'Φθορά, σπάσιμο ή απώλεια: γράψτε την ποσότητα που χάθηκε. Αφαιρείται από το απόθεμα.',
      inputLabel: 'Ποσότητα απώλειας'
    }
  ];

  protected readonly mode = signal<EntryMode>('PURCHASE');
  protected readonly query = signal('');
  protected readonly highlighted = signal(0);
  protected readonly rows = signal<DraftRow[]>([]);
  protected readonly reason = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly draftRestored = signal(false);

  private readonly picker = viewChild<ElementRef<HTMLDialogElement>>('picker');
  protected readonly pickerQuery = signal('');
  protected readonly pickerSelected = signal<string[]>([]);

  protected readonly currentMode = computed(() => this.modes.find((m) => m.value === this.mode()) ?? this.modes[0]);
  protected readonly visibleModes = computed(() =>
    this.receiveOnly ? this.modes.filter((mode) => mode.value === 'PURCHASE') : this.modes
  );

  private readonly items = computed<StockItem[]>(() => {
    const templateNames = new Map(this.productsService.variantTemplates().map((t) => [t.id, t.name]));
    const items: StockItem[] = [];

    for (const product of this.productsService.products()) {
      if (!product.active) continue;

      if (product.packagingCategory === 'BULK') {
        items.push(this.buildItem(`${product.id}__bulk`, 'BULK', product.id, '', product.productCode, product.name, product.brandName));
        continue;
      }

      for (const templateId of Object.keys(product.variantAssignments ?? {})) {
        const templateName = templateNames.get(templateId);
        if (!templateName) continue;
        items.push(
          this.buildItem(`${product.id}__${templateId}`, 'PACKAGED', product.id, templateId, product.productCode, product.name, templateName)
        );
      }
    }

    for (const consumable of this.consumablesService.consumables()) {
      if (!consumable.active) continue;
      items.push(
        this.buildItem(
          `${consumable.id}__consumable`,
          'CONSUMABLE',
          consumable.id,
          'consumable',
          consumable.code ?? '',
          consumable.name,
          `Αναλώσιμο · ${consumable.unit}`
        )
      );
    }

    return items;
  });

  protected readonly suggestions = computed(() => {
    const text = this.query().trim().toLowerCase();
    if (!text) return [];

    const added = new Set(this.rows().map((row) => row.item.key));
    const rank = (item: StockItem): number => {
      const code = item.code.toLowerCase();
      return code === text ? 0 : code.startsWith(text) ? 1 : 2;
    };

    return this.items()
      .filter((item) => !added.has(item.key) && item.search.includes(text))
      .sort((left, right) => rank(left) - rank(right))
      .slice(0, 8);
  });

  private readonly stock = computed(
    () => new Map(this.inventoryService.inventoryRows().map((row) => [row.id, row.quantity]))
  );

  protected readonly rowViews = computed(() =>
    this.rows().map((row) => ({ item: row.item, parts: this.buildParts(row) }))
  );

  private readonly allParts = computed(() => this.rowViews().flatMap((view) => view.parts));
  protected readonly readyCount = computed(() => this.allParts().filter((part) => part.state === 'ok').length);
  protected readonly invalidCount = computed(() => this.allParts().filter((part) => part.state === 'invalid').length);
  protected readonly canSubmit = computed(() => this.readyCount() > 0 && this.invalidCount() === 0);

  protected readonly pickerVisible = computed(() => {
    const text = this.pickerQuery().trim().toLowerCase();
    return this.items().filter((item) => item.kind === 'CONSUMABLE' && (!text || item.search.includes(text)));
  });

  protected readonly pickerSelectable = computed(() =>
    this.pickerVisible().filter((item) => !this.isAdded(item.key))
  );

  protected readonly allPickerVisibleSelected = computed(() => {
    const selectable = this.pickerSelectable();
    const picked = new Set(this.pickerSelected());
    return selectable.length > 0 && selectable.every((item) => picked.has(item.key));
  });

  ngOnInit(): void {
    void this.productsService.loadAll();
    void this.consumablesService.loadAll();
    void this.inventoryService.loadInventory();
    this.restoreDraft();
    effect(() => this.persistDraft(), { injector: this.injector });
  }

  protected setMode(mode: EntryMode): void {
    if (this.receiveOnly && mode !== 'PURCHASE') return;
    this.mode.set(mode);
    this.rows.update((rows) => rows.map((row) => ({ ...row, qty: '', essenceQty: '' })));
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  protected onSearchInput(value: string): void {
    this.query.set(value);
    this.highlighted.set(0);
  }

  protected onSearchKey(event: KeyboardEvent): void {
    const count = this.suggestions().length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.highlighted.set(Math.min(this.highlighted() + 1, count - 1));
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.highlighted.set(Math.max(this.highlighted() - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.suggestions()[this.highlighted()];
      if (item) this.addItem(item);
    } else if (event.key === 'Escape') {
      this.query.set('');
    }
  }

  protected addItem(item: StockItem): void {
    if (this.rows().some((row) => row.item.key === item.key)) return;
    // Newest on top, right under the search box, so the row being filled is always in view.
    this.rows.update((rows) => [{ item, qty: '', essenceQty: '' }, ...rows]);
    this.query.set('');
    this.highlighted.set(0);
    this.focusLater(`qty-${item.key}`);
  }

  protected openPicker(): void {
    this.pickerQuery.set('');
    this.pickerSelected.set([]);
    this.picker()?.nativeElement.showModal();
    this.focusLater('picker-query');
  }

  protected closePicker(): void {
    this.picker()?.nativeElement.close();
  }

  protected isAdded(key: string): boolean {
    return this.rows().some((row) => row.item.key === key);
  }

  protected isPicked(key: string): boolean {
    return this.pickerSelected().includes(key);
  }

  protected togglePicked(key: string, checked: boolean): void {
    this.pickerSelected.update((keys) => (checked ? [...new Set([...keys, key])] : keys.filter((k) => k !== key)));
  }

  protected toggleAllPicker(checked: boolean): void {
    const visible = new Set(this.pickerSelectable().map((item) => item.key));
    this.pickerSelected.update((keys) => {
      const others = keys.filter((key) => !visible.has(key));
      return checked ? [...others, ...visible] : others;
    });
  }

  protected addPicked(): void {
    const picked = new Set(this.pickerSelected());
    const chosen = this.items().filter((item) => picked.has(item.key) && !this.isAdded(item.key));
    if (chosen.length) {
      this.rows.update((rows) => [...chosen.map((item) => ({ item, qty: '', essenceQty: '' })), ...rows]);
      this.focusLater(`qty-${chosen[0].key}`);
    }
    this.closePicker();
  }

  protected stockOfItem(item: StockItem): string {
    return this.formatQty(this.stockOf(item.productId, item.templateId), false);
  }

  protected setQty(itemKey: string, field: QtyField, value: string): void {
    this.rows.update((rows) => rows.map((row) => (row.item.key === itemKey ? { ...row, [field]: value } : row)));
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  protected onQtyEnter(event: Event, itemKey: string, field: QtyField): void {
    event.preventDefault();
    const isBulk = this.rows().find((row) => row.item.key === itemKey)?.item.kind === 'BULK';
    if (isBulk && field === 'qty') {
      this.focusLater(`essence-${itemKey}`);
    } else {
      this.focusLater('stock-search');
    }
  }

  protected removeRow(itemKey: string): void {
    this.rows.update((rows) => rows.filter((row) => row.item.key !== itemKey));
  }

  protected clearAll(): void {
    this.rows.set([]);
    this.reason.set('');
    this.errorMessage.set(null);
    this.draftRestored.set(false);
  }

  protected formatQty(value: number, volume: boolean): string {
    return volume ? `${round3(value).toLocaleString('el-GR', { maximumFractionDigits: 3 })} ml` : String(value);
  }

  protected formatDelta(part: PartView): string {
    const sign = part.delta > 0 ? '+' : '';
    return `${sign}${this.formatQty(part.delta, part.volume)}`;
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit() || this.submitting()) return;

    const mode = this.mode();
    const reason = this.reason().trim();

    const lines = this.rowViews().flatMap((view) =>
      view.parts
        .filter((part) => part.state === 'ok')
        .map((part) => ({ productId: view.item.productId, variantTemplateId: part.templateId, quantity: part.quantity }))
    );

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    try {
      await this.stockActions.recordMovements({ type: mode, reason: reason || undefined, lines });
      this.successMessage.set(`Καταχωρήθηκε η κίνηση αποθέματος (γραμμές: ${lines.length}).`);
      this.rows.set([]);
      this.reason.set('');
      await this.inventoryService.loadInventory();
      this.saved.emit();
    } catch (err) {
      console.error(err);
      this.errorMessage.set(
        this.isInsufficientStock(err)
          ? 'Ανεπαρκές απόθεμα για κάποια γραμμή. Δεν έγινε καμία αλλαγή.'
          : 'Αποτυχία καταχώρισης. Δεν έγινε καμία αλλαγή.'
      );
    } finally {
      this.submitting.set(false);
    }
  }

  private buildItem(
    key: string,
    kind: StockItem['kind'],
    productId: string,
    templateId: string,
    code: string,
    name: string,
    detail: string
  ): StockItem {
    return { key, kind, productId, templateId, code, name, detail, search: `${code} ${name} ${detail}`.toLowerCase() };
  }

  private stockOf(productId: string, templateId: string): number {
    return this.stock().get(`${productId}__${templateId}`) ?? 0;
  }

  private buildParts(row: DraftRow): PartView[] {
    const { item } = row;
    const make = (templateId: string, field: QtyField, label: string, raw: string, volume: boolean): PartView => {
      const current = this.stockOf(item.productId, templateId);
      return { templateId, field, label, raw, volume, current, ...this.evaluate(raw, volume, current) };
    };

    if (item.kind === 'BULK') {
      return [
        make('perfume', 'qty', 'Άρωμα (βάση)', row.qty, true),
        make('essence', 'essenceQty', 'Εσάνς', row.essenceQty, true)
      ];
    }
    return [make(item.templateId, 'qty', '', row.qty, false)];
  }

  // Volumes are typed and sent in ml; quantity is what the backend expects, delta is the stock effect.
  private evaluate(raw: string, volume: boolean, current: number): Pick<PartView, 'state' | 'quantity' | 'delta' | 'error'> {
    const empty = { state: 'empty' as const, quantity: 0, delta: 0, error: '' };
    const invalid = (error: string) => ({ state: 'invalid' as const, quantity: 0, delta: 0, error });
    const ok = (quantity: number, delta: number) => ({ state: 'ok' as const, quantity, delta, error: '' });

    const text = raw.trim();
    if (!text) return empty;

    const entered = Number(text.replace(',', '.'));
    const amount = volume ? round3(entered) : entered;
    if (!Number.isFinite(entered) || (!volume && !Number.isInteger(amount))) {
      return invalid(volume ? 'Μη έγκυρη ποσότητα.' : 'Γράψτε ακέραιο αριθμό τεμαχίων.');
    }

    const mode = this.mode();
    if (mode === 'ADJUSTMENT') {
      if (amount < 0) return invalid('Το υπόλοιπο δεν μπορεί να είναι αρνητικό.');
      const delta = round3(amount - current);
      return delta === 0 ? empty : ok(delta, delta);
    }

    if (amount < 0) return invalid('Η ποσότητα πρέπει να είναι μεγαλύτερη από 0.');
    // Zero means "none received/lost" here; in a stock-take zero is a real count and is handled above.
    if (amount === 0) return empty;
    if (mode === 'LOSS') {
      return amount > current ? invalid('Μεγαλύτερη από το τρέχον απόθεμα.') : ok(amount, -amount);
    }
    return ok(amount, amount);
  }

  // Survives refresh and in-app navigation; scoped per user and per page variant so drafts never leak.
  private draftKey(): string {
    return `stock-entry-draft-ml:${this.auth.currentUser()?.uid ?? 'anon'}:${this.receiveOnly ? 'receive' : 'full'}`;
  }

  private restoreDraft(): void {
    try {
      const raw = sessionStorage.getItem(this.draftKey());
      if (!raw) return;
      const draft = JSON.parse(raw) as StoredDraft;
      if (!Array.isArray(draft.rows) || !draft.rows.length) return;
      this.mode.set(this.receiveOnly ? 'PURCHASE' : draft.mode);
      this.reason.set(draft.reason ?? '');
      this.rows.set(draft.rows);
      this.draftRestored.set(true);
    } catch {
      // Corrupt or unavailable storage: start empty.
    }
  }

  private persistDraft(): void {
    const draft: StoredDraft = { mode: this.mode(), reason: this.reason(), rows: this.rows() };
    try {
      if (draft.rows.length) {
        sessionStorage.setItem(this.draftKey(), JSON.stringify(draft));
      } else {
        sessionStorage.removeItem(this.draftKey());
      }
    } catch {
      // Storage full or blocked: the form still works, just without recovery.
    }
  }

  private focusLater(elementId: string): void {
    afterNextRender(() => document.getElementById(elementId)?.focus(), { injector: this.injector });
  }

  private isInsufficientStock(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'code' in err && err.code === 'functions/failed-precondition';
  }
}
