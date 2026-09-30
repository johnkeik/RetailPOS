import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { StockMovementType } from '../../core/types/domain.models';
import { ProductsService } from '../products/products.service';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { StockActionsService } from './stock-actions.service';
import { StockMovementsService } from './stock-movements.service';

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

  protected readonly searchQuery = signal('');
  protected readonly selectedType = signal<StockMovementType | 'ALL'>('ALL');
  protected readonly actionError = signal<string | null>(null);
  protected readonly actionSuccess = signal<string | null>(null);

  protected readonly receiveProductId = signal('');
  protected readonly receiveTemplateId = signal('');
  protected readonly receiveQuantity = signal('');
  protected readonly receiveReason = signal('');
  protected readonly receiveLiters = signal('');

  protected readonly adjustProductId = signal('');
  protected readonly adjustTemplateId = signal('');
  protected readonly adjustDelta = signal('');
  protected readonly adjustReason = signal('');
  protected readonly adjustLiters = signal('');

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;
  protected readonly products = this.productsService.products;
  protected readonly variantTemplates = this.productsService.variantTemplates;

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
  }

  protected readonly receiveTemplateOptions = computed(() => {
    const productId = this.receiveProductId();
    if (!productId) return [];
    const product = this.products().find((item) => item.id === productId);
    if (!product) return [];
    const templateIds = Object.keys(product.variantAssignments ?? {});
    return this.variantTemplates().filter((item) => templateIds.includes(item.id));
  });

  protected readonly isReceiveProductBulk = computed(() => {
    const productId = this.receiveProductId();
    return this.products().find((p) => p.id === productId)?.packagingCategory === 'BULK';
  });

  protected readonly isAdjustProductBulk = computed(() => {
    const productId = this.adjustProductId();
    return this.products().find((p) => p.id === productId)?.packagingCategory === 'BULK';
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

  protected formatDate(value: Date | string): string {
    if (!value) return '-';
    const d = value instanceof Date ? value : new Date(value);
    return d.toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  protected onReceiveProductChange(value: string): void {
    this.receiveProductId.set(value);
    this.receiveTemplateId.set('');
  }

  protected onAdjustProductChange(value: string): void {
    this.adjustProductId.set(value);
    this.adjustTemplateId.set('');
  }

  protected async submitReceiveStock(): Promise<void> {
    this.actionError.set(null);
    this.actionSuccess.set(null);

    const isBulk = this.isReceiveProductBulk();

    if (isBulk) {
      const liters = Number(this.receiveLiters());
      if (!this.receiveProductId() || !Number.isFinite(liters) || liters <= 0) {
        this.actionError.set('Απαιτείται προϊόν και όγκος μεγαλύτερος του 0.');
        return;
      }
      try {
        await this.stockActions.receiveStock({
          productId: this.receiveProductId(),
          variantTemplateId: 'bulk',
          quantity: liters * 1000, // convert liters to ml
          reason: this.receiveReason().trim() || undefined
        });
        this.actionSuccess.set(`Παραλήφθηκαν ${liters} L με επιτυχία.`);
        this.receiveLiters.set('');
        this.receiveReason.set('');
        await this.service.loadMovements();
      } catch (error) {
        console.error(error);
        this.actionError.set('Η παραλαβή αποθέματος απέτυχε.');
      }
      return;
    }

    const quantity = Number(this.receiveQuantity());
    if (!this.receiveProductId() || !this.receiveTemplateId() || !Number.isFinite(quantity) || quantity <= 0) {
      this.actionError.set('Απαιτείται προϊόν, πρότυπο παραλλαγής και ποσότητα μεγαλύτερη του 0.');
      return;
    }

    try {
      await this.stockActions.receiveStock({
        productId: this.receiveProductId(),
        variantTemplateId: this.receiveTemplateId(),
        quantity,
        reason: this.receiveReason().trim() || undefined
      });
      this.actionSuccess.set('Το απόθεμα παραλήφθηκε με επιτυχία.');
      this.receiveQuantity.set('');
      this.receiveReason.set('');
      await this.service.loadMovements();
    } catch (error) {
      console.error(error);
      this.actionError.set('Η παραλαβή αποθέματος απέτυχε. Ελέγξτε τον emulator και τα δεδομένα.');
    }
  }

  protected async submitAdjustStock(): Promise<void> {
    this.actionError.set(null);
    this.actionSuccess.set(null);

    const isBulk = this.isAdjustProductBulk();

    if (isBulk) {
      const liters = Number(this.adjustLiters());
      if (!this.adjustProductId() || !Number.isFinite(liters) || liters === 0) {
        this.actionError.set('Απαιτείται προϊόν και μη μηδενικός όγκος (L).');
        return;
      }
      try {
        await this.stockActions.adjustStock({
          productId: this.adjustProductId(),
          variantTemplateId: 'bulk',
          quantityDelta: liters * 1000,
          reason: this.adjustReason().trim() || undefined
        });
        this.actionSuccess.set('Το χύμα απόθεμα διορθώθηκε με επιτυχία.');
        this.adjustLiters.set('');
        this.adjustReason.set('');
        await this.service.loadMovements();
      } catch (error) {
        console.error(error);
        this.actionError.set('Η διόρθωση απέτυχε.');
      }
      return;
    }

    const quantityDelta = Number(this.adjustDelta());
    if (!this.adjustProductId() || !this.adjustTemplateId() || !Number.isFinite(quantityDelta) || quantityDelta === 0) {
      this.actionError.set('Απαιτείται προϊόν, πρότυπο παραλλαγής και μη μηδενική μεταβολή.');
      return;
    }

    try {
      await this.stockActions.adjustStock({
        productId: this.adjustProductId(),
        variantTemplateId: this.adjustTemplateId(),
        quantityDelta,
        reason: this.adjustReason().trim() || undefined
      });
      this.actionSuccess.set('Το απόθεμα διορθώθηκε με επιτυχία.');
      this.adjustDelta.set('');
      this.adjustReason.set('');
      await this.service.loadMovements();
    } catch (error) {
      console.error(error);
      this.actionError.set('Η διόρθωση αποθέματος απέτυχε. Ελέγξτε τον emulator και τα δεδομένα.');
    }
  }
}
