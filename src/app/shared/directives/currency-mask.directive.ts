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

    const parsed = this.parseCurrencyInput(value);
    if (parsed === null) {
      input.value = '';
      this.control.control?.setValue(null, { emitEvent: false, emitModelToViewChange: false, emitViewToModelChange: false });
      return;
    }

    const formatted = this.formatCurrency(parsed);
    
    // Update view and model
    input.value = formatted;
    this.control.control?.setValue(parsed, { emitEvent: false, emitModelToViewChange: false, emitViewToModelChange: true });

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

  private parseCurrencyInput(raw: string): number | null {
    const s = String(raw || '').trim();
    if (!s) return null;

    const cleaned = s.replace(/[^\d,.\-]/g, '');
    if (!cleaned) return null;

    const negative = cleaned.includes('-');
    const core = cleaned.replace(/-/g, '');
    if (!core) return null;

    let normalized: string;
    if (core.includes(',')) {
      normalized = core.replace(/\./g, '').replace(',', '.');
    } else if (/^\d+\.\d{1,2}$/.test(core)) {
      normalized = core;
    } else {
      normalized = core.replace(/\./g, '');
    }

    const n = Number.parseFloat(normalized);
    if (!Number.isFinite(n)) return null;
    return negative ? -n : n;
  }
}
