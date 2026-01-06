import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventCardComponent } from '../../../shared/components/cards/event-card/event-card.component';
import { EventLinksModalComponent } from '../../../shared/components/modals/event-links-modal/event-links-modal.component';
import { TranslateModule } from '@ngx-translate/core';
import { EventService, EventListItem } from '../event.service';
import { Router } from '@angular/router';

export interface EventLink {
  text: string;
  url: string;
  variant: 'primary' | 'outline' | 'info' | 'warning';
}

type Event = EventListItem;

@Component({
  selector: 'app-event-list-admin',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    EventCardComponent,
    EventLinksModalComponent
  ],
  templateUrl: './event-list-admin.component.html',
  styleUrls: ['./event-list-admin.component.css'],
})
export class EventListAdminComponent implements OnInit {
  isModalOpen: boolean = false;
  selectedEventLinks: EventLink[] = [];
  events: Event[] = [];
  isLoading: boolean = false;
  loadError: string | null = null;

  constructor(private eventService: EventService, private router: Router) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  private loadEvents(): void {
    this.isLoading = true;
    this.loadError = null;
    this.eventService.getEvents().subscribe({
      next: (items) => {
        this.events = items;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.loadError = (err?.message as string) || 'Falha ao carregar eventos.';
      }
    });
  }

  goToCreateEvent() {
    this.router.navigate(['/events/event-create']);
  }

  onEditEvent(event: Event) {
    try {
      const idCode = (event as any)?.id_code as string | undefined;
      if (!idCode) {
        this.loadError = 'Evento sem id_code para edição.';
        return;
      }
      this.router.navigate(['/events/event-view', idCode]);
    } catch (e) {
      console.error('Falha ao navegar para edição:', e);
      this.loadError = 'Falha ao abrir edição do evento.';
    }
  }

  openLinksModal(event: Event) {
    try {
      const idCode = (event as any)?.id_code as string | undefined;
      if (!idCode) {
        this.loadError = 'Evento sem id_code para gerar links.';
        return;
      }

      const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';

      const primaryLinks: EventLink[] = [
        // {
        //   text: 'Responder Perguntas do Evento',
        //   url: `${origin}/events/answer-plain/${idCode}`,
        //   variant: 'primary',
        // },
        {
          text: 'Check-in do Evento',
          url: `${origin}/events/checkin/${idCode}`,
          variant: 'info',
        },
        // {
        //   text: 'Página do Evento (Admin)',
        //   url: `${origin}/events/event-view/${idCode}`,
        //   variant: 'outline',
        // },
      ];

      const extraLinks = (event.links || []).filter(l => !!l?.text && !!l?.url);

      this.selectedEventLinks = [...primaryLinks, ...extraLinks];
      this.isModalOpen = true;
    } catch (e) {
      console.error('Falha ao montar links do evento:', e);
      this.loadError = 'Falha ao abrir links do evento.';
    }
  }

  closeLinksModal() {
    this.isModalOpen = false;
    this.selectedEventLinks = [];
  }
}
