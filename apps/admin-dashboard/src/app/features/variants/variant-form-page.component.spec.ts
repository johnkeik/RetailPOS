import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { ConsumablesService } from '../consumables/consumables.service';
import { VariantFormPageComponent } from './variant-form-page.component';
import { VariantTemplateRow, VariantsService } from './variants.service';

describe('Variant form numeric inputs', () => {
  let fixture: ComponentFixture<VariantFormPageComponent>;
  let variants: {
    variants: ReturnType<typeof signal<VariantTemplateRow[]>>;
    error: ReturnType<typeof signal<string | null>>;
    loadAll: jasmine.Spy;
    createVariant: jasmine.Spy;
    updateVariant: jasmine.Spy;
  };

  beforeEach(async () => {
    variants = {
      variants: signal<VariantTemplateRow[]>([]), error: signal<string | null>(null),
      loadAll: jasmine.createSpy().and.resolveTo(),
      createVariant: jasmine.createSpy().and.resolveTo(),
      updateVariant: jasmine.createSpy().and.resolveTo()
    };
    await TestBed.configureTestingModule({
      imports: [VariantFormPageComponent],
      providers: [
        provideRouter([]),
        { provide: VariantsService, useValue: variants },
        { provide: ConsumablesService, useValue: {
          consumables: signal([]), loadAll: jasmine.createSpy().and.resolveTo()
        } }
      ]
    }).compileComponents();
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(VariantFormPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function input(id: string, value: string): HTMLInputElement {
    const field = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    return field;
  }

  async function submit(): Promise<void> {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('accepts numeric size on recipe blur and keeps the recipe total reactive', async () => {
    await render();
    input('size', '50');
    input('perfumeMl', '40');
    const essence = input('essenceMl', '10');
    essence.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#size').value).toBe('50');
    expect(fixture.nativeElement.querySelector('.recipe-calc-hint').textContent).toContain('50 ml');
    input('essenceMl', '5').dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.recipe-calc-hint').textContent).toContain('45 ml');
    expect(fixture.nativeElement.querySelector('#size').value).toBe('50');
  });

  it('fills a blank size from the recipe and handles clearing a numeric field', async () => {
    await render();
    input('perfumeMl', '20');
    input('essenceMl', '5').dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#size').value).toBe('25');
    input('size', '');
    input('essenceMl', '').dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#size').value).toBe('20');
  });

  it('saves numeric costs, recipe quantities and a zero special-bottle surcharge', async () => {
    await render();
    input('name', 'Δοκιμή 50 ml');
    input('size', '50');
    input('costPrice', '2.5');
    input('sellingPrice', '12');
    input('perfumeMl', '40');
    input('essenceMl', '10');
    fixture.nativeElement.querySelector('#hasSpecialBottle').click();
    fixture.detectChanges();
    input('specialBottleExtraPrice', '0');
    await submit();
    expect(variants.createVariant).toHaveBeenCalledWith(jasmine.objectContaining({
      size: 50, costPrice: 2.5, sellingPrice: 12, perfumeMl: 40, essenceMl: 10,
      hasSpecialBottle: true, specialBottleExtraPrice: 0
    }));
  });

  it('omits empty optional values and switches to packaged fields reactively', async () => {
    await render();
    input('name', 'Συσκευασμένο');
    const packaging = fixture.nativeElement.querySelector('#packagingType') as HTMLSelectElement;
    packaging.value = 'PACKAGED';
    packaging.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#perfumeMl')).toBeNull();
    await submit();
    expect(variants.createVariant).toHaveBeenCalledWith(jasmine.objectContaining({
      packagingType: 'PACKAGED', sellingPrice: 0, size: undefined, costPrice: undefined,
      perfumeMl: undefined, essenceMl: undefined, specialBottleExtraPrice: undefined
    }));
  });

  it('loads and updates an existing variant without converting numbers to strings', async () => {
    variants.variants.set([{
      id: 'v1', assignedProducts: 1, tenantId: 'store001', name: 'Υπάρχουσα',
      size: 50, unit: 'ml', packagingType: 'BULK', costPrice: 0, sellingPrice: 12,
      perfumeMl: 40, essenceMl: 10, active: true, createdAt: '2026-10-22'
    }]);
    spyOn(TestBed.inject(ActivatedRoute).snapshot.paramMap, 'get').and.returnValue('v1');
    await render();
    input('perfumeMl', '35').dispatchEvent(new Event('blur'));
    input('costPrice', '1.25');
    await submit();
    expect(variants.updateVariant).toHaveBeenCalledWith('v1', jasmine.objectContaining({
      size: 50, perfumeMl: 35, essenceMl: 10, costPrice: 1.25
    }));
  });
});
