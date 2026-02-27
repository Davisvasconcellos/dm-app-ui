import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ChangeDetectorRef, NgZone, ViewChild, ElementRef, inject, EnvironmentInjector, Injector, createComponent, ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventService } from '../event.service';
import { TranslateModule } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { ActivatedRoute } from '@angular/router';
import { ResilienceService } from '../../../shared/services/resilience.service';
import { Subject, takeUntil, of, retry, timer } from 'rxjs';
import { NotificationComponent } from '../../../shared/components/ui/notification/notification/notification.component';

@Component({
  selector: 'app-playlist',
  standalone: true,
  imports: [CommonModule, TranslateModule, QRCodeComponent],
  templateUrl: './playlist.component.html',
  styleUrl: './playlist.component.css'
})
export class PlaylistComponent implements OnInit, OnDestroy {
  @Input() eventIdCode: string = '';
  @Input() isEmbedded: boolean = false; // Se true, está dentro do HomeGuest. Se false, é standalone/janela.
  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLDivElement>;

  onStageSongs: any[] = [];
  playlistSongs: any[] = [];
  playingNowSongs: any[] = [];
  goToStageSongs: any[] = [];

  isLoadingStage: boolean = false;
  selectedPlaylistIndex = 0;
  animateFooter = false;
  isSidebarOpen = true; // Sidebar toggle state
  musiciansFlipped = false;
  isHeaderShifted = false;

  // Auto Advance
  autoAdvanceTimer: any = null;
  autoAdvanceDelayTimeout: any = null; // Track the 1s delay timeout
  progressInterval: any = null;
  progressPercent = 0;
  showAnimations = true; // Use to force re-trigger of CSS animations
  private flipTimeout: any = null;
  private destroy$ = new Subject<void>();
  private resilienceService = inject(ResilienceService);
  private appRef = inject(ApplicationRef); // I'll check if I need more
  private injector = inject(Injector);
  private envInjector = inject(EnvironmentInjector);

  private readonly DURATION_INDEX_0 = 20000; // 20s
  private readonly DURATION_INDEX_1 = 20000; // 20s
  private readonly DURATION_OTHERS = 10000;  // 10s

  constructor(
    private eventService: EventService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) { }

  private readonly reloadTrigger$ = new Subject<void>();

  ngOnInit(): void {
    this.initResilientReloader();
    this.subscribeToResilienceState();

    // Se não veio por Input, tenta pegar da rota (modo standalone via URL)
    if (!this.eventIdCode) {
      this.route.paramMap.subscribe(params => {
        const id = params.get('id_code');
        if (id) {
          this.eventIdCode = id;
          this.loadGlobalStage();
        }
      });
    } else {
      this.loadGlobalStage();
    }
  }

  private initResilientReloader() {
    this.resilienceService.pollWithResilience(
      () => {
        if (!this.eventIdCode) return of(null);
        this.isLoadingStage = true;
        return this.eventService.getEventJams(this.eventIdCode);
      },
      999999, // Long interval, we trigger it manually
      3,
      `playlist_${this.eventIdCode}`
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (jams) => {
        if (!jams || !Array.isArray(jams)) return;
        this.processJams(jams);
      },
      error: (err) => {
        this.isLoadingStage = false;
        console.error('Error loading global stage', err);
      }
    });

