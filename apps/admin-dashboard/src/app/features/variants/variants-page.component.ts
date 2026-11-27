import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { EntityActionsComponent } from '../../shared/ui/entity-actions.component';
import { SearchFieldComponent } from '../../shared/ui/search-field.component';
import { VariantTemplateRow, VariantsService } from './variants.service';

@Component({
  selector: 'app-variants-page',
  imports: [RouterLink, PageTitleComponent, EntityActionsComponent, SearchFieldComponent],
  templateUrl: './variants-list-page.component.html',
  styleUrl: './variants-list-page.component.scss'
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

  /** Plain-language recipe, e.g. "30 ml βάση, 9 ml εσάνς, 1 αναλώσιμο". */
  protected recipeSummary(variant: VariantTemplateRow): string {
    if (variant.packagingType !== 'BULK') return '';
    const parts: string[] = [];
    if (variant.perfumeMl) parts.push(`${variant.perfumeMl} ml βάση`);
    if (variant.essenceMl) parts.push(`${variant.essenceMl} ml εσάνς`);
    const consumables = variant.recipeConsumables?.length ?? 0;
    if (consumables) parts.push(`${consumables} ${consumables === 1 ? 'αναλώσιμο' : 'αναλώσιμα'}`);
    if (variant.hasSpecialBottle && variant.specialBottleExtraPrice) {
      parts.push(`ειδικό μπουκάλι +${this.formatPrice(variant.specialBottleExtraPrice)}`);
    }
    return parts.join(', ');
  }

  protected formatPrice(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(value);
  }

  protected readonly tierFilter = signal<'ALL' | 'STANDARD' | 'PREMIUM'>('ALL');

  /** Premium templates have no flag of their own; they are named/coded with a "Prem" prefix. */
  protected isPremium(variant: VariantTemplateRow): boolean {
    return /^prem/i.test(variant.code ?? '') || /^prem/i.test(variant.name);
  }

  protected readonly tierCounts = computed(() => {
    const rows = this.filteredVariants();
    const premium = rows.filter((row) => this.isPremium(row)).length;
    return { ALL: rows.length, STANDARD: rows.length - premium, PREMIUM: premium };
  });

  /** Grouped by what the variant is made from, which is how the shop thinks about them. */
  protected readonly variantGroups = computed(() => {
    const tier = this.tierFilter();
    const rows = this.filteredVariants().filter((row) =>
      tier === 'ALL' || (tier === 'PREMIUM') === this.isPremium(row)
    );
    return [
      { id: 'PERFUME', label: 'Αρώματα', hint: 'Βάση και εσάνς.', rows: rows.filter((row) => row.packagingType === 'BULK' && !!row.perfumeMl) },
      { id: 'ESSENCE', label: 'Με εσάνς', hint: 'Μόνο εσάνς, χωρίς βάση.', rows: rows.filter((row) => row.packagingType === 'BULK' && !row.perfumeMl) },
      { id: 'PACKAGED', label: 'Συσκευασμένα', hint: 'Πωλούνται όπως παραλαμβάνονται.', rows: rows.filter((row) => row.packagingType !== 'BULK') }
    ].filter((group) => group.rows.length > 0);
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected createVariant(): void {
    void this.router.navigateByUrl('/variants/new');
  }

  protected openVariant(variant: VariantTemplateRow, event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button, a, .actions-col')) return;
    this.editVariant(variant);
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
