import { Component, input, output } from '@angular/core';

let nextId = 0;

@Component({
  selector: 'app-search-field',
  host: { class: 'search' },
  template: `
    <label class="sr-only" [for]="id">{{ label() }}</label>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" />
    </svg>
    <input
      [id]="id"
      type="search"
      class="text-input"
      autocomplete="off"
      [value]="value()"
      [placeholder]="placeholder()"
      (input)="search.emit(field.value)"
      #field
    />
  `,
  styles: [`:host { display: block; }`]
})
export class SearchFieldComponent {
  protected readonly id = `search-${++nextId}`;
  readonly value = input('');
  readonly placeholder = input('Αναζήτηση');
  readonly label = input('Αναζήτηση');
  readonly search = output<string>();
}
