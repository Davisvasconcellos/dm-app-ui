import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { LocalStorageService } from '../../../shared/services/local-storage.service';
import { AuthService } from '../../../shared/services/auth.service';
import { EventService, ApiEvent } from '../event.service';
import { EventTicketsService } from '../event-tickets.service';

@Component({
  selector: 'app-tickets-reserve',
  standalone: true,
  imports: [CommonModule, RouterModule, QRCodeComponent],
  template: `
    <div class="min-h-screen bg-white dark:bg-black">
      <div class="mx-auto max-w-2xl px-4 py-6">
        <div class="flex items-center justify-between gap-4">
          <a
            routerLink="/"
            class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            aria-label="Voltar"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div class="flex-1">
            <div class="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-white/60">Evento</div>
            <div class="mt-0.5 text-sm text-gray-700 dark:text-white/70">Acesse e faça o self-check-in na entrada.</div>
          </div>
          <div class="h-10 w-10"></div>
        </div>

      @if (loading) {
        <div class="mt-6 space-y-3">
          <div class="h-28 w-full rounded-3xl bg-gray-100 dark:bg-white/5"></div>
          <div class="h-60 w-full rounded-3xl bg-gray-100 dark:bg-white/5"></div>
        </div>
      } @else if (errorMessage) {
        <div class="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
          {{ errorMessage }}
        </div>
      } @else {
        <div class="mt-6 space-y-8">
          <div class="rounded-3xl bg-gray-50 p-4 dark:bg-white/5">
            <div class="flex items-center gap-3">
              <div class="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gray-200 dark:bg-white/10">
                @if (event?.banner_url) {
                  <img [src]="event?.banner_url" class="h-full w-full object-cover" alt="">
                }
              </div>

              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-extrabold text-gray-900 dark:text-white">
                  {{ event?.title || event?.name || 'Evento' }}
                </div>
                <div class="mt-0.5 truncate text-xs text-gray-600 dark:text-white/70">
                  {{ dateLabel }}
                </div>
                <div class="mt-0.5 truncate text-xs text-gray-500 dark:text-white/60">
                  {{ event?.place || '' }}
                </div>
              </div>
            </div>

            <button
              type="button"
              (click)="reserve()"
              [disabled]="reserving || !!reservedTicketId"
              class="mt-4 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-extrabold uppercase tracking-wider shadow-sm transition disabled:cursor-not-allowed"
              [ngClass]="reservedTicketId
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-gray-900 hover:bg-gray-100 dark:bg-white dark:text-black'"
            >
              EU VOU!
              <svg viewBox="0 0 24 24" class="ml-2 h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5" />
              </svg>
            </button>
          </div>

          @if (reservedTicketId) {
            <div class="rounded-3xl bg-gray-50 p-4 dark:bg-white/5">
              <div class="flex items-center justify-center">
                <div class="rounded-2xl bg-white p-3 shadow-sm">
                  <qrcode
                    [qrdata]="reservedQrData || reservedTicketId"
                    [width]="180"
                    [errorCorrectionLevel]="'M'"
                    [colorDark]="'#000000'"
                    [colorLight]="'#ffffff'"
                    class="h-full w-full"
                  />
                </div>
              </div>
            </div>
          }

          <div>
            <div class="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-white/60">
              Músicas do evento - ranking
            </div>
            <div class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
              Escolha as suas músicas favoritas para o evento
            </div>

            @if (loadingPlanned) {
              <div class="mt-4 space-y-3">
                <div class="h-14 w-full rounded-2xl bg-gray-100 dark:bg-white/5"></div>
                <div class="h-14 w-full rounded-2xl bg-gray-100 dark:bg-white/5"></div>
                <div class="h-14 w-full rounded-2xl bg-gray-100 dark:bg-white/5"></div>
              </div>
            } @else {
              @if (!plannedSongs.length) {
                <div class="mt-4 text-sm text-gray-600 dark:text-white/70">
                  Nenhuma música planned disponível no momento.
                </div>
              } @else {
                <div class="mt-4 divide-y divide-gray-200 dark:divide-white/10">
                  @for (s of plannedSongs; track s.song_id; let idx = $index) {
                    <div class="flex items-center gap-3 py-3">
                      <div class="w-7 shrink-0 text-right text-sm font-extrabold text-gray-500 dark:text-white/60">
                        #{{ idx + 1 }}
                      </div>

                      <div class="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-200 dark:bg-white/10">
                        @if (s.cover_image) {
                          <img [src]="s.cover_image" class="h-full w-full object-cover" alt="">
                        }
                      </div>

                      <div class="min-w-0 flex-1">
                        <div class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {{ s.title }}
                        </div>
                        <div class="truncate text-xs text-gray-600 dark:text-white/70">
                          {{ s.artist || '' }}
                        </div>
                      </div>

                      <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition"
                        [ngClass]="s.liked_by_me
                          ? 'text-emerald-600 dark:text-emerald-400 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/10'"
                        (click)="toggleLike({ jam_id: s.jam_id }, s, $event)"
                        [disabled]="s.liked_by_me || likingIds.has(likeKey({ jam_id: s.jam_id }, s))"
                        aria-label="Curtir"
                      >
                        <svg viewBox="0 0 24 24" class="h-5 w-5" [attr.fill]="s.liked_by_me ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M20.84 4.61c-1.54-1.41-3.77-1.44-5.33-.1L12 7.35l-3.51-2.84c-1.56-1.34-3.79-1.31-5.33.1-1.78 1.64-1.83 4.43-.16 6.14l8.05 8.33c.53.55 1.4.55 1.93 0l8.05-8.33c1.67-1.71 1.62-4.5-.19-6.14z" />
                        </svg>
                        <span class="tabular-nums">{{ s.like_count || 0 }}</span>
                      </button>
                    </div>
                  }
                </div>
              }
            }
          </div>
        </div>
      }
      </div>
    </div>
  `,
})
export class TicketsReserveComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private storage = inject(LocalStorageService);
  private authService = inject(AuthService);
  private eventService = inject(EventService);
  private ticketsService = inject(EventTicketsService);

  reservationsEnabled = false;
  private readonly RESERVATION_KEY = 'event_ticket_reservation_v1';
  private readonly LIKE_CACHE_KEY = 'event_song_like_cache_v1';

  loading = true;
  reserving = false;
  errorMessage = '';

  eventIdCode = '';
  event: ApiEvent | null = null;
  dateLabel = '';

  reservedTicketId: string | null = null;
  reservedQrData: string | null = null;
  expiresAtLabel: string | null = null;

  loadingPlanned = false;
  plannedJams: any[] = [];
  plannedSongs: any[] = [];
  plannedMaxLikes = 1;
  plannedMeta: { total_songs?: number; total_likes?: number } | null = null;
  likingIds = new Set<string>();

  ngOnInit(): void {
    this.eventIdCode = String(this.route.snapshot.paramMap.get('id_code') || '');
    if (!this.eventIdCode) {
      this.errorMessage = 'Evento inválido.';
      this.loading = false;
      return;
    }

    this.restoreReservation();

    this.eventService.getPublicEventByIdCodeDetail(this.eventIdCode).subscribe({
      next: (resp) => {
        this.event = (resp?.event || null) as ApiEvent | null;
        this.dateLabel = this.formatDateRange(this.event);
        this.loading = false;
        this.loadPlannedSongs();
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar o evento.';
        this.loading = false;
      }
    });
  }

  private loadPlannedSongs(): void {
    if (!this.eventIdCode) return;
    this.loadingPlanned = true;
    this.eventService.getPublicPlannedJams(this.eventIdCode).subscribe({
      next: (resp) => {
        this.plannedJams = Array.isArray(resp?.jams) ? resp.jams : [];
        this.plannedMeta = (resp?.meta || null) as any;
        const flat: any[] = [];
        for (const j of this.plannedJams) {
          const jamId = String(j?.id_code || j?.id || '').trim();
          const songs = Array.isArray(j?.songs) ? (j.songs as any[]) : [];
          for (const s of songs) {
            const songId = String(s?.id_code || s?.id || '').trim();
            if (!jamId || !songId) continue;
            const likeCount = Number(s?.like_count ?? 0);
            flat.push({
              jam_id: jamId,
              song_id: songId,
              title: s?.title ?? '',
              artist: s?.artist ?? '',
              cover_image: s?.cover_image ?? null,
              order_index: s?.order_index ?? null,
              ready: !!s?.ready,
              like_count: Number.isFinite(likeCount) ? likeCount : 0,
              liked_by_me: !!s?.liked_by_me,
            });
          }
        }
        flat.sort((a, b) => (a.like_count < b.like_count ? 1 : -1));
        this.eventService.getPublicMyLikes(this.eventIdCode).subscribe({
          next: (ids) => {
            const set = new Set((ids || []).map((x) => String(x)));
            for (const s of flat) {
              if (set.has(String(s.song_id))) s.liked_by_me = true;
            }
            this.applyLikeCache(flat);
            this.plannedSongs = flat;
            this.plannedMaxLikes = Math.max(1, ...flat.map((x) => Number(x?.like_count ?? 0) || 0));
            this.loadingPlanned = false;
          },
          error: () => {
            this.applyLikeCache(flat);
            this.plannedSongs = flat;
            this.plannedMaxLikes = Math.max(1, ...flat.map((x) => Number(x?.like_count ?? 0) || 0));
            this.loadingPlanned = false;
          },
        });
      },
      error: () => {
        this.plannedJams = [];
        this.plannedMeta = null;
        this.plannedSongs = [];
        this.plannedMaxLikes = 1;
        this.loadingPlanned = false;
      },
    });
  }

  likeKey(jam: any, song: any): string {
    return `${String(jam?.id_code || jam?.id || jam?.jam_id || '').trim()}:${String(song?.id_code || song?.id || song?.song_id || '').trim()}`;
  }

  toggleLike(jam: any, song: any, ev?: Event): void {
    try {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    } catch { }
    if (song?.liked_by_me) return;
    const jamId = String(jam?.id_code || jam?.id || jam?.jam_id || '').trim();
    const songId = String(song?.id_code || song?.id || song?.song_id || '').trim();
    if (!this.eventIdCode || !jamId || !songId) return;
    const key = this.likeKey(jam, song);
    if (this.likingIds.has(key)) return;
    this.likingIds.add(key);

    this.eventService.togglePublicPlannedSongLike(this.eventIdCode, jamId, songId).subscribe({
      next: (res) => {
        if (!res) {
          const returnUrl = `/tickets/reserve/${this.eventIdCode}`;
          this.router.navigate(['/login'], { queryParams: { returnUrl } });
          this.likingIds.delete(key);
          return;
        }
        song.liked_by_me = res.liked;
        song.like_count = res.like_count;
        if (res.liked) this.persistLikedSong(songId);
        if (res.liked) {
          this.plannedMaxLikes = Math.max(this.plannedMaxLikes, song.like_count || 0);
        }
        this.likingIds.delete(key);
      },
      error: () => {
        const returnUrl = `/tickets/reserve/${this.eventIdCode}`;
        this.router.navigate(['/login'], { queryParams: { returnUrl } });
        this.likingIds.delete(key);
      }
    });
  }

  reserve(): void {
    if (!this.eventIdCode) return;
    if (this.reserving) return;
    if (this.reservedTicketId) return;

    this.reserving = true;
    this.errorMessage = '';
    this.ticketsService.reserveTicket(this.eventIdCode).subscribe({
      next: (resp) => {
        const id = resp?.data?.ticket_id || '';
        this.reservedTicketId = id ? String(id) : null;
        const qr = resp?.data?.qr_token || id;
        this.reservedQrData = qr ? String(qr) : null;
        this.expiresAtLabel = this.formatDateTime(resp?.data?.expires_at || '');
        this.persistReservation({
          ticket_id: this.reservedTicketId,
          qr_token: this.reservedQrData,
          expires_at: resp?.data?.expires_at || null,
        });
        this.reserving = false;
      },
      error: (err) => {
        const msg = err?.error?.message || 'Não foi possível reservar o ingresso.';
        const code = err?.status ? ` (${err.status})` : '';
        this.errorMessage = `${msg}${code}`;
        this.reserving = false;
      }
    });
  }

  private restoreReservation(): void {
    const id = String(this.eventIdCode || '').trim();
    if (!id) return;
    const raw = this.storage.getData<any>(this.RESERVATION_KEY);
    const byEvent = raw?.version === 1 && raw?.by_event && typeof raw.by_event === 'object' ? raw.by_event : {};
    const entry = byEvent[id] || null;
    if (!entry) return;
    const expiresAt = entry?.expires_at ? new Date(entry.expires_at).getTime() : NaN;
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
      const next = { version: 1, by_event: { ...byEvent } };
      delete next.by_event[id];
      this.storage.saveData(this.RESERVATION_KEY, next);
      return;
    }
    this.reservedTicketId = entry?.ticket_id ? String(entry.ticket_id) : null;
    this.reservedQrData = entry?.qr_token ? String(entry.qr_token) : null;
    this.expiresAtLabel = this.formatDateTime(entry?.expires_at || '');
  }

  private persistReservation(entry: { ticket_id: string | null; qr_token: string | null; expires_at: string | null }): void {
    const id = String(this.eventIdCode || '').trim();
    if (!id) return;
    if (!entry.ticket_id) return;
    const raw = this.storage.getData<any>(this.RESERVATION_KEY);
    const byEvent = raw?.version === 1 && raw?.by_event && typeof raw.by_event === 'object' ? raw.by_event : {};
    const next = {
      version: 1,
      by_event: {
        ...byEvent,
        [id]: entry,
      },
    };
    this.storage.saveData(this.RESERVATION_KEY, next);
  }

  private applyLikeCache(flat: any[]): void {
    const byEvent = this.loadLikeCacheForEvent();
    if (!byEvent) return;
    for (const s of flat) {
      const songId = String(s?.song_id || '').trim();
      if (!songId) continue;
      if (!s.liked_by_me && byEvent[songId]) s.liked_by_me = true;
    }
  }

  private persistLikedSong(songIdRaw: string): void {
    const eventId = String(this.eventIdCode || '').trim();
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

  private loadLikeCacheForEvent(): Record<string, boolean> | null {
    const eventId = String(this.eventIdCode || '').trim();
    if (!eventId) return null;
    const raw = this.storage.getData<any>(this.LIKE_CACHE_KEY);
    const byEvent = raw?.version === 1 && raw?.by_event && typeof raw.by_event === 'object' ? raw.by_event : {};
    const entry = byEvent[eventId];
    if (!entry || typeof entry !== 'object') return null;
    return entry as Record<string, boolean>;
  }

  private formatDateRange(e: ApiEvent | null): string {
    const start = e?.start_datetime || e?.start_date || e?.startDate || '';
    const end = e?.end_datetime || e?.end_date || e?.endDate || '';
    const s = this.formatDateTime(start);
    const t = this.formatDateTime(end);
    if (s && t) return `${s} - ${t}`;
    return s || t || '';
  }

  private formatDateTime(value: string): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
