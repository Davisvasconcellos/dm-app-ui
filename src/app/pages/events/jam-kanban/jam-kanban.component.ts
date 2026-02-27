import { Component, OnInit, OnDestroy, ApplicationRef, Injector, EnvironmentInjector, createComponent, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BoardColumnComponent } from '../../../shared/components/task/kanban/board-column/board-column.component';
import { Task } from '../../../shared/components/task/kanban/types/types';
import { DndDropEvent, DndModule } from 'ngx-drag-drop';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { EventService, EventListItem, ApiJam, ApiSong, CreateSongAutoPayload } from '../event.service';
import { NotificationComponent } from '../../../shared/components/ui/notification/notification/notification.component';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { MusicSuggestionService, MusicSuggestion } from '../music-suggestion/music-suggestion.service';
import { MusicSuggestionModalComponent } from './components/music-suggestion-modal/music-suggestion-modal.component';
import { ResilienceService } from '../../../shared/services/resilience.service';
import { Subject, of } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

type SongStatus = 'planned' | 'open_for_candidates' | 'on_stage' | 'played' | 'canceled';

interface Participant {
  user_id: string;
  instrument: string;
  [key: string]: any;
}

interface MusicModalData {
  song_name: string;
  artist_name: string;
  cover_image?: string;
  catalog_id?: number;
  slots?: Record<string, number>;
  participants?: Participant[];
}

@Component({
  selector: 'app-jam-kanban',
  standalone: true,
  imports: [CommonModule, FormsModule, BoardColumnComponent, DndModule, ModalComponent, TranslateModule, MusicSuggestionModalComponent],
  templateUrl: './jam-kanban.component.html',
  styleUrl: './jam-kanban.component.css'
})
export class JamKanbanComponent implements OnInit, OnDestroy {
  private eventService = inject(EventService);
  private musicSuggestionService = inject(MusicSuggestionService);
  private translate = inject(TranslateService);
  private appRef = inject(ApplicationRef);
  private injector = inject(Injector);
  private envInjector = inject(EnvironmentInjector);
  private resilienceService = inject(ResilienceService);
  private destroy$ = new Subject<void>();

  events: EventListItem[] = [];
  selectedEventIdCode = '';
  selectedJam: ApiJam | null = null;

  get selectedEvent(): EventListItem | undefined {
    return this.events.find(e => e.id_code === this.selectedEventIdCode);
  }

  activeView: 'setlist' | 'suggestions' = 'setlist';
  suggestionViewMode: 'list' | 'grid' = 'grid';
  suggestionFilter: 'OPEN' | 'CLOSED' = 'OPEN';
  suggestionSearchText = '';
  suggestions: MusicSuggestion[] = []; // Raw data from API
  filteredSuggestions: MusicSuggestion[] = []; // Filtered data for UI
  
  openSuggestionsCount = 0;
  closedSuggestionsCount = 0;

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;

  suggestionsCount = 0;

  jams: ApiJam[] = [];
  songs: ApiSong[] = [];
  tasks: Task[] = [];
  isLoading = false;
  private jamStream: EventSource | null = null;
  private refreshTimerId: any = null;
  private readonly refreshIntervalMs = 60000;

  ngOnInit(): void {
    this.eventService.getEvents().subscribe({ next: (items) => this.events = items, error: () => this.events = [] });

    // Subscribe to suggestions updates
    this.musicSuggestionService.suggestions$.subscribe(suggestions => {
      this.suggestions = suggestions;
      this.applyClientFilters();
    });
  }

