import { Component, OnInit, OnDestroy, ApplicationRef, Injector, EnvironmentInjector, createComponent } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BoardColumnComponent } from '../../../shared/components/task/kanban/board-column/board-column.component';
import { Task } from '../../../shared/components/task/kanban/types/types';
import { DndDropEvent, DndModule } from 'ngx-drag-drop';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { EventService, EventListItem, ApiJam, ApiSong } from '../event.service';
import { NotificationComponent } from '../../../shared/components/ui/notification/notification/notification.component';
import { forkJoin, of } from 'rxjs';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { MusicSuggestionService, MusicSuggestion } from '../music-suggestion/music-suggestion.service';
import { MusicSuggestionModalComponent } from './components/music-suggestion-modal/music-suggestion-modal.component';

type SongStatus = 'planned' | 'open_for_candidates' | 'on_stage' | 'played' | 'canceled';


@Component({
  selector: 'app-jam-kanban',
  standalone: true,
  imports: [CommonModule, FormsModule, BoardColumnComponent, DndModule, ModalComponent, TranslateModule, MusicSuggestionModalComponent],
  templateUrl: './jam-kanban.component.html',
  styleUrl: './jam-kanban.component.css'
})
export class JamKanbanComponent implements OnInit, OnDestroy {
  events: EventListItem[] = [];
  selectedEventIdCode = '';
  selectedJam: ApiJam | null = null;

  get selectedEvent(): EventListItem | undefined {
    return this.events.find(e => e.id_code === this.selectedEventIdCode);
  }

  activeView: 'setlist' | 'suggestions' = 'setlist';
  suggestionViewMode: 'list' | 'grid' = 'list';
  suggestionFilter: 'SUBMITTED' | 'ALL' = 'SUBMITTED';
  suggestionSearchText: string = '';
  suggestions: MusicSuggestion[] = []; // Raw data from API
  filteredSuggestions: MusicSuggestion[] = []; // Filtered data for UI
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  
  suggestionsCount = 0;

  songs: ApiSong[] = [];
  tasks: Task[] = [];
  isLoading = false;
  private jamStream: EventSource | null = null;
  private refreshTimerId: any = null;
  private readonly refreshIntervalMs = 60000;

  constructor(
    private eventService: EventService,
    private musicSuggestionService: MusicSuggestionService,
    private translate: TranslateService,
    private appRef: ApplicationRef,
    private injector: Injector,
    private envInjector: EnvironmentInjector
  ) {}

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
    if (this.refreshTimerId) {
      clearInterval(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  applyClientFilters() {
    let result = this.suggestions;

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
    this.suggestionsCount = this.suggestions.length;
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
    return this.tasks.filter(t => t.status === 'planned');
  }

  get openTasks(): Task[] {
    return this.tasks.filter(t => t.status === 'open_for_candidates');
  }

  get onStageTasks(): Task[] {
    return this.tasks.filter(t => t.status === 'on_stage');
  }

  get playedTasks(): Task[] {
    return this.tasks.filter(t => t.status === 'played');
  }

  onRefreshClick() {
    this.refreshSuggestions();
    this.loadJamsAndSongs();
  }

  // Music Modal
  isMusicModalOpen = false;
  selectedSuggestionForModal: MusicSuggestion | null = null;
  availableUsers: any[] = [];

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
  }

  loadJamsAndSongs() {
    if (!this.selectedEventIdCode) return;
    this.isLoading = true;
    this.eventService.getEventJams(this.selectedEventIdCode).subscribe({
      next: (jams) => {
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
          .filter(([_, count]) => (count as number) > 0)
          .map(([inst, count]) => ({ 
            instrument: this.mapInstrumentKey(inst), 
            slots: count as number,
            required: true,
            fallback_allowed: true 
          }));
      const preApproved = participants.map((p: any) => ({
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
          .filter(([_, count]) => (count as number) > 0)
          .map(([inst, count]) => ({ 
            instrument: this.mapInstrumentKey(inst), 
            slots: count as number,
            required: false,
            fallback_allowed: true 
          }));

      const payload: any = {
        title: data.song_name,
        artist: data.artist_name,
        instrument_slots: instrumentSlots,
        pre_approved_candidates: participants.map((p: any) => ({
          user_id: p.user_id,
          instrument: this.mapInstrumentKey(p.instrument)
        })),
        status: 'planned' as SongStatus
      };

      this.eventService.createSongAuto(this.selectedEventIdCode, payload).subscribe({
        next: (res) => {
          const songId = res.song.id;
          const jamId = res.jam.id;
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

    if (oldStatus === newStatus && event.index === undefined) return;

    const oldIndex = this.tasks.findIndex(t => t.id === task.id);
    if (oldIndex > -1) this.tasks.splice(oldIndex, 1);
    
    task.status = newStatus;
    this.tasks.push(task); 

    if (this.selectedEventIdCode && this.selectedJam && task.song) {
       this.eventService.moveSongStatus(this.selectedEventIdCode, this.selectedJam.id, task.song.id, newStatus).subscribe({
         error: () => this.triggerToast('error', 'Erro', 'Falha ao mover música.')
       });
    }
  }

  handleEditTask(task: Task) {
    this.triggerToast('info', 'Em breve', 'Edição de música será implementada em breve.');
  }

  handleDeleteTask(task: Task) {
    if (!task.song || !this.selectedEventIdCode || !this.selectedJam) return;
    
    if (confirm(`Tem certeza que deseja remover "${task.title}"?`)) {
       this.eventService.deleteSong(this.selectedEventIdCode, this.selectedJam.id, task.song.id).subscribe({
         next: () => {
           this.tasks = this.tasks.filter(t => t.id !== task.id);
           this.triggerToast('success', 'Removido', 'Música removida.');
         },
         error: () => this.triggerToast('error', 'Erro', 'Falha ao remover música.')
       });
    }
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
      this.eventService.updateSongOrder(eventId, jam.id, 'open_for_candidates', orderedIds).subscribe({ next: () => {}, error: () => {} });
    }
  }

  // Delete Modal
  isDeleteModalOpen = false;
  suggestionToDelete: MusicSuggestion | null = null;

  openDeleteModal(suggestion: MusicSuggestion) {
    this.suggestionToDelete = suggestion;
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
  }

  confirmDelete() {
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
