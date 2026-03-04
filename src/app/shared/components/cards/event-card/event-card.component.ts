import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardComponent } from '../../ui/card/card.component';
import { CardTitleComponent } from '../../ui/card/card-title.component';
import { CardDescriptionComponent } from '../../ui/card/card-description.component';
import { BadgeComponent } from '../../ui/badge/badge.component'; // Importar BadgeComponent

@Component({
  selector: 'app-event-card',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CardComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    BadgeComponent, // Adicionar BadgeComponent aos imports
  ],
  templateUrl: './event-card.component.html',
  styleUrls: ['./event-card.component.css'],
})
export class EventCardComponent {
  @Input() eventName: string = '';
  @Input() description: string = '';
  @Input() startDate: string = '';
  @Input() endDate: string = '';
  @Input() status: string | undefined = 'published';
  private _image: string = '/images/cards/card-01.png';

  @Input()
  set image(value: string | undefined | null) {
    this._image = this.normalizeImageUrl(value);
  }

  get image(): string {
    return this._image;
  }

  private normalizeImageUrl(url: string | undefined | null): string {
    if (!url) return '/images/cards/card-01.png';

    let clean = url.trim().replace(/[`'\\\"]/g, '');

    // Se for URL completa (http/https), retorna direto
    if (/^https?:\/\//.test(clean)) {
      return clean;
    }

    // Se vier apenas o nome do arquivo ou caminho relativo
    if (!clean.startsWith('/')) {
      clean = `/images/cards/${clean}`;
    }

    return clean;
  }
  @Input() links: { text: string; url: string; variant: 'primary' | 'outline' | 'info' | 'warning' }[] = [];
  @Input() isPublic: boolean = false;
  @Input() actionLabel: string = 'Ver Detalhes';
  @Output() viewLinks = new EventEmitter<void>();
  @Output() editEvent = new EventEmitter<void>();
  @Output() actionClick = new EventEmitter<void>();

  @Output() pauseEvent = new EventEmitter<void>();
  @Output() resumeEvent = new EventEmitter<void>();
  @Output() cancelEvent = new EventEmitter<void>();
  @Output() deleteEvent = new EventEmitter<void>();

  onViewLinksClick() {
    this.viewLinks.emit();
  }

  onEditClick() {
    if (this.isPublic) {
      this.actionClick.emit();
    } else {
      this.editEvent.emit();
    }
  }

  onPauseClick() {
    if (this.status === 'paused') {
      this.resumeEvent.emit();
    } else {
      this.pauseEvent.emit();
    }
  }

  onCancelClick() {
    if (this.status === 'canceled') {
      this.resumeEvent.emit();
    } else {
      this.cancelEvent.emit();
    }
  }

  onDeleteClick() {
    this.deleteEvent.emit();
  }

  onActionClick() {
    this.actionClick.emit();
  }
}
