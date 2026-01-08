import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ApplicationRef, Injector, EnvironmentInjector, createComponent } from '@angular/core';
import { trigger, state, style, transition, animate, stagger, query } from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EventService, ApiJam, ApiSong, OnStageResponse } from '../event.service';
import { AuthService, User } from '../../../shared/services/auth.service';
import { NotificationComponent } from '../../../shared/components/ui/notification/notification/notification.component';

@Component({
  selector: 'app-home-guest-v2',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home-guest-v2.component.html',
  styleUrl: './home-guest-v2.component.css',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('500ms ease-out', style({ opacity: 1 }))
      ])
    ]),
    trigger('listAnimation', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateX(-20px)' }),
          stagger(100, [
            animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class HomeGuestV2Component implements OnInit, OnDestroy {
  eventIdCode = '';
  jams: ApiJam[] = [];
  plannedSongs: ApiSong[] = [];
  onStageSongs: ApiSong[] = [];
  playingNowSongs: ApiSong[] = [];
  goToStageSongs: ApiSong[] = [];

  // Maps and state tracking
  selections: Record<number, string | null> = {};
  lockDeadline: Record<number, number> = {};
  submitted: Record<number, boolean> = {};
  submitError: Record<number, boolean> = {};
  approvedMap: Record<number, boolean> = {};
  myStatusMap: Record<number, string> = {};
  attempting: Record<number, boolean> = {};
  now: number = Date.now();
  tickHandle: any;
  songJamMap: Record<number, number> = {};
  eventName = '';
  eventBanner: string | null = null;
  esMap: Record<number, EventSource> = {};
  sseRefreshTimer: any;

  // SSE & Polling configuration
  debugSse = true;
  sseOpenCount = 0;
  lastEventType = '';
  lastEventAt = 0;
  lastEventAtMap: Record<number, number> = {};
  sseStatusText = 'SSE 0 • - • -';
  pollingHandle: any;
  backoffUntilMs = 0;
  enablePolling = true;
  jamId: number | null = null;
  sseWatchdogHandle: any;
  enableWatchdog = false;
  useSse = false;

  isLoadingOpen: boolean = false;
  isLoadingStage: boolean = false;
  showLog = false;
  readyMap: Record<number, boolean> = {};
  decisionsLog: Array<{ songId: number; tipo: string; acao: string; at: number }> = [];
  uiLog: Array<{ msg: string; at: number }> = [];

  // For prototype UI
  selectedDraftSlots: Record<number, number> = {};
  playlistSongs: any[] = [];
  selectedPlaylistIndex = 0;
  animateFooter = false;

  // View State
  viewMode: 'playlist' | 'dashboard' = 'dashboard'; // Start with dashboard as it is fully implemented
  isSidebarOpen = false;
  currentUser: User | null = null;
  selfieUrl: string | null = null;

  constructor(
    private eventService: EventService,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router,
    private appRef: ApplicationRef,
    private injector: Injector,
    private envInjector: EnvironmentInjector
  ) {
    this.useSse = true;
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    this.route.paramMap.subscribe(pm => {
      this.eventIdCode = pm.get('id_code') || '';
      if (!this.eventIdCode) {
        this.eventIdCode = this.route.snapshot.queryParamMap.get('id_code') || '';
      }

      if (this.eventIdCode) {
        this.eventService.getPublicEventByIdCodeDetail(this.eventIdCode).subscribe({
          next: (res) => {
            this.eventName = res?.event?.title || res?.event?.name || '';
            this.eventBanner = res?.event?.image || res?.event?.banner_url || null;
          },
          error: () => {
            this.eventName = '';
            this.eventBanner = null;
          }
        });

        this.eventService.getEventJamId(this.eventIdCode).subscribe({
          next: (jid) => {
            this.jamId = jid;
            this.ensureStreams();
          },
          error: (err) => {
            const status = Number(err?.status || 0);
            if (status === 403 && this.eventIdCode) {
               this.router.navigate([`/events/checkin/${this.eventIdCode}`], { queryParams: { returnUrl: `/events/home-guest-v2/${this.eventIdCode}` } });
            }
          }
        });

        // Após carregar dados básicos, tenta obter selfie do convidado atual
        this.eventService.getEventGuestMe(this.eventIdCode).subscribe({
          next: (guest) => {
            const url = (guest as any)?.selfie_url || null;
            if (url) this.selfieUrl = url;
          }
        });

        this.loadJams();
        this.loadOnStageOnce();
        this.loadPlaylist();
      }

      this.startPolling();
      if (this.enableWatchdog) this.startSseWatchdog();

      // Visibility change handler
      try {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) return;
          this.scheduleRefresh();
        });
      } catch {}
    });
  }

  ngOnDestroy(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
    const ids = Object.keys(this.esMap);
    ids.forEach(id => {
      try { this.esMap[Number(id)].close(); } catch {}
      delete this.esMap[Number(id)];
    });
    if (this.sseRefreshTimer) clearTimeout(this.sseRefreshTimer);
    if (this.pollingHandle) clearInterval(this.pollingHandle);
    if (this.sseWatchdogHandle) clearInterval(this.sseWatchdogHandle);
  }

  // Logic from HomeGuestComponent

  loadJams(): void {
    if (!this.eventIdCode) return;
    this.isLoadingOpen = true;
    this.eventService.getEventOpenJamsSongs(this.eventIdCode).subscribe({
      next: (songs: ApiSong[]) => {
        this.songJamMap = {};
        songs.forEach((s: any) => {
          const sid = Number(s?.id);
          const jid = Number(s?.jam?.id ?? s?.jam_id);
          if (!Number.isNaN(sid) && !Number.isNaN(jid)) this.songJamMap[sid] = jid;
          if (!Number.isNaN(sid)) this.readyMap[sid] = (this.readyMap[sid] === true) || !!s?.ready;

          const my = s?.my_application;
          if (my) {
             const instr = String(my.instrument || '');
             const status = String(my.status || 'pending');
             this.selections[sid] = instr || null;
             this.lockDeadline[sid] = this.now;
             this.submitted[sid] = true;
             this.submitError[sid] = status === 'rejected';
             this.approvedMap[sid] = status === 'approved';
             this.myStatusMap[sid] = status;
          }
        });

        this.plannedSongs = songs.filter((s: any) => {
          const myStatus = String(s?.my_application?.status || '');
          const st = String(s?.status || '');
          const sid = Number((s as any)?.id);
          const sseReady = this.readyMap[sid] === true;
          const readyField = !!s?.ready;
          const isReady = readyField || sseReady;

          if (myStatus === 'rejected') return false;
          if (isReady) {
            if (myStatus === 'approved') return true;
            return false;
          }
          return st === 'open_for_candidates';
        });

        this.isLoadingOpen = false;
        this.ensureStreams();
      },
      error: (err) => {
        this.isLoadingOpen = false;
        const status = Number(err?.status || 0);
        if (status === 403 && this.eventIdCode) {
           this.router.navigate([`/events/checkin/${this.eventIdCode}`], { queryParams: { returnUrl: `/events/home-guest-v2/${this.eventIdCode}` } });
        }
      }
    });
  }

  private loadOnStageOnce(): void {
    if (!this.eventIdCode) return;
    this.isLoadingStage = true;
    this.eventService.getEventMyOnStage(this.eventIdCode).subscribe({
      next: (resp: OnStageResponse) => {
        const nowPlaying = resp.now_playing ? [resp.now_playing] : [];
        const upcoming = resp.my_upcoming || [];

        this.playingNowSongs = nowPlaying;
        this.goToStageSongs = upcoming;
        this.onStageSongs = [...nowPlaying, ...upcoming];
        this.isLoadingStage = false;
        this.ensureStreams();
      },
      error: (err) => {
        this.isLoadingStage = false;
        // Handle error
      }
    });
  }

  private ensureStreams(): void {
    if (!this.eventIdCode || !this.useSse) return;

    const idsFromOpen = Array.from(new Set(Object.values(this.songJamMap)));
    const idsFromStage = Array.from(new Set((this.onStageSongs || []).map(s => Number((s as any)?.jam?.id ?? (s as any)?.jam_id)).filter(n => !Number.isNaN(n))));
    const jamIds = Array.from(new Set([ ...idsFromOpen, ...idsFromStage, ...(this.jamId ? [this.jamId] : []) ]));

    for (const jid of jamIds) {
      if (!jid || this.esMap[jid]) continue;
      const es = this.eventService.streamJam(this.eventIdCode, jid);

      es.onopen = () => {
        this.sseOpenCount = Object.keys(this.esMap).length;
      };

      es.onmessage = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data || '{}');
          const type = String(data?.type || data?.event || '');
          const payload = data?.payload || {};
          this.lastEventType = type || '';
          this.lastEventAt = Date.now();
          this.lastEventAtMap[jid] = this.lastEventAt;

          if (type === 'song_ready_changed') {
            const sid = Number(payload?.song_id ?? payload?.id);
            if (!Number.isNaN(sid)) this.readyMap[sid] = !!payload?.ready;
            // Simplified logic: refresh will filter correctly
          }
          this.scheduleRefresh();
        } catch {}
      };

      this.esMap[jid] = es;
    }
  }

  private scheduleRefresh(): void {
    if (this.sseRefreshTimer) clearTimeout(this.sseRefreshTimer);
    this.sseRefreshTimer = setTimeout(() => {
      this.refreshLists();
    }, 200);
  }

  private refreshLists(): void {
    this.loadJams();
    this.loadOnStageOnce();
    this.loadPlaylist();
  }

  private startPolling(): void {
    if (this.pollingHandle) return;
    this.pollingHandle = setInterval(() => {
      if (document.hidden) return;
      this.refreshLists();
    }, 60000);
  }

  private startSseWatchdog(): void {
    if (this.sseWatchdogHandle) return;
    this.sseWatchdogHandle = setInterval(() => {
      const now = Date.now();
      const staleIds = Object.keys(this.esMap).map(Number).filter(jid => {
        const last = this.lastEventAtMap[jid] || 0;
        return !last || (now - last) > 30000;
      });
      if (staleIds.length) {
        staleIds.forEach(jid => {
          try { this.esMap[jid].close(); } catch {}
          delete this.esMap[jid];
        });
        this.ensureStreams();
      }
    }, 15000);
  }

  // Core Logic from HomeGuestComponent

  getInstrumentBuckets(song: ApiSong): any[] {
    const s: any = song as any;
    if (Array.isArray(s.instrument_buckets) && s.instrument_buckets.length > 0) {
        return s.instrument_buckets;
    }

    let buckets: any[] = [];

    if (Array.isArray(s.instrument_slots)) {
      buckets = s.instrument_slots.map((slot: any) => ({
        instrument: String(slot.instrument),
        slots: Number(slot.slots || 0),
        remaining: Number(
          slot?.remaining_slots ?? (
            Number(slot.slots || 0) - Number(slot.approved_count || 0)
          )
        )
      }));
    } else {
        const inst = Array.isArray(s.instrumentation) ? s.instrumentation : [];
        buckets = inst.map((k: any) => ({ instrument: String(k), slots: 0, remaining: 0 }));
    }

    s.instrument_buckets = buckets;
    return buckets;
  }

  isRequested(songId: number, instrument: string): boolean {
    return (this.selections[songId] || null) === instrument;
  }

  toggleRequest(song: ApiSong, bucket: any): void {
    const songId = Number((song as any).id);
    const key = String(bucket.instrument);

    const current = this.selections[songId] || null;
    this.selections[songId] = current === key ? null : key;
    this.submitted[songId] = false;
  }

  submitSelection(songId: number): void {
    const sel = this.selections[songId] || null;
    if (!sel) return;
    if (this.submitted[songId] || this.attempting[songId]) return;

    this.attempting[songId] = true;
    const jamId = this.songJamMap[songId];
    if (!jamId) return;

    this.eventService.applySongCandidate(this.eventIdCode, jamId, songId, sel).subscribe({
      next: (ok) => {
        this.submitted[songId] = !!ok;
        this.submitError[songId] = !ok;
        this.attempting[songId] = false;
        if (ok) {
          this.myStatusMap[songId] = 'pending';
          this.triggerToast('warning', 'Candidatura enviada', 'Sua candidatura foi registrada e aguarda aprovação.');
        }
        else this.triggerToast('error', 'Falha ao enviar', 'Não foi possível enviar sua candidatura.');
      },
      error: (err) => {
        const status = Number(err?.status || 0);
        if (status === 409) {
          this.submitted[songId] = true;
          this.submitError[songId] = false;
          this.myStatusMap[songId] = this.myStatusMap[songId] || 'pending';
          this.triggerToast('error', 'Já candidatado', 'Você já possui candidatura para esta música.');
        } else {
          this.submitted[songId] = false;
          this.submitError[songId] = true;
          const msg = (err?.error?.message || err?.message || 'Erro ao enviar candidatura');
          this.triggerToast('error', 'Erro', msg);
        }
        this.attempting[songId] = false;
      }
    });
  }

  get currentSong(): ApiSong | null {
    return this.playingNowSongs.length > 0 && this.playingNowSongs[0].queue_position === 1 ? this.playingNowSongs[0] : null;
  }

  get nextSong(): ApiSong | null {
    return this.goToStageSongs.length > 0 ? this.goToStageSongs[0] : null;
  }

  getDisplayIndex(song: ApiSong, section: string): number {
    if (section === 'playing_now') return 1;
    if (typeof song.queue_position === 'number') return song.queue_position;
    if (typeof song.order_index === 'number') return song.order_index + 1;
    const idx = this.goToStageSongs.indexOf(song);
    return idx >= 0 ? idx + 2 : 0;
  }

  triggerToast(variant: 'success' | 'info' | 'warning' | 'error', title: string, description?: string) {
    const compRef = createComponent(NotificationComponent, {
      environmentInjector: this.envInjector,
      elementInjector: this.injector,
    });
    compRef.setInput('variant', variant);
    compRef.setInput('title', title);
    compRef.setInput('description', description);
    compRef.setInput('hideDuration', 3000);
    this.appRef.attachView(compRef.hostView);
    const host = compRef.location.nativeElement as HTMLElement;
    host.style.position = 'fixed';
    host.style.top = '16px';
    host.style.right = '16px';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'auto';
    document.body.appendChild(host);
    setTimeout(() => {
      this.appRef.detachView(compRef.hostView);
      compRef.destroy();
    }, 3200);
  }

  // UI Helpers for Prototype

  get userQueue(): ApiSong[] {
    return this.goToStageSongs;
  }

  getInstrumentType(instrument: string): string {
    const norm = (instrument || '').toLowerCase();
    if (norm.includes('vocal') || norm.includes('voz') || norm.includes('mic')) return 'vocal';
    if (norm.includes('teclado') || norm.includes('piano') || norm.includes('keys')) return 'keys';
    if (norm.includes('bateria') || norm.includes('drums')) return 'drums';
    if (norm.includes('baixo') || norm.includes('bass')) return 'bass';
    if (norm.includes('guitarra')) return 'electric-guitar';
    if (norm.includes('violão') || norm.includes('acoustic')) return 'acoustic-guitar';
    if (norm.includes('metais') || norm.includes('horns') || norm.includes('trumpet')) return 'horns';
    if (norm.includes('percussão') || norm.includes('conga') || norm.includes('pandeiro')) return 'percussion';
    return 'other';
  }

  onImageError(event: any) {
    event.target.src = `https://ui-avatars.com/api/?name=${this.currentUser?.name || 'Guest'}&background=random`;
  }

  get selectedSong(): any | null {
    const i = this.selectedPlaylistIndex;
    return Array.isArray(this.playlistSongs) && i >= 0 && i < this.playlistSongs.length ? this.playlistSongs[i] : null;
  }

  get selectedNextSong(): any | null {
    const i = this.selectedPlaylistIndex + 1;
    return Array.isArray(this.playlistSongs) && i >= 0 && i < this.playlistSongs.length ? this.playlistSongs[i] : null;
  }

  prevPlaylistItem(): void {
    if (!Array.isArray(this.playlistSongs) || this.playlistSongs.length === 0) return;
    this.selectedPlaylistIndex = Math.max(0, this.selectedPlaylistIndex - 1);
    this.triggerFooterAnimation();
  }

  nextPlaylistItem(): void {
    if (!Array.isArray(this.playlistSongs) || this.playlistSongs.length === 0) return;
    this.selectedPlaylistIndex = Math.min(this.playlistSongs.length - 1, this.selectedPlaylistIndex + 1);
    this.triggerFooterAnimation();
  }

  setPlaylistIndex(idx: number): void {
    if (!Array.isArray(this.playlistSongs) || this.playlistSongs.length === 0) return;
    const i = Math.max(0, Math.min(this.playlistSongs.length - 1, Number(idx) || 0));
    this.selectedPlaylistIndex = i;
    this.triggerFooterAnimation();
  }

  loadPlaylist(): void {
    if (!this.eventIdCode) return;
    this.eventService.getEventPlaylist(this.eventIdCode).subscribe({
      next: (data) => {
        this.playlistSongs = Array.isArray(data) ? data : [];
        let idx = this.playlistSongs.findIndex((s: any) => String(s?.status || '') === 'on_stage');
        if (idx < 0) idx = 0;
        this.selectedPlaylistIndex = idx;
        this.triggerFooterAnimation();
      },
      error: (err) => {
        console.error('Error loading playlist', err);
      }
    });
  }

  private triggerFooterAnimation(): void {
    this.animateFooter = false;
    setTimeout(() => {
      this.animateFooter = true;
    }, 0);
  }

  handleSelectSlot(songId: number, slotIdx: number) {
    this.selectedDraftSlots[songId] = slotIdx;
  }
}
