import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';

export interface Option {
  value: string;
  text: string;
}

@Component({
  selector: 'app-multi-select',
  imports: [
    CommonModule,
  ],
  templateUrl: './multi-select.component.html',
  styles: ``
})
export class MultiSelectComponent implements OnInit, OnChanges {

  @Input() label: string = '';
  @Input() placeholder: string = 'Select option';
  @Input() options: Option[] = [];
  @Input() defaultSelected: string[] = [];
  @Input() disabled: boolean = false;
  @Output() selectionChange = new EventEmitter<string[]>();

  selectedOptions: string[] = [];
  isOpen = false;

  ngOnInit() {
    this.selectedOptions = [...this.defaultSelected];
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['defaultSelected'] && changes['defaultSelected'].currentValue) {
      this.selectedOptions = [...changes['defaultSelected'].currentValue];
    }
  }

  toggleDropdown() {
    if (!this.disabled) this.isOpen = !this.isOpen;
  }

  handleSelect(optionValue: string) {
    if (this.selectedOptions.includes(optionValue)) {
      this.selectedOptions = this.selectedOptions.filter(v => v !== optionValue);
    } else {
      this.selectedOptions = [...this.selectedOptions, optionValue];
    }
    this.selectionChange.emit(this.selectedOptions);
  }

  removeOption(value: string) {
    this.selectedOptions = this.selectedOptions.filter(opt => opt !== value);
    this.selectionChange.emit(this.selectedOptions);
  }

  get selectedValuesText(): string[] {
    return this.selectedOptions
      .map(value => this.options.find(option => option.value === value)?.text || '')
      .filter(Boolean);
  }
}