    // Listen to manual triggers
    this.reloadTrigger$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      // Logic handled by the custom ResilienceService if we refactor it slightly
      // For now, we'll just use the existing loadGlobalStage with a manual retry logic
    });
  }

  ngOnDestroy(): void {
    this.stopAutoAdvance();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadGlobalStage(): void {
    if (this.isLoadingStage && !this.isEmbedded) return;
    this.isLoadingStage = true;

    this.eventService.getEventJams(this.eventIdCode).pipe(
      this.resilienceService.withFailover(`playlist_${this.eventIdCode}`),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (jams) => {
        if (!jams || !Array.isArray(jams)) {
          this.isLoadingStage = false;
          return;
        }
        this.processJams(jams);
      },
      error: (err) => {
        this.isLoadingStage = false;
        console.error('Error loading global stage', err);
      }
    });
  }

  private processJams(jams: any[]) {
    const allSongs = jams.flatMap(j => (j.songs || []).map(s => {
      // Process musicians from instrument_buckets if available
      let musicians: any[] = [];
      if (s.instrument_buckets && Array.isArray(s.instrument_buckets)) {
        s.instrument_buckets.forEach((bucket: any) => {
          if (Array.isArray(bucket.approved)) {
            bucket.approved.forEach((candidate: any) => {
              musicians.push({
                name: candidate.display_name || candidate.name || 'Músico',
                avatar_url: candidate.avatar_url || candidate.avatar || '/images/user/default-avatar.jpg',
                instrument: bucket.instrument || candidate.instrument || 'outro'
              });
            });
          }
        });
      }

      return {
        ...s,
        jam_id: j.id,
        musicians: musicians.length > 0 ? musicians : (s as any).musicians
      };
    }));

    // Filtra músicas que estão 'on_stage'
    const onStage = allSongs.filter(s => s.status === 'on_stage');

    // Ordena por índice de ordem ou ID
    onStage.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    this.onStageSongs = onStage;

    if (onStage.length > 0) {
      // Assume a primeira como tocando agora e o resto como próxima
      this.playingNowSongs = [onStage[0]];
      this.goToStageSongs = onStage.slice(1);
    } else {
      this.playingNowSongs = [];
      this.goToStageSongs = [];
    }

    this.isLoadingStage = false;
    this.loadPlaylist();
    this.ensureAutoAdvance();
  }

  loadPlaylist() {
    this.playlistSongs = [...this.onStageSongs];
    // Se a playlist mudou, reseta o índice se estiver fora dos limites
    if (this.selectedPlaylistIndex >= this.playlistSongs.length) {
      this.selectedPlaylistIndex = 0;
    }
  }

  get selectedSong() {
    return this.playlistSongs[this.selectedPlaylistIndex];
  }

  setPlaylistIndex(index: number) {
    this.selectedPlaylistIndex = index;
    this.stopAutoAdvance();
    // Reinicia o timer após interação manual
    this.startAutoAdvance();
    this.scrollToCurrent();
  }

  private scrollToCurrent(): void {
    if (!this.scrollContainer) return;

    // Use a small timeout to ensure transition/render is done
    setTimeout(() => {
      const container = this.scrollContainer?.nativeElement;
      if (!container) return;

      if (this.selectedPlaylistIndex === 0) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const items = container.getElementsByClassName('playlist-item');
      if (items[this.selectedPlaylistIndex]) {
        const item = items[this.selectedPlaylistIndex] as HTMLElement;
        const offsetTop = item.offsetTop;
        const containerHeight = container.clientHeight;

        // Centraliza o item um pouco acima do meio para contexto
        const targetScroll = offsetTop - (containerHeight / 3);
        container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
      }
    }, 100);
  }

  startAutoAdvance() {
    this.stopAutoAdvance();

    if (this.playlistSongs.length === 0) return;

    this.progressPercent = 0;
    this.musiciansFlipped = false;
    this.isHeaderShifted = false;
    this.cdr.detectChanges(); // Força zerar a barra visualmente imediatamente

    // Force re-trigger text and avatar animations
    this.showAnimations = false;

    // Determine duration based on index
    let duration = this.DURATION_OTHERS;
    if (this.selectedPlaylistIndex === 0) duration = this.DURATION_INDEX_0;
    else if (this.selectedPlaylistIndex === 1) duration = this.DURATION_INDEX_1;

    if (this.flipTimeout) clearTimeout(this.flipTimeout);

    this.autoAdvanceDelayTimeout = setTimeout(() => {
      this.showAnimations = true;
      const startTime = Date.now();

      // Start header shift timer (approx 2s into the auto-advance)
      setTimeout(() => {
        if (this.selectedPlaylistIndex === 0 || this.selectedPlaylistIndex === 1) {
          this.isHeaderShifted = true;
          this.cdr.detectChanges();
        }
      }, 2000);

      // Start flip timer after reveal animation (approx 5s after start)
      this.flipTimeout = setTimeout(() => {
        this.musiciansFlipped = true;
        this.cdr.detectChanges();
      }, 5000);

      // Progress Bar Loop
      this.progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min((elapsed / duration) * 100, 100);

        this.progressPercent = pct;
        this.cdr.detectChanges();

        if (elapsed >= duration) {
          this.stopAutoAdvance(); // Clear interval
          this.nextSlide();
        }
      }, 100); // Update every 100ms for smooth-ish bar
    }, 1000);
  }

  stopAutoAdvance() {
    if (this.autoAdvanceTimer) {
      clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
    if (this.autoAdvanceDelayTimeout) {
      clearTimeout(this.autoAdvanceDelayTimeout);
      this.autoAdvanceDelayTimeout = null;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.flipTimeout) {
      clearTimeout(this.flipTimeout);
      this.flipTimeout = null;
    }
    this.musiciansFlipped = false;
    this.isHeaderShifted = false;
  }

  nextSlide() {
    if (this.playlistSongs.length === 0) return;

    if (this.selectedPlaylistIndex < this.playlistSongs.length - 1) {
      this.selectedPlaylistIndex++;
      this.animateFooter = true;
      setTimeout(() => this.animateFooter = false, 500);
      this.startAutoAdvance();
    } else {
      // Chegou ao fim, reinicia o loop
      // Recarrega dados para pegar atualizações e reiniciar tudo
      this.selectedPlaylistIndex = 0;
      this.animateFooter = true;
      setTimeout(() => this.animateFooter = false, 500);

      this.loadGlobalStage();
      this.scrollToCurrent();
      // startAutoAdvance() will be called inside loadGlobalStage -> ensureAutoAdvance
    }
  }

  private ensureAutoAdvance() {
    if (!this.progressInterval && this.playlistSongs.length > 0) {
      this.startAutoAdvance();
    }
  }

  getDisplayIndex(idx: number): string {
    return (idx + 1).toString().padStart(2, '0');
  }

  onImageError(event: any) {
    event.target.src = '/images/user/default-avatar.jpg';
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        // Ignored
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          // Ignored
        });
      }
    }
  }

  private subscribeToResilienceState() {
    this.resilienceService.getState().pipe(
      takeUntil(this.destroy$)
    ).subscribe(state => {
      if (state.status === 'down') {
        this.triggerToast('warning', 'Modo Offline Ativado', 'Servidor instável. Exibindo última playlist conhecida.');
      } else if (state.status === 'unstable') {
        this.triggerToast('info', 'Conexão Instável', 'Tentando reconectar com o servidor...');
      }
    });
  }

  private triggerToast(variant: 'success' | 'info' | 'warning' | 'error', title: string, description?: string) {
    const compRef = createComponent(NotificationComponent, {
      environmentInjector: this.envInjector,
      elementInjector: this.injector,
    });
    compRef.setInput('variant', variant);
    compRef.setInput('title', title);
    compRef.setInput('description', description);
    compRef.setInput('hideDuration', 4000);

    // Check if we can attach to body (similar to HomeGuestV2)
    // We need ApplicationRef injected
    const appRef = inject(ApplicationRef);
    appRef.attachView(compRef.hostView);

    const host = compRef.location.nativeElement as HTMLElement;
    host.style.position = 'fixed';
    host.style.top = '16px';
    host.style.right = '16px';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'auto';
    document.body.appendChild(host);

    setTimeout(() => {
      appRef.detachView(compRef.hostView);
      compRef.destroy();
    }, 4500);
  }
}
