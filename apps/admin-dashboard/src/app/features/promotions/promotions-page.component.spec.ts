import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VariantsService } from '../variants/variants.service';
import { PromotionsPageComponent } from './promotions-page.component';
import { PromotionRow, PromotionsService } from './promotions.service';

const offer: PromotionRow = {
  id: 'offer', name: 'Πάρε 3, πλήρωσε 2', variantTemplateIds: ['v1'], groupSize: 3,
  discountPercent: 100, repeat: true, active: true,
  startsAt: '2026-10-23T08:00:00.000Z', endsAt: '2026-10-25T08:00:00.000Z'
};

describe('Promotions management', () => {
  let fixture: ComponentFixture<PromotionsPageComponent>;
  let save: jasmine.Spy;
  let remove: jasmine.Spy;
  let rows: ReturnType<typeof signal<PromotionRow[]>>;

  beforeEach(async () => {
    save = jasmine.createSpy().and.resolveTo(true);
    remove = jasmine.createSpy().and.resolveTo(true);
    rows = signal<PromotionRow[]>([]);
    await TestBed.configureTestingModule({
      imports: [PromotionsPageComponent],
      providers: [
        { provide: PromotionsService, useValue: { promotions: rows, loading: signal(false), error: signal(null),
          load: jasmine.createSpy().and.resolveTo(), save, delete: remove } },
        { provide: VariantsService, useValue: { variants: signal([
          { id: 'v1', name: 'Premium 30ml', active: true, size: 30, unit: 'ml' },
          { id: 'v2', name: 'Simple 30ml', active: true, size: 30, unit: 'ml' }
        ]), error: signal(null), loadAll: jasmine.createSpy().and.resolveTo() } }
      ]
    }).compileComponents();
  });

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(PromotionsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function setField(name: string, value: string): void {
    const field = fixture.nativeElement.querySelector(`[formControlName="${name}"]`) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    fixture.detectChanges();
  }

  async function submit(): Promise<void> {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable(); fixture.detectChanges();
  }

  it('creates a three-for-two offer from selected variants', async () => {
    await render();
    setField('name', offer.name);
    setField('rule', '3');
    fixture.nativeElement.querySelector('fieldset input[type=checkbox]').click();
    fixture.detectChanges();
    await submit();
    expect(save).toHaveBeenCalledWith(jasmine.objectContaining({ name: offer.name,
      variantTemplateIds: ['v1'], groupSize: 3, discountPercent: 100, active: true, repeat: true }), undefined);
    expect(fixture.nativeElement.textContent).toContain('Η προσφορά αποθηκεύτηκε');
  });

  it('saves a separate gift variant after two qualifying purchases', async () => {
    await render(); setField('name', 'Premium + Simple'); setField('rule', 'gift');
    setField('giftVariantTemplateId', 'v2'); setField('giftQuantity', '2');
    fixture.nativeElement.querySelector('fieldset input[type=checkbox]').click();
    fixture.detectChanges(); await submit();
    expect(save).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'GIFT_VARIANT',
      giftVariantTemplateId: 'v2', groupSize: 2, variantTemplateIds: ['v1'], discountPercent: 100 }), undefined);
  });

  it('deletes only after confirmation and reports success', async () => {
    rows.set([offer]); await render();
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((item) => item.textContent?.trim() === 'Διαγραφή')!;
    button.click(); await fixture.whenStable();
    expect(remove).not.toHaveBeenCalled();
    confirm.and.returnValue(true);
    button.click(); await fixture.whenStable(); fixture.detectChanges();
    expect(remove).toHaveBeenCalledOnceWith('offer');
    expect(fixture.nativeElement.textContent).toContain('Η προσφορά διαγράφηκε');
  });

  it('does not report success when deletion fails', async () => {
    remove.and.resolveTo(false);
    rows.set([offer]); await render(); spyOn(window, 'confirm').and.returnValue(true);
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((item) => item.textContent?.trim() === 'Διαγραφή')!;
    button.click(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Η προσφορά διαγράφηκε');
    expect(button.disabled).toBeFalse();
  });

  it('requires an eligible variant before saving', async () => {
    await render(); setField('name', 'Προσφορά'); await submit();
    expect(save).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('επιλέξτε τουλάχιστον μία παραλλαγή');
  });

  it('edits a scheduled offer without shifting its saved date range', async () => {
    rows.set([offer]); await render();
    const edit = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.trim() === 'Επεξεργασία')!;
    edit.click(); fixture.detectChanges(); await submit();
    expect(save).toHaveBeenCalledWith(jasmine.objectContaining({ startsAt: offer.startsAt, endsAt: offer.endsAt }), 'offer');
  });

  it('deactivates an existing offer while preserving its rule and eligibility', async () => {
    rows.set([offer]); await render();
    const toggle = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.trim() === 'Απενεργοποίηση')!;
    toggle.click(); await fixture.whenStable();
    expect(save).toHaveBeenCalledWith(jasmine.objectContaining({ active: false,
      variantTemplateIds: offer.variantTemplateIds, groupSize: 3 }), 'offer');
  });
});
