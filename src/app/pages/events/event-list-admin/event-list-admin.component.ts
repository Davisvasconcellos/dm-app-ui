import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventCardComponent } from '../../../shared/components/cards/event-card/event-card.component';
import { EventLinksModalComponent } from '../../../shared/components/modals/event-links-modal/event-links-modal.component';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { TranslateModule } from '@ngx-translate/core';
import { EventService, EventListItem } from '../event.service';
import { Router } from '@angular/router';
import { ToastService } from '../../../shared/services/toast.service';
import { AppContextService } from '../../../shared/services/app-context.service';

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
    EventLinksModalComponent,
    ModalComponent
  ],
  templateUrl: './event-list-admin.component.html',
  styleUrls: ['./event-list-admin.component.css'],
})
export class EventListAdminComponent implements OnInit {
  isModalOpen: boolean = false;
  selectedEventLinks: EventLink[] = [];
  events: Event[] = [];
  filteredEvents: Event[] = [];
  isLoading: boolean = false;
  loadError: string | null = null;

  // Filtering
  statusFilter: 'active' | 'draft' | 'paused' | 'canceled' = 'active';
  activeCount = 0;
  draftCount = 0;
  pausedCount = 0;
  canceledCount = 0;

  // Confirmation Modals State
  isConfirmModalOpen = false;
  confirmModalType: 'pause' | 'cancel' | 'delete' | 'resume' | 'publish' | null = null;
  selectedEventForAction: Event | null = null;

  private toast = inject(ToastService);
  private appContext = inject(AppContextService);

  constructor(private eventService: EventService, private router: Router) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  private loadEvents(): void {
    this.isLoading = true;
    this.loadError = null;
    this.eventService.getEvents().subscribe({
      next: (data: any) => {
        // Se a API retorna { data: { events: [...] } } ou direto [...]
        const items = Array.isArray(data) ? data : (data?.data?.events || []);
        this.events = items;
        this.applyFilter();
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.loadError = (err?.message as string) || 'Falha ao carregar eventos.';
      }
    });
  }

  setFilter(filter: 'active' | 'draft' | 'paused' | 'canceled') {
    this.statusFilter = filter;
    this.applyFilter();
  }

  private applyFilter() {
    // Calcular contadores
    this.activeCount = this.events.filter(e => e.status === 'published').length;
    this.draftCount = this.events.filter(e => !e.status || e.status === 'draft').length;
    this.pausedCount = this.events.filter(e => e.status === 'paused').length;
    this.canceledCount = this.events.filter(e => e.status === 'canceled').length;

    // Filtrar lista
    if (this.statusFilter === 'active') {
      this.filteredEvents = this.events.filter(e => e.status === 'published');
    } else if (this.statusFilter === 'draft') {
      this.filteredEvents = this.events.filter(e => !e.status || e.status === 'draft');
    } else {
      this.filteredEvents = this.events.filter(e => e.status === this.statusFilter);
    }
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

  onPauseEvent(event: Event) {
    this.selectedEventForAction = event;
    this.confirmModalType = 'pause';
    this.isConfirmModalOpen = true;
  }

  onResumeEvent(event: Event) {
    this.selectedEventForAction = event;
    this.confirmModalType = 'resume';
    this.isConfirmModalOpen = true;
  }

  onPublishEvent(event: Event) {
    this.selectedEventForAction = event;
    this.confirmModalType = 'publish';
    this.isConfirmModalOpen = true;
  }

  onCancelEvent(event: Event) {
    this.selectedEventForAction = event;
    this.confirmModalType = 'cancel';
    this.isConfirmModalOpen = true;
  }

  onDeleteEvent(event: Event) {
    this.selectedEventForAction = event;
    this.confirmModalType = 'delete';
    this.isConfirmModalOpen = true;
  }

  closeConfirmModal() {
    this.isConfirmModalOpen = false;
    this.confirmModalType = null;
    this.selectedEventForAction = null;
  }

  confirmAction() {
    if (!this.selectedEventForAction || !this.confirmModalType) return;

    const event = this.selectedEventForAction;
    const type = this.confirmModalType;
    const eventId = (event as any).id || (event as any).id_code; // Ajuste conforme a API retorna o ID

    if (!eventId) {
      this.toast.triggerToast('error', 'Erro', 'ID do evento não encontrado.');
      this.closeConfirmModal();
      return;
    }

    console.log(`Action confirmed: ${type} on event:`, event);

    switch(type) {
      case 'pause':
        this.eventService.updateEventStatus(eventId, 'paused').subscribe(success => {
          if (success) {
            this.toast.triggerToast('success', 'Sucesso', 'Evento pausado.');
            this.loadEvents();
          } else {
            this.toast.triggerToast('error', 'Erro', 'Falha ao pausar evento.');
          }
        });
        break;
      case 'cancel':
        this.eventService.updateEventStatus(eventId, 'canceled').subscribe(success => {
          if (success) {
            this.toast.triggerToast('success', 'Sucesso', 'Evento cancelado.');
            this.loadEvents();
          } else {
            this.toast.triggerToast('error', 'Erro', 'Falha ao cancelar evento.');
          }
        });
        break;
      case 'resume':
        this.eventService.updateEventStatus(eventId, 'published').subscribe(success => {
          if (success) {
            this.toast.triggerToast('success', 'Sucesso', 'Evento retomado (publicado).');
            this.loadEvents();
          } else {
            this.toast.triggerToast('error', 'Erro', 'Falha ao retomar evento.');
          }
        });
        break;
      case 'publish':
        this.eventService.updateEventStatus(eventId, 'published').subscribe(success => {
          if (success) {
            this.toast.triggerToast('success', 'Sucesso', 'Evento publicado.');
            this.loadEvents();
          } else {
            this.toast.triggerToast('error', 'Erro', 'Falha ao publicar evento.');
          }
        });
        break;
      case 'delete':
        this.eventService.deleteEvent(eventId).subscribe(success => {
          if (success) {
            this.toast.triggerToast('success', 'Sucesso', 'Evento excluído.');
            this.loadEvents();
          } else {
            this.toast.triggerToast('error', 'Erro', 'Falha ao excluir evento.');
          }
        });
        break;
    }

    this.closeConfirmModal();
  }

  openLinksModal(event: Event) {
    try {
      const idCode = (event as any)?.id_code as string | undefined;
      if (!idCode) {
        this.loadError = 'Evento sem id_code para gerar links.';
        return;
      }

      const origin = this.appContext.getEventsOrigin() || (typeof window !== 'undefined' && window.location ? window.location.origin : '');

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
