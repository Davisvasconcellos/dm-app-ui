import { Directive, HostListener, ElementRef, OnInit, HostBinding } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: '[appCurrencyMask]',
  standalone: true
})
export class CurrencyMaskDirective implements OnInit {

  @HostBinding('attr.inputmode') inputMode = 'numeric';

  constructor(private el: ElementRef, private control: NgControl) {}

  ngOnInit() {
    // Format initial value
    if (this.control.value) {
      this.format(this.control.value);
    }
  }

  @HostListener('click')
  onClick() {
    this.setCursorToEnd();
  }

  @HostListener('input', ['$event'])
  onInput(event: any) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    // Remove non-digits
    const digits = value.replace(/\D/g, '');
    
    // Handle empty case
    if (!digits) {
      input.value = '';
      this.control.control?.setValue(null);
      return;
    }

    // Convert to number (cents)
    const numberValue = parseInt(digits, 10) / 100;

    // Format for display
    const formatted = this.formatCurrency(numberValue);
    
    // Update view and model
    input.value = formatted;
    this.control.control?.setValue(numberValue, { emitEvent: false });

    // Force cursor to end immediately
    this.setCursorToEnd();
  }

  @HostListener('focus')
  onFocus() {
    // Ensure cursor goes to end on focus
    // Small delay to handle browser focus behavior
    setTimeout(() => this.setCursorToEnd(), 0);
  }

  @HostListener('blur')
  onBlur() {
    if (this.control.value !== null && this.control.value !== undefined) {
      this.el.nativeElement.value = this.formatCurrency(this.control.value);
    }
  }

  private setCursorToEnd() {
    const input = this.el.nativeElement;
    // Only set if input is focused to avoid stealing focus
    if (document.activeElement === input) {
        const len = input.value.length;
        if (input.setSelectionRange) {
            input.setSelectionRange(len, len);
        }
    }
  }

  private format(value: number | string) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(num)) {
       this.el.nativeElement.value = this.formatCurrency(num);
    }
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }
}
