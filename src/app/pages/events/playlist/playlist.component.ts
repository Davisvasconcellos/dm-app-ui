import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventService } from '../event.service';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-playlist',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './playlist.component.html',
  styleUrl: './playlist.component.css'
})
export class PlaylistComponent implements OnInit, OnDestroy {
  @Input() eventIdCode: string = '';
  @Input() isEmbedded: boolean = false; // Se true, está dentro do HomeGuest. Se false, é standalone/janela.

  onStageSongs: any[] = [];
  playlistSongs: any[] = [];
  playingNowSongs: any[] = [];
  goToStageSongs: any[] = [];
  
  isLoadingStage: boolean = false;
  selectedPlaylistIndex = 0;
  animateFooter = false;

  // Auto Advance
  autoAdvanceTimer: any = null;
  private readonly SLIDE_DURATION_FIRST = 20000; // 20s for current song
  private readonly SLIDE_DURATION_NEXT = 10000;  // 10s for next songs

  constructor(
    private eventService: EventService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
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

  ngOnDestroy(): void {
    this.stopAutoAdvance();
  }

  private loadGlobalStage(): void {
    this.isLoadingStage = true;
    this.eventService.getEventJams(this.eventIdCode).subscribe({
      next: (jams) => {
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
          // A lógica do backend pode variar, mas para playlist visual isso funciona bem
          this.playingNowSongs = [onStage[0]];
          this.goToStageSongs = onStage.slice(1);
        } else {
          this.playingNowSongs = [];
          this.goToStageSongs = [];
        }
        
        this.isLoadingStage = false;
        this.loadPlaylist();
        this.ensureAutoAdvance();
      },
      error: (err) => {
        this.isLoadingStage = false;
        console.error('Error loading global stage', err);
      }
    });
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
  }

  startAutoAdvance() {
    this.stopAutoAdvance();
    
    if (this.playlistSongs.length === 0) return;

    const isFirst = this.selectedPlaylistIndex === 0;
    const duration = isFirst ? this.SLIDE_DURATION_FIRST : this.SLIDE_DURATION_NEXT;

    this.zone.runOutsideAngular(() => {
        this.autoAdvanceTimer = setTimeout(() => {
            this.zone.run(() => {
                this.nextSlide();
            });
        }, duration);
    });
  }

  stopAutoAdvance() {
    if (this.autoAdvanceTimer) {
        clearTimeout(this.autoAdvanceTimer);
        this.autoAdvanceTimer = null;
    }
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
        this.selectedPlaylistIndex = 0;
        
        // Recarrega dados para pegar atualizações
        this.loadGlobalStage();
    }
  }

  private ensureAutoAdvance() {
    if (!this.autoAdvanceTimer && this.playlistSongs.length > 0) {
        this.startAutoAdvance();
    }
  }

  getDisplayIndex(idx: number): string {
    return (idx + 1).toString().padStart(2, '0');
  }

  onImageError(event: any) {
    event.target.src = '/images/user/default-avatar.jpg';
  }
}
