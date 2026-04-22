import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { LocalStorageService } from '../../../shared/services/local-storage.service';
import { AuthService } from '../../../shared/services/auth.service';
import { EventService, ApiEvent } from '../event.service';
import { EventTicketsService } from '../event-tickets.service';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';


@Component({
  selector: 'app-tickets-reserve',
  standalone: true,
  imports: [CommonModule, RouterModule, QRCodeComponent, TranslateModule, TranslatePipe],
  template: `
    <!-- Top Padding for fixed layout header if needed, but since it's inside EventsLayout we assume layout handled it.
         Actually, the user said preserve header/footer, so we just provide the content. -->
    
    <div class="min-h-screen bg-gray-50 dark:bg-[#101828] text-gray-900 dark:text-white font-body selection:bg-primary selection:text-on-primary">
      
      @if (loading) {
        <div class="flex h-screen items-center justify-center">
          <div class="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      } @else if (errorMessage) {
        <div class="mx-auto max-w-2xl px-6 py-20">
          <div class="rounded-2xl border border-error/20 bg-error/10 p-6 text-sm text-error select-none">
            <h3 class="font-headline font-bold text-lg mb-2">{{ 'eventsApp.common.oops' | translate }}</h3>
            {{ errorMessage }}
            <button (click)="ngOnInit()" class="mt-4 block text-primary font-bold hover:underline">{{ 'eventsApp.common.tryAgain' | translate }}</button>
          </div>
        </div>
      } @else {
        <main class="pb-32 overflow-hidden">
          <!-- Hero Image Section -->
          <div class="relative h-[480px] md:h-[618px] overflow-hidden">
            @if (event?.banner_url) {
              <img [src]="event?.banner_url" alt="Event Hero" class="w-full h-full object-cover" />
            } @else {
              <div class="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                <span class="material-symbols-outlined text-6xl text-gray-400 dark:text-gray-600">image</span>
              </div>
            }
            <div class="absolute inset-0 bg-gradient-to-t from-gray-50 via-gray-50/20 to-transparent dark:from-[#101828] dark:via-[#101828]/40 dark:to-transparent"></div>
            
            <div class="absolute bottom-0 left-0 w-full px-6 md:px-12 pb-12">
              <span class="inline-block px-3 py-1 mb-4 text-[10px] font-bold tracking-[0.2em] uppercase bg-primary text-[#002108] rounded-full">
                {{ 'eventsApp.reserve.liveExperience' | translate }}
              </span>
              <h1 class="font-headline font-bold text-4xl md:text-7xl tracking-tighter leading-none mb-6 text-gray-900 dark:text-white">
                {{ event?.title || event?.name || ('eventsApp.common.event' | translate) }}
              </h1>
              <div class="flex flex-wrap items-center gap-6 font-medium text-gray-600 dark:text-gray-300">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-xl">calendar_today</span>
                  <span>{{ dateLabel }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-xl">location_on</span>
                  <span>{{ event?.place || 'TBA' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Section -->
          <section class="mt-6 relative z-10 px-6 md:px-12">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-8 py-6">
              <div class="max-w-xl">
                <div class="flex items-center -space-x-3">
                  @for (avatar of (event?.attendees_avatars || []).slice(0, 3); track avatar) {
                    <img [src]="avatar" alt="Attendee" class="w-10 h-10 rounded-full border-4 border-gray-50 dark:border-[#101828] object-cover" />
                  }
                  @if ((event?.attendees_avatars?.length || 0) > 3) {
                    <div class="w-10 h-10 rounded-full border-4 border-gray-50 dark:border-[#101828] bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-primary">
                      +{{ (event?.attendees_avatars?.length || 0) - 3 }}
                    </div>
                  }
                </div>
              </div>



              <div class="flex items-center gap-4">
                <button
                  (click)="reserve()"
                  [disabled]="reserving || !!reservedTicketId"
                  class="editorial-gradient text-[#002108] font-bold px-8 py-4 rounded-2xl text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-80 disabled:scale-100 disabled:cursor-default"
                >
                  {{ reservedTicketId ? ('eventsApp.reserve.going' | translate) : ('eventsApp.reserve.wantToGo' | translate) }}
                  <span *ngIf="reservedTicketId" class="ml-2 text-xl">✓</span>
                </button>
                
                @if (reservedTicketId) {
                  <button (click)="showQr = !showQr" 
                    [ngClass]="reservedTicketId ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'"
                    class="p-4 rounded-2xl transition-colors shadow-lg shadow-black/5 hover:scale-105 active:scale-95">
                    <span class="material-symbols-outlined text-3xl transition-transform" [class.rotate-180]="showQr">{{ showQr ? 'close' : 'qr_code' }}</span>
                  </button>
                }

                <button (click)="shareEvent()" class="p-4 rounded-2xl bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                  <span class="material-symbols-outlined text-3xl">share</span>
                </button>
              </div>
            </div>

            <!-- QR Code Area -->
            @if (showQr && reservedTicketId) {
              <div class="mt-4 mb-8 p-8 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/5 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-300 shadow-2xl">
                <div class="rounded-2xl bg-white p-6 shadow-xl border border-gray-100">
                  <qrcode
                    [qrdata]="reservedQrData || reservedTicketId"
                    [width]="220"
                    [errorCorrectionLevel]="'M'"
                    [colorDark]="'#000000'"
                    [colorLight]="'#ffffff'"
                    class="h-full w-full"
                  />
                </div>
                <div class="mt-6 text-center">
                  <p class="text-sm font-bold uppercase tracking-widest text-gray-900 dark:text-white">{{ 'eventsApp.reserve.reservedTicket' | translate }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">{{ 'eventsApp.reserve.presentHint' | translate }}</p>
                </div>
              </div>
            }
          </section>

          <!-- Trending Tracks Section -->
          <section class="mt-12 px-6 md:px-12">
            <div class="flex items-center justify-between mb-8">
              <h2 class="font-headline font-bold text-2xl tracking-tight text-gray-900 dark:text-white">{{ 'eventsApp.reserve.trendingTracks' | translate }}</h2>
              <button class="text-primary font-bold text-sm hover:underline">{{ 'eventsApp.common.viewAll' | translate }}</button>
            </div>

            @if (loadingPlanned) {
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                <div *ngFor="let i of [1,2,3,4]" class="h-24 w-full animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800"></div>
              </div>
            } @else {
              @if (!plannedSongs.length) {
                <div class="py-12 text-center text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-white/10 rounded-2xl bg-gray-50 dark:bg-gray-900/50">
                  {{ 'eventsApp.reserve.noSongs' | translate }}
                </div>
              } @else {
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                  @for (s of plannedSongs; track s.song_id; let idx = $index) {
                    <div class="group flex items-center justify-between p-4 rounded-2xl hover:bg-white dark:hover:bg-gray-900 transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-white/5 active:scale-[0.98]"
                         (click)="toggleLike({ jam_id: s.jam_id }, s, $event)">
                      <div class="flex items-center gap-4 min-w-0">
                        <div class="relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-800 shadow-lg">
                          @if (s.cover_image) {
                            <img [src]="s.cover_image" class="w-full h-full object-cover" alt="Album Art">
                          } @else {
                            <div class="w-full h-full flex items-center justify-center">
                              <span class="material-symbols-outlined text-gray-400 dark:text-gray-600 text-3xl">music_note</span>
                            </div>
                          }
                          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span class="material-symbols-outlined text-white text-3xl" [style.font-variation-settings]="'\\'FILL\\' 1'">play_arrow</span>
                          </div>
                        </div>
                        <div class="min-w-0">
                          <h4 class="font-bold text-gray-900 dark:text-white truncate line-clamp-1 text-sm md:text-base mb-1" [title]="s.title">{{ s.title }}</h4>
                          <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">{{ s.artist || ('eventsApp.reserve.unknownArtist' | translate) }}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-4 ml-4">
                        <div class="flex flex-col items-center">
                          <span class="material-symbols-outlined text-2xl transition-all duration-300"
                                [ngClass]="s.liked_by_me ? 'text-primary scale-110' : 'text-gray-400 dark:text-gray-600 hover:text-primary'"
                                [style.font-variation-settings]="s.liked_by_me ? '\\'FILL\\' 1' : ''">
                            favorite
                          </span>
                          <span class="text-[10px] font-bold text-gray-400 mt-1 tabular-nums">{{ s.like_count || 0 }}</span>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            }
          </section>

          <!-- Venue Map Section -->
          <section class="mt-20 px-6 md:px-12">
            <h2 class="font-headline font-bold text-2xl tracking-tight mb-8 text-gray-900 dark:text-white">{{ 'eventsApp.common.location' | translate }}</h2>
            <a 
              [href]="event?.lat && event?.lng ? 'https://www.google.com/maps/search/?api=1&query=' + event?.lat + ',' + event?.lng : 'https://www.google.com/maps/search/?api=1&query=' + urlEncode(event?.place || '')"
              target="_blank"
              class="flex items-center gap-6 p-6 rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/5 shadow-lg hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-all group"
            >
              <div class="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <span class="material-symbols-outlined text-primary text-4xl" [style.font-variation-settings]="'\\'FILL\\' 1'">location_on</span>
              </div>


              <div class="min-w-0 flex-1">
                <h3 class="font-headline font-bold text-xl text-gray-900 dark:text-white truncate mb-1">{{ event?.place || ('eventsApp.common.location' | translate) }}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ 'eventsApp.common.viewOnMap' | translate }}</p>
              </div>
              <div class="text-gray-400 dark:text-gray-600 group-hover:text-primary transition-colors">
                <span class="material-symbols-outlined text-3xl">chevron_right</span>
              </div>
            </a>

          </section>
        </main>
      }
    </div>

    <style>
      .editorial-gradient {
        background: linear-gradient(135deg, #53e076 0%, #1db954 100%);
      }
      .font-headline { font-family: 'Plus Jakarta Sans', sans-serif; }
      .font-body { font-family: 'Inter', sans-serif; }
      .bg-primary { background-color: #53e076; }
      .text-primary { color: #53e076; }
    </style>
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

  showQr = false;

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id_code');
    this.eventIdCode = String(idParam || '');
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
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
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
        this.showQr = true; // Show QR after reservation
      },
      error: (err) => {
        const msg = err?.error?.message || 'Não foi possível reservar o ingresso.';
        const code = err?.status ? ` (${err.status})` : '';
        this.errorMessage = `${msg}${code}`;
        this.reserving = false;
      }
    });
  }

  shareEvent(): void {
    if (navigator.share) {
      navigator.share({
        title: this.event?.title || 'Evento Incrível',
        text: `Vem comigo no evento ${this.event?.title}!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      // Fallback
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        alert('Link copiado para a área de transferência!');
      });
    }
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
    // Simple date for hero: Oct 24, 2024
    if (start) {
        const d = new Date(start);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    }
    if (s && t) return `${s} - ${t}`;
    return s || t || '';
  }

  private formatDateTime(value: string): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  urlEncode(val: string): string {
    return encodeURIComponent(val);
  }
}

