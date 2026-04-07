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
    const input = this.el.nativeElement as HTMLInputElement;
    let digits = input.value.replace(/\D/g, '');

    if (!digits) {
      this.updateModel(null);
      return;
    }

    // Estilo centavos: digitou 1500 -> 15.00
    const cents = parseInt(digits, 10);
    const parsedValue = cents / 100;
    const formatted = this.formatCurrency(parsedValue);

    if (input.value !== formatted) {
      input.value = formatted;
      this.updateModel(parsedValue);
    }

    this.setCursorToEnd();
  }

  @HostListener('focus')
  onFocus() {
    setTimeout(() => this.setCursorToEnd(), 0);
  }

  @HostListener('blur')
  onBlur() {
    if (this.control.value !== null && this.control.value !== undefined) {
      const val = Number(this.control.value);
      this.el.nativeElement.value = this.formatCurrency(val);
    }
  }

  private updateModel(value: number | null) {
    this.control.control?.setValue(value, { 
      emitEvent: false, 
      emitModelToViewChange: false, 
      emitViewToModelChange: true 
    });
  }

  private setCursorToEnd() {
    const input = this.el.nativeElement;
    if (document.activeElement === input) {
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }

  private format(value: number | string) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num !== null && !isNaN(num)) {
      this.el.nativeElement.value = this.formatCurrency(num);
    }
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  }
}
