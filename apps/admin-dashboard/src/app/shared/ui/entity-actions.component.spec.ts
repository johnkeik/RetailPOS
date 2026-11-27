import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityActionsComponent } from './entity-actions.component';

describe('EntityActionsComponent', () => {
  let fixture: ComponentFixture<EntityActionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EntityActionsComponent] }).compileComponents();
    fixture = TestBed.createComponent(EntityActionsComponent);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('emits edit straight from the row', () => {
    const spy = jasmine.createSpy('edit');
    fixture.componentInstance.edit.subscribe(spy);
    (fixture.nativeElement.querySelector('[aria-label="Επεξεργασία"]') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalled();
  });

  it('keeps deactivate and delete inside the more menu', () => {
    const toggle = jasmine.createSpy('toggle');
    const remove = jasmine.createSpy('delete');
    fixture.componentInstance.toggleActive.subscribe(toggle);
    fixture.componentInstance.delete.subscribe(remove);
    expect(document.querySelector('.row-menu')).toBeNull();

    (fixture.nativeElement.querySelector('[aria-label="Περισσότερες ενέργειες"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = document.querySelectorAll('.row-menu-item') as NodeListOf<HTMLButtonElement>;
    expect([...items].map((item) => item.textContent?.trim())).toEqual(['Απενεργοποίηση', 'Διαγραφή']);

    items[1].click();
    expect(remove).toHaveBeenCalled();
    expect(toggle).not.toHaveBeenCalled();
  });
});
