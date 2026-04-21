import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { EventService, ApiEvent } from '../event.service';
import { AuthService } from '../../../shared/services/auth.service';
import { QRCodeComponent } from 'angularx-qrcode';
import { LocalStorageService } from '../../../shared/services/local-storage.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
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

type PlannedSongVm = {
  id: number | string;
  jam_id: number | string;
  title: string;
  artist?: string | null;
  votes: number;
  myVote: boolean;
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
  private storage = inject(LocalStorageService);
  private ticketsService = inject(EventTicketsService);
  private router = inject(Router);
  private readonly LIKE_CACHE_KEY = 'event_song_like_cache_v1';

  categories = [
    { key: 'music', label: 'Music' },
    { key: 'food', label: 'Food' },
    { key: 'sport', label: 'Sport' },
    { key: 'movies', label: 'Movies' },
  ];
  activeCategoryKey = 'music';

  loadingPopular = false;
  popularEvents: EventCardVm[] = [];
  plannedSongsByEvent: Record<string, PlannedSongVm[]> = {};
  loadingPlannedSongsByEvent: Record<string, boolean> = {};

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
      this.preloadPlannedSongs(cards.slice(0, 6));
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

  toggleSongVote(eventIdCode: string, song: PlannedSongVm, ev?: Event): void {
    if (song?.myVote) return;
    try {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    } catch { }
    this.eventService.togglePublicPlannedSongLike(eventIdCode, song.jam_id, song.id).subscribe({
      next: (res) => {
        if (!res) {
          this.router.navigate(['/login'], { queryParams: { returnUrl: '/' } });
          return;
        }
        const list = this.plannedSongsByEvent[eventIdCode] || [];
        const idx = list.findIndex((s) => String(s.id) === String(song.id));
        if (idx < 0) return;
        list[idx] = { ...list[idx], myVote: res.liked, votes: res.like_count };
        this.plannedSongsByEvent[eventIdCode] = [...list];
        if (res.liked) this.persistLikedSong(eventIdCode, String(song.id));
      },
      error: () => {
        this.router.navigate(['/login'], { queryParams: { returnUrl: '/' } });
      }
    });
  }

  private preloadPlannedSongs(cards: EventCardVm[]): void {
    for (const c of cards) {
      const id = String(c.id_code || '').trim();
      if (!id) continue;
      if (this.loadingPlannedSongsByEvent[id]) continue;
      if (Array.isArray(this.plannedSongsByEvent[id])) continue;
      this.loadPlannedSongsForEvent(id);
    }
  }

  private loadPlannedSongsForEvent(eventIdCode: string): void {
    const id = String(eventIdCode || '').trim();
    if (!id) return;
    this.loadingPlannedSongsByEvent[id] = true;

    this.eventService.getPublicPlannedJams(id).pipe(
      catchError(() => of({ jams: [] as any[] })),
      switchMap((resp) => {
        const token = this.authService.getAuthToken();
        if (!token) return of({ planned: resp, likedIds: [] as string[] });
        return forkJoin({
          planned: of(resp),
          likedIds: this.eventService.getPublicMyLikes(id),
        }).pipe(catchError(() => of({ planned: resp, likedIds: [] as string[] })));
      }),
      map(({ planned, likedIds }) => {
        const jams = planned?.jams || [];
        const liked = new Set((likedIds || []).map((x) => String(x)));
        const all: PlannedSongVm[] = [];
        for (const j of jams) {
          const jamId = String(j?.id_code || j?.id || '').trim();
          if (!jamId) continue;
          const songs = Array.isArray(j?.songs) ? (j.songs as any[]) : [];
          for (const s of songs) {
            const songId = String(s?.id_code || s?.id || '').trim();
            if (!songId) continue;
            const votes = Number(s?.like_count ?? 0);
            all.push({
              id: songId,
              jam_id: jamId,
              title: String(s?.title || ''),
              artist: s?.artist ?? null,
              votes: Number.isFinite(votes) ? votes : 0,
              myVote: liked.has(songId) || !!s?.liked_by_me,
            });
          }
        }
        const sorted = all.sort((a, b) => (a.votes < b.votes ? 1 : -1)).slice(0, 4);
        const cached = this.loadLikeCacheForEvent(id);
        if (cached) {
          for (const s of sorted) {
            if (!s.myVote && cached[String(s.id)]) s.myVote = true;
          }
        }
        return sorted;
      }),
      catchError(() => of([] as PlannedSongVm[]))
    ).subscribe((songs) => {
      this.plannedSongsByEvent[id] = songs || [];
      this.loadingPlannedSongsByEvent[id] = false;
    });
  }

  private persistLikedSong(eventIdCode: string, songIdRaw: string): void {
    const eventId = String(eventIdCode || '').trim();
    const songId = String(songIdRaw || '').trim();
    if (!eventId || !songId) return;
    const raw = this.storage.getData<any>(this.LIKE_CACHE_KEY);
    const byEvent = raw?.version === 1 && raw?.by_event && typeof raw.by_event === 'object' ? raw.by_event : {};
    const current = byEvent[eventId] && typeof byEvent[eventId] === 'object' ? byEvent[eventId] : {};
    const next = {
      version: 1,
      by_event: {
        ...byEvent,
        [eventId]: { ...current, [songId]: true },
      },
    };
    this.storage.saveData(this.LIKE_CACHE_KEY, next);
  }

  private loadLikeCacheForEvent(eventIdCode: string): Record<string, boolean> | null {
    const eventId = String(eventIdCode || '').trim();
    if (!eventId) return null;
    const raw = this.storage.getData<any>(this.LIKE_CACHE_KEY);
    const byEvent = raw?.version === 1 && raw?.by_event && typeof raw.by_event === 'object' ? raw.by_event : {};
    const entry = byEvent[eventId];
    if (!entry || typeof entry !== 'object') return null;
    return entry as Record<string, boolean>;
  }
}
