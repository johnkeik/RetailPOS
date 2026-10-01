import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { StockMovementType } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { ConsumablesService } from '../consumables/consumables.service';
import { ProductsService } from '../products/products.service';
import { StockActionsService } from './stock-actions.service';
import { StockMovementsService } from './stock-movements.service';

export type MovementTargetType = 'PERFUME' | 'ESSENCE' | 'CONSUMABLE' | 'PACKAGED';

@Component({
  selector: 'app-stock-movements-page',
  imports: [PageTitleComponent],
  templateUrl: './stock-movements-page.component.html',
  styleUrl: './stock-movements-page.component.scss'
})
export class StockMovementsPageComponent implements OnInit {
  private readonly service = inject(StockMovementsService);
  private readonly stockActions = inject(StockActionsService);
  private readonly productsService = inject(ProductsService);
  private readonly consumablesService = inject(ConsumablesService);

  protected readonly searchQuery = signal('');
  protected readonly selectedType = signal<StockMovementType | 'ALL'>('ALL');
  protected readonly actionError = signal<string | null>(null);
  protected readonly actionSuccess = signal<string | null>(null);

  // Form selections for Receive
  protected readonly receiveTargetType = signal<MovementTargetType>('PERFUME');
  protected readonly receiveProductId = signal('');
  protected readonly receiveConsumableId = signal('');
  protected readonly receiveTemplateId = signal('');
  protected readonly receiveLiters = signal('');
  protected readonly receiveUnits = signal('');
  protected readonly receiveReason = signal('');

  // Form selections for Adjust
  protected readonly adjustTargetType = signal<MovementTargetType>('PERFUME');
  protected readonly adjustProductId = signal('');
  protected readonly adjustConsumableId = signal('');
  protected readonly adjustTemplateId = signal('');
  protected readonly adjustLitersDelta = signal('');
  protected readonly adjustUnitsDelta = signal('');
  protected readonly adjustReason = signal('');

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;
  protected readonly products = this.productsService.products;
  protected readonly variantTemplates = this.productsService.variantTemplates;
  protected readonly consumables = this.consumablesService.consumables;

  protected readonly bulkProducts = computed(() =>
    this.products().filter((p) => p.packagingCategory === 'BULK')
  );
  protected readonly packagedProducts = computed(() =>
    this.products().filter((p) => p.packagingCategory === 'PACKAGED')
  );

  protected readonly types: Array<StockMovementType | 'ALL'> = [
    'ALL',
    'PURCHASE',
    'SALE',
    'ADJUSTMENT',
    'RETURN',
    'LOSS'
  ];

  ngOnInit(): void {
    void this.service.loadMovements();
    void this.productsService.loadAll();
    void this.consumablesService.loadAll();
  }

  protected readonly receiveTemplateOptions = computed(() => {
    const productId = this.receiveProductId();
    if (!productId) return [];
    const product = this.products().find((item) => item.id === productId);
    if (!product) return [];
    const templateIds = Object.keys(product.variantAssignments ?? {});
    return this.variantTemplates().filter((item) => templateIds.includes(item.id));
  });

  protected readonly adjustTemplateOptions = computed(() => {
    const productId = this.adjustProductId();
    if (!productId) return [];
    const product = this.products().find((item) => item.id === productId);
    if (!product) return [];
    const templateIds = Object.keys(product.variantAssignments ?? {});
    return this.variantTemplates().filter((item) => templateIds.includes(item.id));
  });

  protected readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const selectedType = this.selectedType();

    return this.service.movementRows().filter((row) => {
      const matchSearch =
        !query ||
        row.productName.toLowerCase().includes(query) ||
        row.productCode.toLowerCase().includes(query) ||
        row.variantTemplateName.toLowerCase().includes(query);

      const matchType = selectedType === 'ALL' || row.type === selectedType;
      return matchSearch && matchType;
    });
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected onTypeChange(value: string): void {
    this.selectedType.set(value as StockMovementType | 'ALL');
  }

  protected async submitReceiveStock(): Promise<void> {
    this.actionError.set(null);
    this.actionSuccess.set(null);

    const target = this.receiveTargetType();

    if (target === 'PERFUME' || target === 'ESSENCE') {
      const productId = this.receiveProductId();
      const liters = Number(this.receiveLiters());
      if (!productId || !Number.isFinite(liters) || liters <= 0) {
        this.actionError.set('Παρακαλώ επιλέξτε προϊόν και έγκυρη ποσότητα σε λίτρα (> 0).');
        return;
      }

      const variantTemplateId = target === 'PERFUME' ? 'perfume' : 'essence';
      const label = target === 'PERFUME' ? 'Άρωμα' : 'Εσάνς';

      try {
        await this.stockActions.receiveStock({
          productId,
          variantTemplateId,
          quantity: liters * 1000,
          reason: this.receiveReason().trim() || undefined
        });
        this.actionSuccess.set(`Παραλαβή ${liters} L (${label}) καταχωρήθηκε επιτυχώς.`);
        this.receiveLiters.set('');
        this.receiveReason.set('');
        await this.service.loadMovements();
      } catch (err) {
        console.error(err);
        this.actionError.set('Αποτυχία καταχώρισης παραλαβής.');
      }
      return;
    }

    if (target === 'CONSUMABLE') {
      const consumableId = this.receiveConsumableId();
      const units = Number(this.receiveUnits());
      if (!consumableId || !Number.isFinite(units) || units <= 0) {
        this.actionError.set('Παρακαλώ επιλέξτε αναλώσιμο και έγκυρο αριθμό τεμαχίων (> 0).');
        return;
      }

      try {
        await this.stockActions.receiveStock({
          productId: consumableId,
          variantTemplateId: 'consumable',
          quantity: Math.floor(units),
          reason: this.receiveReason().trim() || undefined
        });
        this.actionSuccess.set(`Παραλαβή ${units} τεμ. αναλωσίμου καταχωρήθηκε επιτυχώς.`);
        this.receiveUnits.set('');
        this.receiveReason.set('');
        await this.service.loadMovements();
      } catch (err) {
        console.error(err);
        this.actionError.set('Αποτυχία καταχώρισης παραλαβής αναλωσίμου.');
      }
      return;
    }

    // PACKAGED
    const productId = this.receiveProductId();
    const templateId = this.receiveTemplateId();
    const units = Number(this.receiveUnits());
    if (!productId || !templateId || !Number.isFinite(units) || units <= 0) {
      this.actionError.set('Παρακαλώ επιλέξτε προϊόν, παραλλαγή και ποσότητα τεμαχίων (> 0).');
      return;
    }

    try {
      await this.stockActions.receiveStock({
        productId,
        variantTemplateId: templateId,
        quantity: Math.floor(units),
        reason: this.receiveReason().trim() || undefined
      });
      this.actionSuccess.set('Παραλαβή συσκευασμένου προϊόντος καταχωρήθηκε επιτυχώς.');
      this.receiveUnits.set('');
      this.receiveReason.set('');
      await this.service.loadMovements();
    } catch (err) {
      console.error(err);
      this.actionError.set('Αποτυχία καταχώρισης παραλαβής.');
    }
  }

