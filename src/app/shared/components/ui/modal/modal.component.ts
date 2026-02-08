import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  HostListener,
  SimpleChanges
} from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl: './modal.component.html',
  styles: ``
})
export class ModalComponent implements OnInit, OnDestroy, OnChanges {

  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Input() className = '';
  @Input() showCloseButton = true;
  @Input() isFullscreen = false;

  constructor() {}

  ngOnInit() {
    if (this.isOpen) {
      document.body.style.overflow = 'hidden';
    }
  }

  ngOnDestroy() {
    document.body.style.overflow = 'unset';
  }

  ngOnChanges(changes: SimpleChanges) {
    document.body.style.overflow = this.isOpen ? 'hidden' : 'unset';
  }

  onBackdropClick(event: MouseEvent) {
    if (!this.isFullscreen) {
      this.close.emit();
    }
  }

  onContentClick(event: MouseEvent) {
    event.stopPropagation();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event) {
    if (this.isOpen) {
      this.close.emit();
    }
  }
}
