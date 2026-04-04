import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { EventService } from '../event.service';
import { ThemeService } from '../../../shared/services/theme.service';

@Component({
  selector: 'app-prompter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prompter.component.html'
})
export class PrompterComponent implements OnInit, OnDestroy {
  private eventService = inject(EventService);
  private route = inject(ActivatedRoute);
  private themeService = inject(ThemeService);
  private hostEl = inject(ElementRef<HTMLElement>);
  private destroy$ = new Subject<void>();
  private themeSub: Subscription | null = null;

  eventIdCode = '';
  currentTheme: 'light' | 'dark' = (localStorage.getItem('theme') as any) === 'dark' ? 'dark' : 'light';

  isSidebarOpen = true;
  isLoading = false;
  errorMessage = '';

  playlistSongs: any[] = [];
  selectedPlaylistIndex = 0;

  lyricsText = '';
  isLyricsLoading = false;
  lyricsErrorMessage = '';
  private lyricsCache = new Map<string, string>();

  @ViewChild('lyricsScroll') lyricsScroll?: ElementRef<HTMLDivElement>;
  fontSizePx = 18;
  scrollSpeed = 0;
  private readonly maxScrollSpeed = 10;
  private readonly minFontSizePx = 12;
  private readonly maxFontSizePx = 48;
  private readonly linesPerSecondPerStep = 0.5;
  private isUserPaused = false;
  private resumeTimeoutId: any = null;
  private rafId: number | null = null;
  private lastFrameTs = 0;
  private lastAutoScrollAt = 0;
  private scrollCarryPx = 0;
  canFullscreen = false;
  isFullscreen = false;
  private fullscreenListener: (() => void) | null = null;
  private getLineHeightPx(): number {
    const el = this.lyricsScroll?.nativeElement;
    if (!el) return this.fontSizePx * 1.4;
    const pre = el.querySelector('pre') as HTMLElement | null;
    const styleTarget = pre || el;
    const lh = getComputedStyle(styleTarget).lineHeight;
    const asNumber = Number(String(lh).replace('px', ''));
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
    return this.fontSizePx * 1.4;
  }