  protected async submitAdjustStock(): Promise<void> {
    this.actionError.set(null);
    this.actionSuccess.set(null);

    const target = this.adjustTargetType();

    if (target === 'PERFUME' || target === 'ESSENCE') {
      const productId = this.adjustProductId();
      const litersDelta = Number(this.adjustLitersDelta());
      if (!productId || !Number.isFinite(litersDelta) || litersDelta === 0) {
        this.actionError.set('Παρακαλώ επιλέξτε προϊόν και μη μηδενική διαφορά σε λίτρα (+ ή -).');
        return;
      }

      const variantTemplateId = target === 'PERFUME' ? 'perfume' : 'essence';
      const label = target === 'PERFUME' ? 'Άρωμα' : 'Εσάνς';

      try {
        await this.stockActions.adjustStock({
          productId,
          variantTemplateId,
          quantityDelta: litersDelta * 1000,
          reason: this.adjustReason().trim() || undefined
        });
        this.actionSuccess.set(`Προσαρμογή ${label} (${litersDelta > 0 ? '+' : ''}${litersDelta} L) καταχωρήθηκε επιτυχώς.`);
        this.adjustLitersDelta.set('');
        this.adjustReason.set('');
        await this.service.loadMovements();
      } catch (err) {
        console.error(err);
        this.actionError.set('Αποτυχία καταχώρισης προσαρμογής.');
      }
      return;
    }

    if (target === 'CONSUMABLE') {
      const consumableId = this.adjustConsumableId();
      const unitsDelta = Number(this.adjustUnitsDelta());
      if (!consumableId || !Number.isFinite(unitsDelta) || unitsDelta === 0) {
        this.actionError.set('Παρακαλώ επιλέξτε αναλώσιμο και μη μηδενική μεταβολή τεμαχίων.');
        return;
      }

      try {
        await this.stockActions.adjustStock({
          productId: consumableId,
          variantTemplateId: 'consumable',
          quantityDelta: Math.floor(unitsDelta),
          reason: this.adjustReason().trim() || undefined
        });
        this.actionSuccess.set(`Προσαρμογή αναλωσίμου (${unitsDelta > 0 ? '+' : ''}${unitsDelta} τεμ.) καταχωρήθηκε επιτυχώς.`);
        this.adjustUnitsDelta.set('');
        this.adjustReason.set('');
        await this.service.loadMovements();
      } catch (err) {
        console.error(err);
        this.actionError.set('Αποτυχία καταχώρισης προσαρμογής αναλωσίμου.');
      }
      return;
    }

    // PACKAGED
    const productId = this.adjustProductId();
    const templateId = this.adjustTemplateId();
    const unitsDelta = Number(this.adjustUnitsDelta());
    if (!productId || !templateId || !Number.isFinite(unitsDelta) || unitsDelta === 0) {
      this.actionError.set('Παρακαλώ επιλέξτε προϊόν, παραλλαγή και μη μηδενική διαφορά τεμαχίων.');
      return;
    }

    try {
      await this.stockActions.adjustStock({
        productId,
        variantTemplateId: templateId,
        quantityDelta: Math.floor(unitsDelta),
        reason: this.adjustReason().trim() || undefined
      });
      this.actionSuccess.set('Προσαρμογή συσκευασμένου προϊόντος καταχωρήθηκε επιτυχώς.');
      this.adjustUnitsDelta.set('');
      this.adjustReason.set('');
      await this.service.loadMovements();
    } catch (err) {
      console.error(err);
      this.actionError.set('Αποτυχία καταχώρισης προσαρμογής.');
    }
  }

  protected formatTypeLabel(type: StockMovementType | 'ALL'): string {
    switch (type) {
      case 'ALL': return 'Όλες';
      case 'PURCHASE': return 'ΠΑΡΑΛΑΒΗ';
      case 'SALE': return 'ΠΩΛΗΣΗ';
      case 'ADJUSTMENT': return 'ΠΡΟΣΑΡΜΟΓΗ';
      case 'RETURN': return 'ΕΠΙΣΤΡΟΦΗ';
      case 'LOSS': return 'ΑΠΩΛΕΙΑ';
    }
  }
}
