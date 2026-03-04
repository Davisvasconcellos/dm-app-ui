import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ApplicationRef, Injector, EnvironmentInjector, createComponent, inject } from '@angular/core';
import { trigger, state, style, transition, animate, stagger, query } from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EventService, ApiJam, ApiSong, OnStageResponse } from '../event.service';
import { AuthService, User } from '../../../shared/services/auth.service';
import { NotificationComponent } from '../../../shared/components/ui/notification/notification/notification.component';
import { MusicSuggestionService, MusicSuggestion, Participant } from '../music-suggestion/music-suggestion.service';
import { ToastService } from '../../../shared/services/toast.service';
import { MusicSuggestionsListComponent } from '../music-suggestions-list/music-suggestions-list.component';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { PlaylistComponent } from '../playlist/playlist.component';

@Component({
  selector: 'app-home-guest-v2',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MusicSuggestionsListComponent, ModalComponent, PlaylistComponent],
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

  // Invites
  invitesForMe: MusicSuggestion[] = [];
  isProcessingInvite: Record<string, boolean> = {};
  rejectModalOpen = false;
  inviteToReject: MusicSuggestion | null = null;
  recentlyAcceptedInvites: string[] = [];
  recentlyRejectedInvites: string[] = [];

  // Maps and state tracking
  selections: Record<string | number, string | null> = {};
  lockDeadline: Record<string | number, number> = {};
  submitted: Record<string | number, boolean> = {};
  submitError: Record<string | number, boolean> = {};
  approvedMap: Record<string | number, boolean> = {};
  myStatusMap: Record<string | number, string> = {};
  attempting: Record<string | number, boolean> = {};
  now: number = Date.now();
  tickHandle: any;
  songJamMap: Record<string | number, number> = {};
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

  isLoadingOpen = false;
  isLoadingStage = false;
  showLog = false;
  readyMap: Record<string | number, boolean> = {};
  decisionsLog: Array<{ songId: number; tipo: string; acao: string; at: number }> = [];
  uiLog: Array<{ msg: string; at: number }> = [];

  // For prototype UI
  selectedDraftSlots: Record<number, number> = {};
  playlistSongs: any[] = [];
  selectedPlaylistIndex = 0;
  animateFooter = false;

  // View State
  viewMode: 'playlist' | 'dashboard' | 'suggestions' = 'dashboard'; // Start with dashboard as it is fully implemented
  isSidebarOpen = false;
  isProfileMenuOpen = false;
  currentLang = 'pt-br';
  languages: { code: 'pt-br' | 'en' | string; label: string; flag: string }[] = [
    { code: 'pt-br', label: 'Português (Brasil)', flag: 'https://flagcdn.com/w40/br.png' },
    { code: 'en', label: 'English (US)', flag: 'https://flagcdn.com/w40/us.png' }
  ];
  currentUser: User | null = null;
  selfieUrl: string | null = null;
  isStandalone = false;
  isFullscreen = false;

  // Auto-advance for Standalone Mode
  autoAdvanceProgress = 0;
  autoAdvanceTimer: any;

  // Auto-advance Configuration
  readonly FIRST_SLIDE_DURATION = 20000; // 20 seconds for the first slide
  readonly DEFAULT_SLIDE_DURATION = 10000; // 10 seconds for others
  readonly TIMER_INTERVAL = 100; // 100ms check

  private translate = inject(TranslateService);
  private eventService = inject(EventService);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private router = inject(Router);
  private appRef = inject(ApplicationRef);
  private injector = inject(Injector);
  private envInjector = inject(EnvironmentInjector);
  private musicSuggestionService = inject(MusicSuggestionService);
  private toast = inject(ToastService);

  constructor() {
    this.useSse = false;
    this.currentLang = localStorage.getItem('lang') || 'pt-br';
    this.translate.use(this.currentLang);
  }

  getFirstName(fullName: string | undefined | null): string {
    if (!fullName) return '';
    return fullName.split(' ')[0];
  }

  get currentFlag(): string {
    return this.languages.find(l => l.code === this.currentLang)?.flag ?? 'https://flagcdn.com/w40/br.png';
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    this.route.paramMap.subscribe(pm => {
      this.eventIdCode = pm.get('id_code') || '';
      if (!this.eventIdCode) {
        this.eventIdCode = this.route.snapshot.queryParamMap.get('id_code') || '';
      }
      const qp = this.route.snapshot.queryParamMap;
      const viewParam = qp.get('view') || '';
      const standaloneParam = qp.get('standalone') || '';
      this.isStandalone = standaloneParam === '1' || standaloneParam === 'true';
      if (this.isStandalone || viewParam === 'playlist') this.viewMode = 'playlist';
      if (this.isStandalone) this.startAutoAdvance();

      try {
        document.addEventListener('fullscreenchange', () => {
          this.isFullscreen = !!document.fullscreenElement;
        });
      } catch {}

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
        this.loadInvites();
      }

      this.startPolling();
      if (this.enableWatchdog) this.startSseWatchdog();

      // Visibility change handler
      try {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) return;
          this.scheduleRefresh();
        });
      } catch (e) {
        console.error('Visibility listener error', e);
      }
    });
  }

  loadInvites() {
    this.musicSuggestionService.loadSuggestions(this.eventIdCode).subscribe();
    this.musicSuggestionService.suggestions$.subscribe(suggestions => {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) return;
      const userId = currentUser.id.toString();

      // Filter invites where current user is a participant with PENDING status
      // AND they are NOT the creator of the suggestion
      // Double check to ensure creator never sees their own invite
      this.invitesForMe = suggestions.filter(s =>
          String(s.created_by_user_id) !== userId &&
          s.participants.some(p => String(p.user_id) === userId && p.status === 'PENDING')
      );
    });
  }

  ngOnDestroy(): void {
    this.stopAutoAdvance();
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

  toggleProfileMenu() {
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  changeLanguage(lang: string) {
    this.currentLang = lang;
    localStorage.setItem('lang', lang);
    this.translate.use(lang);
    this.isProfileMenuOpen = false;
  }

  // Logic from HomeGuestComponent

  loadJams(): void {
    if (!this.eventIdCode) return;
    this.isLoadingOpen = true;
    this.eventService.getEventOpenJamsSongs(this.eventIdCode).subscribe({
      next: (songs: ApiSong[]) => {
        this.songJamMap = {};
        songs.forEach((s: any) => {
          const sid = s?.id;
          const jid = Number(s?.jam?.id ?? s?.jam_id);
          if (sid && !Number.isNaN(jid)) this.songJamMap[sid] = jid;
          if (sid) this.readyMap[sid] = (this.readyMap[sid] === true) || !!s?.ready;

          const my = s?.my_application;
          if (my && sid) {
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
          const sid = (s as any)?.id;
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
          try { this.esMap[jid].close(); } catch (e) { console.error('SSE watchdog close error', e); }
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

    // Check for new 'slots' structure
    if (Array.isArray(s.slots) && s.slots.length > 0) {
      buckets = s.slots.map((slot: any) => ({
        instrument: String(slot.instrument),
        slots: Number(slot.total || slot.slots || 0),
        remaining: Number(slot.remaining ?? 0),
        taken: Number(slot.taken ?? 0),
        fallback_allowed: !!slot.fallback_allowed
      }));
    } else if (Array.isArray(s.instrument_slots)) {
      buckets = s.instrument_slots.map((slot: any) => ({
        instrument: String(slot.instrument),
        slots: Number(slot.slots || 0),
        remaining: Number(
          slot?.remaining_slots ?? (
            Number(slot.slots || 0) - Number(slot.approved_count || 0)
          )
        ),
        fallback_allowed: !!slot.fallback_allowed
      }));
    } else {
        const inst = Array.isArray(s.instrumentation) ? s.instrumentation : [];
        buckets = inst.map((k: any) => ({ instrument: String(k), slots: 0, remaining: 0 }));
    }

    s.instrument_buckets = buckets;
    return buckets;
  }

  isRequested(songId: number | string, instrument: string): boolean {
    return (this.selections[songId] || null) === instrument;
  }

  toggleRequest(song: ApiSong, bucket: any): void {
    const songId = (song as any).id;
    const key = String(bucket.instrument);

    // Logging para debug
    console.log('[HomeGuestV2] toggleRequest', { songId, key, bucket });

    // Se não tem vagas e não permite fallback, impedir seleção
    // Mas se eu JÁ selecionei (desmarcar), devo permitir
    const current = this.selections[songId] || null;
    const isSelecting = current !== key;

    /* REMOVIDO TEMPORARIAMENTE PARA DEBUG - Deixar o backend validar
    if (isSelecting) {
      if (bucket.remaining <= 0 && !bucket.fallback_allowed) {
        console.warn('[HomeGuestV2] Seleção bloqueada: sem vagas e fallback não permitido');
        return;
      }
    }
    */

    this.selections[songId] = isSelecting ? key : null;
    this.submitted[songId] = false;
  }

  submitSelection(songId: number | string): void {
    const sel = this.selections[songId] || null;
    if (!sel) return;
    if (this.submitted[songId] || this.attempting[songId]) return;

    this.attempting[songId] = true;
    const jamId = this.songJamMap[songId];

    console.log('[HomeGuestV2] submitSelection', { songId, sel, jamId });

    if (!jamId) {
      console.error('[HomeGuestV2] ERRO: Jam ID não encontrado para a música', songId);
      this.toast.triggerToast('error', 'Erro interno', 'Jam ID não encontrado');
      this.attempting[songId] = false;
      return;
    }

    this.eventService.applySongCandidate(this.eventIdCode, jamId, songId, sel).subscribe({
      next: (ok) => {
        console.log('[HomeGuestV2] applySongCandidate success', ok);
        this.submitted[songId] = !!ok;
        this.submitError[songId] = !ok;
        this.attempting[songId] = false;
        if (ok) {
           this.myStatusMap[songId] = 'pending';
           this.toast.triggerToast('success', 'Sucesso', 'Inscrição realizada com sucesso!');
           // this.refreshLists(); // Optional
        } else {
           this.toast.triggerToast('error', 'Erro', 'Erro ao realizar inscrição.');
        }
      },
      error: (err) => {
        console.error('[HomeGuestV2] applySongCandidate error', err);
        this.submitted[songId] = false;
        this.submitError[songId] = true;
        this.attempting[songId] = false;
        this.toast.triggerToast('error', 'Erro de Conexão', 'Erro ao se conectar com o servidor.');
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
    const norm = (instrument || '').toLowerCase().trim();

    // 1. Voz
    if (norm.includes('voz') || norm.includes('vocal') || norm.includes('cantor') || norm.includes('mic')) return 'voz';

    // 2. Guitarra
    if (norm.includes('guitarra') || norm.includes('guitar') || norm.includes('violão') || norm.includes('acoustic')) return 'guitarra';

    // 3. Baixo
    if (norm.includes('baixo') || norm.includes('bass')) return 'baixo';

    // 4. Teclado
    if (norm.includes('teclado') || norm.includes('piano') || norm.includes('key') || norm.includes('synth') || norm.includes('orgão')) return 'teclado';

    // 5. Bateria
    if (norm.includes('bateria') || norm.includes('drum') || norm.includes('batera')) return 'bateria';

    // 6. Metais
    if (norm.includes('metais') || norm.includes('horn') || norm.includes('sax') || norm.includes('trompete') || norm.includes('trombone') || norm.includes('flauta') || norm.includes('wind')) return 'metais';

    // 7. Percussão
    if (norm.includes('percussão') || norm.includes('percussao') || norm.includes('percussion') || norm.includes('conga') || norm.includes('cajon') || norm.includes('pandeiro')) return 'percussao';

    // 8. Cordas
    if (norm.includes('cordas') || norm.includes('string') || norm.includes('violino') || norm.includes('cello') || norm.includes('viola')) return 'cordas';

    // 9. Outro (Default)
    return 'outro';
  }

  onImageError(event: any) {
    event.target.src = '/images/user/default-avatar.jpg';
  }

  loadPlaylist() {
      // Mock or fetch playlist
      // Implementation pending or handled by app-playlist component
  }

  startAutoAdvance() {
      // Logic for standalone auto advance
      // Implementation pending
  }

  stopAutoAdvance() {
      // Logic for standalone stop
      // Implementation pending
  }

  get selectedSong() {
    return this.playlistSongs[this.selectedPlaylistIndex] || null;
  }

  get prevPlaylistItem() {
    return this.selectedPlaylistIndex > 0 ? this.playlistSongs[this.selectedPlaylistIndex - 1] : null;
  }

  get nextPlaylistItem() {
    return this.selectedPlaylistIndex < this.playlistSongs.length - 1 ? this.playlistSongs[this.selectedPlaylistIndex + 1] : null;
  }

  get selectedNextSong() {
    return this.nextPlaylistItem;
  }

  setPlaylistIndex(idx: number) {
    this.selectedPlaylistIndex = idx;
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => { console.error('Request fullscreen error', e); });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((e) => { console.error('Exit fullscreen error', e); });
      }
    }
  }

  getInviter(suggestion: MusicSuggestion): { name: string; avatar_url?: string; avatar?: string } | undefined {
    if (suggestion.creator) {
      return suggestion.creator;
    }
    return suggestion.participants.find(p => p.is_creator);
  }

  getMyInviteInstrument(suggestion: MusicSuggestion): string {
    if (!this.currentUser) return 'outro';
    const me = suggestion.participants.find(p =>
      (p.user_id_code || String(p.user_id)) === String(this.currentUser?.id_code) ||
      (p.user_id_code || String(p.user_id)) === String(this.currentUser?.id)
    );
    return me?.instrument || 'outro';
  }

  isAccepted(invite: MusicSuggestion): boolean {
    if (this.recentlyAcceptedInvites.includes(invite.id)) return true;
    if (!this.currentUser) return false;
    const me = invite.participants.find(p =>
      (p.user_id_code || String(p.user_id)) === String(this.currentUser?.id_code) ||
      (p.user_id_code || String(p.user_id)) === String(this.currentUser?.id)
    );
    return me?.status === 'ACCEPTED';
  }

  acceptInvite(suggestion: MusicSuggestion) {
    if (!this.currentUser) return;
    this.isProcessingInvite[suggestion.id] = true;

    this.musicSuggestionService.acceptInvite(suggestion.id, String(this.currentUser.id)).subscribe({
      next: () => {
        this.recentlyAcceptedInvites.push(suggestion.id);
        this.toast.triggerToast('success', 'Convite aceito!', 'Você agora está participando desta sugestão.');
        delete this.isProcessingInvite[suggestion.id];
      },
      error: (err) => {
        console.error(err);
        this.toast.triggerToast('error', 'Erro ao aceitar convite', 'Tente novamente.');
        delete this.isProcessingInvite[suggestion.id];
      }
    });
  }

  openRejectModal(suggestion: MusicSuggestion) {
    this.inviteToReject = suggestion;
    this.rejectModalOpen = true;
  }

  closeRejectModal() {
    this.rejectModalOpen = false;
    this.inviteToReject = null;
  }

  confirmReject() {
    if (this.inviteToReject) {
      this.rejectInvite(this.inviteToReject);
      this.closeRejectModal();
    }
  }

  rejectInvite(suggestion: MusicSuggestion) {
    if (!this.currentUser) return;
    this.isProcessingInvite[suggestion.id] = true;

    this.musicSuggestionService.rejectInvite(suggestion.id, String(this.currentUser.id)).subscribe({
      next: () => {
        this.recentlyRejectedInvites.push(suggestion.id);
        this.invitesForMe = this.invitesForMe.filter(i => i.id !== suggestion.id);
        this.toast.triggerToast('info', 'Convite recusado', 'Você recusou participar desta sugestão.');
        delete this.isProcessingInvite[suggestion.id];
      },
      error: (err) => {
        console.error(err);
        this.toast.triggerToast('error', 'Erro ao recusar convite', 'Tente novamente.');
        delete this.isProcessingInvite[suggestion.id];
      }
    });
  }
}
