import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { EventService, ApiEvent } from '../event.service';
import { AuthService } from '../../../shared/services/auth.service';
import { QRCodeComponent } from 'angularx-qrcode';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { EventTicketsService, MyTicket } from '../event-tickets.service';
import { filter } from 'rxjs/operators';

type EventCardVm = {
  id_code: string;
  title: string;
  subtitle?: string;
  dateLabel?: string;
  imageUrl?: string | null;
  place?: string;
  status?: string;
};

type MyTicketVm = {
  id_code: string;
  qrData: string;
  status: string;
  event: EventCardVm;
  ticket_type_name?: string;
  expires_at?: string | null;
};

@Component({
  selector: 'app-events-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, QRCodeComponent],
  templateUrl: './events-landing.component.html',
})
export class EventsLandingComponent implements OnInit {
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  private ticketsService = inject(EventTicketsService);
  private router = inject(Router);

  categories = [
    { key: 'music', label: 'Music' },
    { key: 'food', label: 'Food' },
    { key: 'sport', label: 'Sport' },
    { key: 'movies', label: 'Movies' },
  ];
  activeCategoryKey = 'music';

  loadingPopular = false;
  popularEvents: EventCardVm[] = [];

  loadingMy = false;
  myTickets: MyTicketVm[] = [];
  selectedTicket: MyTicketVm | null = null;
  isTicketClosing = false;
  private ticketCloseTimer: any = null;

  ngOnInit(): void {
    this.loadPopularEvents();
    this.loadMyEvents();
    this.scrollToFragment(this.router.url);
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((e) => this.scrollToFragment(e.urlAfterRedirects));
  }

  isLoggedIn(): boolean {
    return !!this.authService.getAuthToken();
  }

  setActiveCategory(key: string): void {
    this.activeCategoryKey = key;
  }

  toReserveUrl(idCode: string): string {
    return `/tickets/reserve/${idCode}`;
  }

  private loadPopularEvents(): void {
    this.loadingPopular = true;
    this.eventService.getPublicEventsListPaged({
      page: 1,
      limit: 20,
      sort_by: 'start_datetime',
      order: 'asc',
      status: 'upcoming',
    }).pipe(
      map((resp) => (resp?.events || []).slice(0, 12).map((e) => this.mapToCard(e))),
      catchError(() => of([] as EventCardVm[]))
    ).subscribe((cards) => {
      this.popularEvents = cards;
      this.loadingPopular = false;
    });
  }

  private loadMyEvents(): void {
    if (!this.isLoggedIn()) {
      this.myTickets = [];
      return;
    }

    this.loadingMy = true;
    this.ticketsService.getMyTickets({ page: 1, limit: 20 }).pipe(
      map((resp) => (resp?.data || []).map((t) => this.mapMyTicket(t))),
      catchError(() => of([] as MyTicketVm[]))
    ).subscribe((tickets) => {
      this.myTickets = tickets;
      this.loadingMy = false;
    });
  }

  openTicket(ticket: MyTicketVm): void {
    if (this.ticketCloseTimer) clearTimeout(this.ticketCloseTimer);
    this.isTicketClosing = false;
    this.selectedTicket = ticket;
  }

  closeTicket(): void {
    if (!this.selectedTicket) return;
    this.isTicketClosing = true;
    if (this.ticketCloseTimer) clearTimeout(this.ticketCloseTimer);
    this.ticketCloseTimer = setTimeout(() => {
      this.selectedTicket = null;
      this.isTicketClosing = false;
      this.ticketCloseTimer = null;
    }, 220);
  }

  private mapMyTicket(t: MyTicket): MyTicketVm {
    const ev = t?.event || ({} as any);
    const asApiEvent: ApiEvent = {
      id: ev.id,
      id_code: ev.id,
      name: ev.name,
      slug: ev.slug,
      banner_url: ev.banner_url || undefined,
      place: ev.place || undefined,
      date: ev.date || undefined,
      start_time: ev.start_time || undefined,
      end_time: ev.end_time || undefined,
      status: ev.status as any,
    };
    return {
      id_code: String(t?.id_code || ''),
      qrData: String(t?.qr_token || t?.id_code || ''),
      status: String(t?.status || ''),
      expires_at: t?.expires_at || null,
      ticket_type_name: t?.ticket_type?.name || undefined,
      event: this.mapToCard(asApiEvent),
    };
  }

  private mapToCard(e: ApiEvent | null | undefined): EventCardVm {
    const id_code = String(e?.id_code || '');
    const title = String(e?.title || e?.name || 'Evento');
    const date = e?.start_datetime || e?.start_date || e?.startDate || e?.date || '';
    const place = e?.place || '';
    const imageUrl = e?.banner_url || e?.image || null;
    return {
      id_code,
      title,
      subtitle: place || undefined,
      dateLabel: this.formatDateLabel(date),
      imageUrl,
      place: place || undefined,
      status: (e as any)?.status || undefined,
    };
  }

  private formatDateLabel(value: string): string | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  private scrollToFragment(url: string): void {
    const idx = url.indexOf('#');
    if (idx < 0) return;
    const frag = url.slice(idx + 1);
    if (!frag) return;
    setTimeout(() => {
      const el = document.getElementById(frag);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }
}