  ngOnInit(): void {
    this.themeSub = this.themeService.theme$.subscribe((t) => {
      this.currentTheme = t;
    });

    this.initFullscreen();

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id_code');
      if (!id) return;
      this.eventIdCode = id;
      this.loadJams();
    });

    this.startAutoScroll();
  }

  ngOnDestroy(): void {
    if (this.themeSub) this.themeSub.unsubscribe();
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.resumeTimeoutId) clearTimeout(this.resumeTimeoutId);
    if (this.fullscreenListener) {
      try {
        document.removeEventListener('fullscreenchange', this.fullscreenListener);
      } catch { }
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleFullscreen(): void {
    if (!this.canFullscreen) return;
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
        return;
      }
      const target = this.hostEl?.nativeElement;
      if (target?.requestFullscreen) {
        target.requestFullscreen();
        return;
      }
      if (document.documentElement?.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } catch { }
  }

  setPlaylistIndex(index: number): void {
    this.selectedPlaylistIndex = index;
    this.loadLyricsForSelected();
  }

  get selectedSong(): any {
    return this.playlistSongs[this.selectedPlaylistIndex];
  }

  increaseFont(): void {
    this.fontSizePx = Math.min(this.maxFontSizePx, this.fontSizePx + 2);
  }

  decreaseFont(): void {
    this.fontSizePx = Math.max(this.minFontSizePx, this.fontSizePx - 2);
  }

  setScrollSpeed(value: number | string): void {
    const n = Math.max(0, Math.min(this.maxScrollSpeed, Number(value) || 0));
    this.scrollSpeed = Math.round(n);
  }

  onUserScroll(): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastAutoScrollAt < 120) return;
    this.isUserPaused = true;
    if (this.resumeTimeoutId) clearTimeout(this.resumeTimeoutId);
    this.resumeTimeoutId = setTimeout(() => {
      this.isUserPaused = false;
    }, 2000);
  }

  private loadJams(): void {
    if (!this.eventIdCode) return;
    this.isLoading = true;
    this.errorMessage = '';

    this.eventService.getEventJams(this.eventIdCode).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (jams) => {
        const allSongs = (jams || []).flatMap((j: any) => (j.songs || []).map((s: any) => ({ ...s, jam_id: j.id })));
        const onStage = allSongs.filter((s: any) => s.status === 'on_stage');
        onStage.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
        this.playlistSongs = onStage;
        if (this.selectedPlaylistIndex >= this.playlistSongs.length) this.selectedPlaylistIndex = 0;
        this.isLoading = false;
        this.loadLyricsForSelected();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || err?.message || 'Falha ao carregar jams.';
      }
    });
  }

  private loadLyricsForSelected(): void {
    this.lyricsErrorMessage = '';
    this.lyricsText = '';
    this.scrollToTop();

    const song = this.selectedSong;
    if (!song) return;
    const catalogId = String(song.catalog_id ?? '').trim().replace(/`/g, '');
    if (!catalogId) {
      this.lyricsErrorMessage = 'Sem catálogo para esta música.';
      return;
    }

    if (this.lyricsCache.has(catalogId)) {
      this.lyricsText = this.lyricsCache.get(catalogId) || '';
      this.scrollToTop();
      return;
    }

    this.isLyricsLoading = true;
    this.eventService.getJamCatalogItem(this.eventIdCode, catalogId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data: any) => {
        const text = String(data?.lyrics ?? '');
        this.lyricsCache.set(catalogId, text);
        this.lyricsText = text;
        this.isLyricsLoading = false;
        this.scrollToTop();
      },
      error: (err) => {
        this.isLyricsLoading = false;
        this.lyricsErrorMessage = err?.error?.message || err?.message || 'Falha ao carregar letra.';
      }
    });
  }

  private scrollToTop(): void {
    const el = this.lyricsScroll?.nativeElement;
    if (!el) return;
    el.scrollTop = 0;
    this.lastAutoScrollAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.scrollCarryPx = 0;
  }

  private startAutoScroll(): void {
    if (this.rafId !== null) return;
    const loop = (ts: number) => {
      if (!this.lastFrameTs) this.lastFrameTs = ts;
      const dt = Math.min(64, ts - this.lastFrameTs);
      this.lastFrameTs = ts;

      const el = this.lyricsScroll?.nativeElement;
      if (el && this.shouldAutoScroll(el)) {
        const lineHeightPx = this.getLineHeightPx();
        const linesPerSecond = this.scrollSpeed * this.linesPerSecondPerStep;
        const pxPerSecond = linesPerSecond * lineHeightPx;
        const deltaPx = pxPerSecond * (dt / 1000);
        this.scrollCarryPx += deltaPx;
        const applyPx = Math.trunc(this.scrollCarryPx);
        if (!applyPx) {
          this.rafId = requestAnimationFrame(loop);
          return;
        }
        this.scrollCarryPx -= applyPx;
        const next = el.scrollTop + applyPx;
        const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
        el.scrollTop = Math.min(maxTop, next);
        this.lastAutoScrollAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      } else if (this.scrollSpeed <= 0 || this.isUserPaused) {
        this.scrollCarryPx = 0;
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private shouldAutoScroll(el: HTMLDivElement): boolean {
    if (this.scrollSpeed <= 0) return false;
    if (this.isUserPaused) return false;
    if (this.isLoading || this.isLyricsLoading) return false;
    if (!this.lyricsText) return false;
    return el.scrollHeight > el.clientHeight + 2;
  }

  private initFullscreen(): void {
    try {
      this.canFullscreen = !!(document as any).fullscreenEnabled;
      this.isFullscreen = !!document.fullscreenElement;
      this.fullscreenListener = () => {
        this.isFullscreen = !!document.fullscreenElement;
      };
      document.addEventListener('fullscreenchange', this.fullscreenListener);
    } catch {
      this.canFullscreen = false;
      this.isFullscreen = false;
    }
  }
}
