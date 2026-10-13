import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { EntityActionsComponent } from '../../shared/ui/entity-actions.component';
import { VariantTemplateRow, VariantsService } from './variants.service';

@Component({
  selector: 'app-variants-page',
  imports: [PageTitleComponent, EntityActionsComponent],
  templateUrl: './variants-list-page.component.html',
  styleUrl: './variants-page.component.scss'
})
export class VariantsPageComponent implements OnInit {
  private readonly variantsService = inject(VariantsService);
  private readonly router = inject(Router);

  protected readonly searchQuery = signal('');

  protected readonly loading = this.variantsService.loading;
  protected readonly error = this.variantsService.error;

  ngOnInit(): void {
    void this.variantsService.loadAll();
  }

  protected readonly filteredVariants = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const rows = this.variantsService.variants();

    if (!query) {
      return rows;
    }

    return rows.filter((variant) => {
      return (
        variant.name.toLowerCase().includes(query) ||
        (variant.code ?? '').toLowerCase().includes(query) ||
        variant.packagingType.toLowerCase().includes(query) ||
        variant.unit.toLowerCase().includes(query)
      );
    });
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected createVariant(): void {
    void this.router.navigateByUrl('/variants/new');
  }

  protected editVariant(variant: VariantTemplateRow): void {
    void this.router.navigate(['/variants', variant.id, 'edit']);
  }

  protected async toggleActive(variant: VariantTemplateRow): Promise<void> {
    await this.variantsService.toggleVariantActive(variant.id, !variant.active);
  }

  protected async deleteVariant(variant: VariantTemplateRow): Promise<void> {
    const confirmed = window.confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά την παραλλαγή "${variant.name}";`);
    if (!confirmed) return;
    const ok = await this.variantsService.deleteVariant(variant.id);
  }
}