  ngOnDestroy(): void {
    if (this.jamStream) {
      this.jamStream.close();
      this.jamStream = null;
    }
    this.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyClientFilters() {
    let result = this.suggestions;

    // 0. Calculate Counts (Independent of active search/filter)
    this.openSuggestionsCount = this.suggestions.filter(s => s.status === 'SUBMITTED').length;
    this.closedSuggestionsCount = this.suggestions.filter(s => s.status === 'APPROVED' || s.status === 'REJECTED').length;

    // 1. Status Filter (Client-side)
    if (this.suggestionFilter === 'OPEN') {
      result = result.filter(s => s.status === 'SUBMITTED');
    } else if (this.suggestionFilter === 'CLOSED') {
      result = result.filter(s => s.status === 'APPROVED' || s.status === 'REJECTED');
    }

    // 1. Text Search Filter
    if (this.suggestionSearchText && this.suggestionSearchText.trim()) {
      const term = this.suggestionSearchText.toLowerCase().trim();
      result = result.filter(s =>
        s.song_name.toLowerCase().includes(term) ||
        s.artist_name.toLowerCase().includes(term) ||
        (s.creator?.name || '').toLowerCase().includes(term)
      );
    }

    this.filteredSuggestions = result;
    this.suggestionsCount = result.length;
    this.currentPage = 1; // Reset to first page on filter change
  }

  onAlbumImageError(event: any) {
    event.target.src = '/images/cards/card-01.jpg';
  }

  get paginatedSuggestions(): MusicSuggestion[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredSuggestions.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredSuggestions.length / this.itemsPerPage);
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  get plannedTasks(): Task[] {
    return this.tasks.filter(t => t.status === 'planned').sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  get openTasks(): Task[] {
    return this.tasks.filter(t => t.status === 'open_for_candidates').sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  get onStageTasks(): Task[] {
    return this.tasks.filter(t => t.status === 'on_stage').sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  get playedTasks(): Task[] {
    return this.tasks.filter(t => t.status === 'played').sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  onRefreshClick() {
    this.refreshSuggestions();
    this.loadJamsAndSongs();
  }

  // Music Modal
  isMusicModalOpen = false;
  selectedSuggestionForModal: MusicSuggestion | null = null;
  availableUsers: { id: number | string; name: string; avatar: string }[] = [];

  openAddModal() {
    if (!this.selectedEventIdCode) return;
    this.selectedSuggestionForModal = null;
    this.isMusicModalOpen = true;
  }

  closeMusicModal() {
    this.isMusicModalOpen = false;
    this.selectedSuggestionForModal = null;
  }

  onSelectEvent(newValue?: string) {
    if (newValue) this.selectedEventIdCode = newValue;
    this.refreshSuggestions();
    this.loadEventGuests();
    this.loadJamsAndSongs();
    this.startPolling();
    this.subscribeToResilienceState();
  }

  startPolling() {
    this.stopPolling();

    this.resilienceService.pollWithResilience(
      () => {
        this.onRefreshClick();
        return of(true);
      },
      this.refreshIntervalMs,
      3,
      `jam_kanban_${this.selectedEventIdCode}`
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe();
  }

  stopPolling() {
    // Polling is now handled by takeUntil(this.destroy$) and the resilience operator
    // but we can still use this to reset if needed
  }

  private subscribeToResilienceState() {
    this.resilienceService.getState().pipe(
      takeUntil(this.destroy$)
    ).subscribe(state => {
      if (state.status === 'down') {
        this.triggerToast('warning', 'Modo Offline (Kanban)', 'Servidor instável. Exibindo última versão do quadro.');
      } else if (state.status === 'unstable') {
        this.triggerToast('info', 'Conexão Instável', 'Tentando atualizar o quadro...');
      }
    });
  }

  loadJamsAndSongs(forceRefresh: boolean = false) {
    if (!this.selectedEventIdCode) return;
    this.isLoading = true;
    
    // 1. If force refresh, clear local persistence cache first
    const cacheKey = `jam_kanban_${this.selectedEventIdCode}_jams`;
    if (forceRefresh) {
      this.resilienceService.clearCache(cacheKey);
    }

    // 2. Prepare the observable.
    let jams$ = this.eventService.getEventJams(this.selectedEventIdCode);
    
    // 3. Apply failover only if not forcing refresh
    if (!forceRefresh) {
      jams$ = jams$.pipe(
        this.resilienceService.withFailover(cacheKey, 3)
      );
    }

    jams$.pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (jams) => {
        if (!jams || !Array.isArray(jams)) {
          this.isLoading = false;
          return;
        }
        this.jams = jams;
        this.processJamsAndSongs(jams);
      },
      error: (err) => {
        console.error('Erro ao carregar Jams:', err);
        this.selectedJam = null;
        this.tasks = [];
        this.isLoading = false;
        this.triggerToast('error', 'Erro', 'Falha ao carregar Jams do evento.');
      }
    });
  }

  private processJamsAndSongs(jams: ApiJam[]) {
    if (jams.length > 0) {
      this.selectedJam = jams[0];
      const songs = this.selectedJam.songs || [];
      this.songs = songs;
      this.mapSongsToTasks(songs);
    } else {
      this.selectedJam = null;
      this.tasks = [];
      this.isLoading = false;
    }
  }

  private mapSongsToTasks(songs: ApiSong[]) {
    this.tasks = songs.map(s => ({
      id: String(s.id),
      title: s.title,
      dueDate: '',
      assignee: '/images/user/user-01.jpg',
      status: (s.status as SongStatus) || 'planned',
      category: { name: 'Jam', color: 'default' },
      expanded: false,
      song: s,
      ready: s.ready || false,
      orderIndex: (typeof s.order_index === 'number' ? Number(s.order_index) : undefined)
    }));
    this.loadExpandedState();
    this.isLoading = false;
  }

  loadEventGuests() {
    if (!this.selectedEventIdCode) return;
    this.eventService.getEventGuests(this.selectedEventIdCode).subscribe({
      next: (guests) => {
        this.availableUsers = guests.map(g => ({
          id: g.id,
          name: g.display_name || (g as any).name || 'Sem nome',
          avatar: g.avatar_url || '/images/user/default-avatar.jpg'
        }));
      },
      error: () => this.availableUsers = []
    });
  }

  onMusicModalSave(data: any) {
    const participants = data.participants || [];

    if (this.selectedSuggestionForModal) {
      // Edit/Approve with override payload support
      const suggestionId = this.selectedSuggestionForModal.id_code;
      if (!suggestionId) {
        this.triggerToast('error', 'Erro', 'Sugestão sem id_code. Não foi possível aprovar.');
        return;
      }
      const jamId = this.selectedJam?.id;
      if (!jamId) {
        this.triggerToast('error', 'Erro', 'Jam não selecionada para aprovação.');
        return;
      }
      const instrumentSlots = Object.entries(data.slots || {})
        .filter(([, count]) => (count as number) > 0)
        .map(([inst, count]) => ({
          instrument: this.mapInstrumentKey(inst),
          slots: count as number,
          required: true,
          fallback_allowed: true
        }));
      const preApproved = participants.map((p: Participant) => ({
        user_id: p.user_id,
        instrument: this.mapInstrumentKey(p.instrument)
      }));
      const approvePayload = {
        jam_id: jamId,
        instrument_slots: instrumentSlots,
        pre_approved_candidates: preApproved
      };
      this.musicSuggestionService.approveSuggestionOverride(suggestionId, approvePayload).subscribe({
        next: () => {
          this.triggerToast('success', 'Sugestão aprovada', `A sugestão foi aprovada e inserida no planned.`);
          this.closeMusicModal();
          // Remove da lista e atualiza kanban
          this.refreshSuggestions();
          this.loadJamsAndSongs();
        },
        error: () => this.triggerToast('error', 'Erro', 'Falha ao aprovar sugestão.')
      });

    } else {
      // Create via createSongAuto (Song + Slots)
      const instrumentSlots = Object.entries(data.slots || {})
        .filter(([, count]) => (count as number) > 0)
        .map(([inst, count]) => ({
          instrument: this.mapInstrumentKey(inst),
          slots: count as number,
          required: false,
          fallback_allowed: true
        }));

      const payload: CreateSongAutoPayload = {
        title: data.song_name,
        artist: data.artist_name,
        cover_image: data.cover_image,
        catalog_id: data.catalog_id,
        instrument_slots: instrumentSlots,
        pre_approved_candidates: participants.map((p: Participant) => ({
          user_id: p.user_id,
          instrument: this.mapInstrumentKey(p.instrument)
        })),
        status: 'planned' as SongStatus
      };

      this.eventService.createSongAuto(this.selectedEventIdCode, payload).subscribe({
        next: (res) => {
          this.triggerToast('success', 'Música adicionada', `"${data.song_name}" foi adicionada.`);
          this.closeMusicModal();
          if (this.selectedJam && res.jam.id === this.selectedJam.id) {
            const song = res.song;
            this.tasks.unshift({
              id: String(song.id),
              title: song.title,
              dueDate: '',
              assignee: '/images/user/user-01.jpg',
              status: (song.status as SongStatus) || 'planned',
              category: { name: 'Jam', color: 'default' },
              expanded: false,
              song,
              ready: false,
              orderIndex: (typeof (song as any).order_index === 'number' ? Number((song as any).order_index) : undefined)
            });
          }
        },
        error: () => this.triggerToast('error', 'Erro', 'Falha ao criar música.')
      });
    }
  }

  approveSuggestion(suggestion: MusicSuggestion) {
    this.selectedSuggestionForModal = suggestion;
    this.isMusicModalOpen = true;
  }

  refreshSuggestions() {
    if (this.selectedEventIdCode) {
      this.musicSuggestionService.loadSuggestions(this.selectedEventIdCode, 'ALL');
    }
  }

  sortByOrder() {
    this.tasks.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  loadExpandedState() {
    try {
      const saved = localStorage.getItem('jam-kanban-expanded-tasks');
      if (saved) {
        const expandedIds = JSON.parse(saved);
        this.tasks.forEach(t => {
          if (expandedIds.includes(t.id)) t.expanded = true;
        });
      }
    } catch (e) { console.error('Error loading expanded state', e); }
  }

  saveExpandedState() {
    try {
      const expandedIds = this.tasks.filter(t => t.expanded).map(t => t.id);
      localStorage.setItem('jam-kanban-expanded-tasks', JSON.stringify(expandedIds));
    } catch (e) { console.error('Error saving expanded state', e); }
  }

  handleExpandedToggled(task: Task): void {
    const idx = this.tasks.findIndex(t => t.id === task.id);
    if (idx === -1) return;
    this.tasks[idx] = { ...this.tasks[idx], expanded: !!task.expanded };
    this.saveExpandedState();
  }

  private reindexApproved(): void {
    const isOpenApproved = (t: Task) => t.status === 'open_for_candidates' && t.ready === true;
    const approvedList = this.tasks.filter(isOpenApproved).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    approvedList.forEach((t, i) => {
      const idxGlobal = this.tasks.findIndex(x => x.id === t.id);
      this.tasks[idxGlobal] = { ...this.tasks[idxGlobal], orderIndex: i + 1 } as Task;
    });
    this.tasks.filter(t => t.status !== 'open_for_candidates' || !t.ready).forEach(t => {
      const idxGlobal = this.tasks.findIndex(x => x.id === t.id);
      if (idxGlobal !== -1) this.tasks[idxGlobal] = { ...this.tasks[idxGlobal], orderIndex: undefined } as Task;
    });
  }

  openPlaylistWindow(): void {
    if (!this.selectedEventIdCode) return;
    const url = `/events/playlist/${this.selectedEventIdCode}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  handleTaskDrop(data: { event: DndDropEvent, status: string }) {
    const { event, status } = data;
    const task = event.data as Task;
    const oldStatus = task.status;
    const newStatus = status as SongStatus;
    
    // 1. Determine target index (default to end of column)
    let targetIndex = event.index;

    // 2. Early exit if nothing changed
    if (oldStatus === newStatus && targetIndex === undefined) return;

    // 3. Prepare column tasks for reindexing
    let columnTasks = this.tasks
      .filter(t => t.status === newStatus)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    // 4. Handle intra-column move logic
    if (oldStatus === newStatus) {
      const oldIdxInColumn = columnTasks.findIndex(t => t.id === task.id);
      if (oldIdxInColumn > -1) {
        columnTasks.splice(oldIdxInColumn, 1);
        // Correct index if shifting down
        if (targetIndex !== undefined && targetIndex > oldIdxInColumn) {
          targetIndex--;
        }
      }
    } else {
      // Cross-column: remove from global first to prevent duplicates
      const globalIdx = this.tasks.findIndex(t => t.id === task.id);
      if (globalIdx > -1) this.tasks.splice(globalIdx, 1);
      task.status = newStatus;
    }

    // 5. Apply insertion
    const finalIndex = targetIndex !== undefined ? targetIndex : columnTasks.length;
    columnTasks.splice(finalIndex, 0, task);

    // 6. Local re-indexing (temporary until server reload)
    // Find min index in the target column to keep the sequence base
    const existingIndices = columnTasks
      .filter(t => t.id !== task.id && typeof t.orderIndex === 'number')
      .map(t => t.orderIndex as number);
    
    const baseOffset = existingIndices.length > 0 
      ? Math.min(...existingIndices) 
      : (task.orderIndex || 1);

    columnTasks.forEach((t, i) => {
      t.orderIndex = (Number.isFinite(baseOffset) ? baseOffset : 1) + i;
    });

    // 7. Ensure consistency of global tasks array and trigger change detection
    if (oldStatus !== newStatus) {
      this.tasks.push(task);
    }
    this.tasks = [...this.tasks]; // Trigger Angular change detection

    // 8. Backend Sync & Forced Refresh (Sequential Execution)
    if (this.selectedEventIdCode && this.selectedJam && task.song) {
      const eventId = this.selectedEventIdCode;
      const jamId = this.selectedJam.id;
      const songId = task.song.id;
      const orderedIds = columnTasks.map(t => t.song?.id).filter(id => id !== undefined) as number[];

      // Build the sequential chain
      const statusUpdate$ = (oldStatus !== newStatus)
        ? this.eventService.moveSongStatus(eventId, jamId, songId, newStatus)
        : of(null);

      statusUpdate$.pipe(
        switchMap(() => {
          if (newStatus !== 'canceled') {
            return this.eventService.updateSongOrder(eventId, jamId, newStatus as any, orderedIds);
          }
          return of(null);
        }),
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          // Success! Small delay to let backend settle, then reload bypassing cache
          setTimeout(() => this.loadJamsAndSongs(true), 500);
        },
        error: (err) => {
          console.error('Drag-and-drop sync failed:', err);
          this.triggerToast('error', 'Erro', 'Falha ao sincronizar ordem.');
          // Reload bypassing cache to revert UI to server state
          this.loadJamsAndSongs(true);
        }
      });
    }
  }

  handleEditTask(_task: Task) {
    this.triggerToast('info', 'Em breve', 'Edição de música será implementada em breve.');
  }

  handleDeleteTask(task: Task) {
    if (!task.song || !this.selectedEventIdCode || !this.selectedJam) return;
    this.taskToDelete = task;
    this.suggestionToDelete = null;
    this.isDeleteModalOpen = true;
  }

  handleReadyToggled(task: Task): void {
    const idx = this.tasks.findIndex(t => t.id === task.id);
    if (idx === -1) return;
    const toStatus = this.tasks[idx].status as SongStatus;
    // Set initial order at end when approved in open_for_candidates
    const isOpenApproved = (t: Task) => t.status === 'open_for_candidates' && t.ready === true;
    if (toStatus === 'open_for_candidates' && task.ready) {
      // push to end based on current approved count (before marking)
      const approvedCountBefore = this.tasks.filter(isOpenApproved).length;
      this.tasks[idx] = { ...this.tasks[idx], ready: true, orderIndex: approvedCountBefore + 1 } as Task;
    } else {
      // unapprove: clear order
      this.tasks[idx] = { ...this.tasks[idx], orderIndex: undefined, ready: false } as Task;
    }
    // Reindex approved sequentially
    const approvedList = this.tasks.filter(isOpenApproved);
    approvedList.forEach((t, i) => {
      const g = this.tasks.findIndex(x => x.id === t.id);
      if (g !== -1) this.tasks[g] = { ...this.tasks[g], orderIndex: i + 1 } as Task;
    });
    // Persist
    const jam = this.selectedJam;
    const eventId = this.selectedEventIdCode;
    const orderedIds = this.tasks.filter(t => t.status === 'open_for_candidates' && t.ready).map(t => t.id);
    if (jam && eventId) {
      this.eventService.updateSongOrder(eventId, jam.id, 'open_for_candidates', orderedIds).subscribe({ next: () => { }, error: () => { } });
    }
  }

  // Delete Modal
  isDeleteModalOpen = false;
  suggestionToDelete: MusicSuggestion | null = null;
  taskToDelete: Task | null = null;

  openDeleteModal(suggestion: MusicSuggestion) {
    this.suggestionToDelete = suggestion;
    this.taskToDelete = null;
    this.isDeleteModalOpen = true;
  }

  private mapInstrumentKey(inst: string): string {
    const norm = String(inst || '').toLowerCase();
    if (norm.includes('voz') || norm.includes('vocal') || norm.includes('cantor') || norm.includes('mic')) return 'vocals';
    if (norm.includes('guitarra') || norm.includes('violão') || norm.includes('violao') || norm.includes('guitar') || norm.includes('acoustic')) return 'guitar';
    if (norm.includes('baixo') || norm.includes('bass')) return 'bass';
    if (norm.includes('bateria') || norm.includes('drum') || norm.includes('batera')) return 'drums';
    if (norm.includes('teclado') || norm.includes('piano') || norm.includes('key') || norm.includes('synth') || norm.includes('orgão') || norm.includes('orgao')) return 'keys';
    if (norm.includes('metais') || norm.includes('horn') || norm.includes('sax') || norm.includes('trompete') || norm.includes('trombone') || norm.includes('flauta') || norm.includes('wind') || norm.includes('sopro')) return 'horns';
    if (norm.includes('percussão') || norm.includes('percussao') || norm.includes('percussion') || norm.includes('conga') || norm.includes('cajon') || norm.includes('pandeiro')) return 'percussion';
    if (norm.includes('cordas') || norm.includes('string') || norm.includes('violino') || norm.includes('cello') || norm.includes('viola')) return 'strings';
    return 'other';
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.suggestionToDelete = null;
    this.taskToDelete = null;
  }

  confirmDelete() {
    if (this.suggestionToDelete) {
      this.confirmDeleteSuggestion();
    } else if (this.taskToDelete) {
      this.confirmDeleteTask();
    }
  }

  private confirmDeleteSuggestion() {
    if (!this.suggestionToDelete) return;
    const id = this.suggestionToDelete.id_code;
    if (!id) {
      this.triggerToast('error', 'Erro', 'Sugestão sem id_code. Não foi possível remover.');
      return;
    }

    this.musicSuggestionService.deleteSuggestion(id).subscribe({
      next: () => {
        this.triggerToast('success', 'Sugestão removida', `Música "${this.suggestionToDelete?.song_name}" removida.`);
        this.closeDeleteModal();
        this.refreshSuggestions();
      },
      error: () => {
        this.triggerToast('error', 'Erro', 'Falha ao remover sugestão.');
      }
    });
  }

  private confirmDeleteTask() {
    if (!this.taskToDelete || !this.taskToDelete.song || !this.selectedEventIdCode || !this.selectedJam) return;

    const task = this.taskToDelete;
    this.eventService.deleteSong(this.selectedEventIdCode, this.selectedJam.id, task.song.id).subscribe({
      next: () => {
        this.tasks = this.tasks.filter(t => t.id !== task.id);
        this.triggerToast('success', 'Removido', `Música "${task.title}" removida.`);
        this.closeDeleteModal();
      },
      error: () => {
        this.triggerToast('error', 'Erro', 'Falha ao remover música.');
      }
    });
  }

  private triggerToast(
    variant: 'success' | 'info' | 'warning' | 'error',
    title: string,
    description?: string
  ) {
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
}
