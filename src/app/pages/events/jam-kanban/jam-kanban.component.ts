import { Component, OnInit, OnDestroy, ApplicationRef, Injector, EnvironmentInjector, createComponent } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BoardColumnComponent } from '../../../shared/components/task/kanban/board-column/board-column.component';
import { Task } from '../../../shared/components/task/kanban/types/types';
import { DndDropEvent, DndModule } from 'ngx-drag-drop';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { LabelComponent } from '../../../shared/components/form/label/label.component';
import { InputFieldComponent } from '../../../shared/components/form/input/input-field.component';
import { EventService, EventListItem, ApiJam, ApiSong } from '../event.service';
import { NotificationComponent } from '../../../shared/components/ui/notification/notification/notification.component';
import { forkJoin, of } from 'rxjs';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { MusicSuggestionService, MusicSuggestion } from '../music-suggestion/music-suggestion.service';

type SongStatus = 'planned' | 'open_for_candidates' | 'on_stage' | 'played' | 'canceled';


@Component({
  selector: 'app-jam-kanban',
  standalone: true,
  imports: [CommonModule, FormsModule, BoardColumnComponent, DndModule, ModalComponent, LabelComponent, InputFieldComponent, TranslateModule],
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
  showAddModal = false;
  isLoading = false;
  private jamStream: EventSource | null = null;
  private refreshTimerId: any = null;
  private readonly refreshIntervalMs = 60000;

  // Form nova música
  newSong = { title: '', artist: '' };
  instrumentChoices = [
    { key: 'vocals', label: 'Voz' },
    { key: 'guitar', label: 'Guitarra' },
    { key: 'bass', label: 'Baixo' },
    { key: 'keys', label: 'Teclado' },
    { key: 'drums', label: 'Bateria' },
    { key: 'horns', label: 'Metais' },
    { key: 'percussion', label: 'Percussão' },
    { key: 'strings', label: 'Cordas' },
    { key: 'other', label: 'Outro' },
  ];
  instrumentForm: Record<string, { enabled: boolean; slots: number }> = {
    vocals: { enabled: false, slots: 1 },
    guitar: { enabled: false, slots: 1 },
    bass: { enabled: false, slots: 1 },
    keys: { enabled: false, slots: 1 },
    drums: { enabled: false, slots: 1 },
    horns: { enabled: false, slots: 1 },
    percussion: { enabled: false, slots: 1 },
    strings: { enabled: false, slots: 1 },
    other: { enabled: false, slots: 1 },
  };

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

  approveSuggestion(suggestion: MusicSuggestion) {
    const msg = this.translate.instant('events.admin.kanban.suggestions.actions.confirm_approve', { song: suggestion.song_name });
    if (!confirm(msg)) return;
    this.musicSuggestionService.updateSuggestion({ 
      id: suggestion.id, 
      id_code: suggestion.id_code,
      status: 'APPROVED' 
    }).subscribe({
      next: () => {
        // Optimistic update or wait for reload
        // The subscription above will auto-update the list as it filters by SUBMITTED
      },
      error: () => alert('Erro ao aprovar sugestão')
    });
  }

  rejectSuggestion(suggestion: MusicSuggestion) {
    const msg = this.translate.instant('events.admin.kanban.suggestions.actions.confirm_reject', { song: suggestion.song_name });
    if (!confirm(msg)) return;
    this.musicSuggestionService.updateSuggestion({ 
      id: suggestion.id, 
      id_code: suggestion.id_code,
      status: 'REJECTED' 
    }).subscribe({
      next: () => {
        // The subscription above will auto-update
      },
      error: () => alert('Erro ao recusar sugestão')
    });
  }

  // Delete Modal
  isDeleteModalOpen = false;
  suggestionToDelete: MusicSuggestion | null = null;

  openDeleteModal(suggestion: MusicSuggestion) {
    this.suggestionToDelete = suggestion;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.suggestionToDelete = null;
  }

  confirmDelete() {
    if (!this.suggestionToDelete) return;
    const id = this.suggestionToDelete.id_code || this.suggestionToDelete.id;
    this.musicSuggestionService.deleteSuggestion(id).subscribe({
      next: () => {
        this.triggerToast('success', 'Sugestão excluída', `A música "${this.suggestionToDelete?.song_name}" foi removida.`);
        this.closeDeleteModal();
      },
      error: () => {
        this.triggerToast('error', 'Erro ao excluir', 'Não foi possível remover a sugestão.');
        this.closeDeleteModal();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopJamStream();
    this.stopRefreshTimer();
  }


  onSelectEvent(): void {
    if (!this.selectedEventIdCode) { this.selectedJam = null; this.songs = []; this.tasks = []; this.stopRefreshTimer(); return; }
    this.stopRefreshTimer();
    this.loadSelectedEvent();
    this.refreshSuggestions();
    this.startRefreshTimer();
  }

  refreshSuggestions() {
    if (this.selectedEventIdCode) {
      // If SUBMITTED (default), don't send status to use backend default
      // If ALL, send status=ALL
      const statusParam = this.suggestionFilter === 'ALL' ? 'ALL' : undefined;
      this.musicSuggestionService.loadSuggestions(this.selectedEventIdCode, statusParam);
    }
  }

  private getExpandedStorageKey(): string {
    const eventKey = String(this.selectedEventIdCode || '').trim();
    const jamKey = String(this.selectedJam?.id ?? '').trim();
    return `jam-kanban:expanded:${eventKey}:${jamKey}`;
  }

  private loadExpandedState(): Record<string, number> {
    const key = this.getExpandedStorageKey();
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, number>;
      return {};
    } catch { return {}; }
  }

  private saveExpandedState(state: Record<string, number>): void {
    const key = this.getExpandedStorageKey();
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }

  private applyExpandedState(nextTasks: Task[]): Task[] {
    const persisted = this.loadExpandedState();
    return nextTasks.map(t => ({ ...t, expanded: !!persisted[String(t.id)] }));
  }

  private loadSelectedEvent(): void {
    this.isLoading = true;
    this.eventService.getEventJams(this.selectedEventIdCode).subscribe({
      next: (jams) => {
        this.selectedJam = jams && jams.length ? jams[0] : null;
        const jam = this.selectedJam as (ApiJam & { songs?: ApiSong[] }) | null;
        if (jam) {
          this.startJamStream();
          if (Array.isArray(jam.songs) && jam.songs.length) {
            this.songs = jam.songs;
            const nextTasks = jam.songs.map(s => ({ id: String(s.id), title: s.title, dueDate: '', assignee: '/images/user/user-01.jpg', status: (s.status as SongStatus) || 'planned', category: { name: 'Jam', color: 'default' }, expanded: false, song: s, ready: !!(s as any).ready, orderIndex: (!!(s as any).ready && typeof (s as any).order_index === 'number' ? Number((s as any).order_index) : undefined) }));
            this.tasks = this.applyExpandedState(nextTasks);
            this.isLoading = false;
          } else {
            this.loadSongs(true);
          }
        } else {
          this.songs = [];
          this.tasks = [];
          this.isLoading = false;
          this.stopJamStream();
        }
      },
      error: () => { this.selectedJam = null; this.songs = []; this.tasks = []; this.isLoading = false; }
    });
  }

  loadSongs(setLoading?: boolean): void {
    const jam = this.selectedJam;
    if (!jam || !this.selectedEventIdCode) { this.songs = []; this.tasks = []; if (setLoading) this.isLoading = false; return; }
    if (setLoading) this.isLoading = true;
    this.eventService.getJamSongs(this.selectedEventIdCode, jam.id).subscribe({
      next: (items) => {
        this.songs = items;
        const nextTasks = items.map(s => ({ id: String(s.id), title: s.title, dueDate: '', assignee: '/images/user/user-01.jpg', status: (s.status as SongStatus) || 'planned', category: { name: 'Jam', color: 'default' }, expanded: false, song: s, ready: !!(s as any).ready, orderIndex: (!!(s as any).ready && typeof (s as any).order_index === 'number' ? Number((s as any).order_index) : undefined) }));
        this.tasks = this.applyExpandedState(nextTasks);
        if (setLoading) this.isLoading = false;

      },
      error: () => { this.songs = []; this.tasks = []; if (setLoading) this.isLoading = false; }
    });
  }

  private startJamStream(): void {
    const eventId = this.selectedEventIdCode;
    const jamId = this.selectedJam?.id;
    if (!eventId || !jamId) return;
    this.stopJamStream();
    const es = this.eventService.streamJam(eventId, jamId);
    this.jamStream = es;
    es.onopen = () => { try { console.log('[SSE][Jam] open', { eventId, jamId }); } catch {} };
    es.onmessage = (ev: MessageEvent) => {
      try { console.log('[SSE][Jam] message', { type: (ev as any)?.type || 'message', data: ev.data }); } catch {}
    };
    es.onerror = (err: any) => { try { console.log('[SSE][Jam] error', err); } catch {} };
  }

  private stopJamStream(): void {
    if (this.jamStream) {
      try { this.jamStream.close(); } catch {}
      this.jamStream = null;
    }
  }

  private startRefreshTimer(): void {
    this.stopRefreshTimer();
    this.refreshTimerId = setInterval(() => {
      if (!this.selectedEventIdCode) { this.stopRefreshTimer(); return; }
      this.loadSelectedEvent();
    }, this.refreshIntervalMs);
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimerId) { try { clearInterval(this.refreshTimerId); } catch {} this.refreshTimerId = null; }
  }

  onRefreshClick(): void {
    if (!this.selectedEventIdCode) return;
    this.stopRefreshTimer();
    this.loadSelectedEvent();
    this.startRefreshTimer();
  }

  private sortByOrder(a: Task, b: Task): number {
    const ai = typeof a.orderIndex === 'number' ? a.orderIndex : Number.MAX_SAFE_INTEGER;
    const bi = typeof b.orderIndex === 'number' ? b.orderIndex : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  }
  get plannedTasks() { return this.tasks.filter(t => t.status === 'planned').sort((a,b)=>this.sortByOrder(a,b)); }
  get openTasks() { return this.tasks.filter(t => t.status === 'open_for_candidates').sort((a,b)=>this.sortByOrder(a,b)); }
  get onStageTasks() { return this.tasks.filter(t => t.status === 'on_stage').sort((a,b)=>this.sortByOrder(a,b)); }
  get playedTasks() { return this.tasks.filter(t => t.status === 'played').sort((a,b)=>this.sortByOrder(a,b)); }

  handleTaskDrop({ event, status }: { event: DndDropEvent, status: string }) {
    const dragged = event.data as Task;
    const fromStatus = dragged.status as SongStatus;
    const toStatus = status as SongStatus;
    const dropIndex = typeof event.index === 'number' ? event.index : undefined;
    const jam = this.selectedJam;
    if (!jam) return;

    if (toStatus === 'on_stage' && !dragged.ready) {
      return;
    }

    if (fromStatus === toStatus) {
      this.reorderTask(dragged, toStatus, dropIndex);
      return;
    }

    this.eventService.moveSongStatus(this.selectedEventIdCode, jam.id, dragged.id, toStatus).subscribe({
      next: () => {
        this.reorderTask(dragged, toStatus, dropIndex);
        if (toStatus === 'on_stage') {
          const task = this.tasks.find(t => t.id === dragged.id);
          const buckets = task?.song?.instrument_buckets || [];
          const rejects: any[] = [];
          for (const b of buckets as any[]) {
            const pend = Array.isArray(b?.pending) ? b.pending : [];
            for (const u of pend) {
              const cid = (u?.candidate_id ?? u?.application_id ?? u?.id ?? u?.user_id);
              if (cid !== undefined && cid !== null) {
                rejects.push(this.eventService.rejectSongCandidate(this.selectedEventIdCode, jam.id, dragged.id, cid));
              }
            }
          }
          if (rejects.length) forkJoin(rejects).subscribe({ next: () => {}, error: () => {} });
        }
      },
      error: () => {
        this.loadSongs();
      }
    });
  }

  private reorderTask(dragged: Task, toStatus: SongStatus, dropIndex?: number): void {
    const withoutDragged = this.tasks.filter(t => t.id !== dragged.id);
    const isOpenApproved = (t: Task) => t.status === 'open_for_candidates' && t.ready === true;
    const targetListUnsorted = toStatus === 'open_for_candidates'
      ? withoutDragged.filter(isOpenApproved)
      : withoutDragged.filter(t => t.status === toStatus);
    const targetList = [...targetListUnsorted].sort((a,b)=>this.sortByOrder(a,b));
    const fromStatusInitial = dragged.status as SongStatus;
    let idx: number;
    if (fromStatusInitial !== toStatus && toStatus === 'open_for_candidates' && (fromStatusInitial === 'on_stage' || fromStatusInitial === 'played')) {
      // returning from stage/played: always append after last approved
      idx = targetList.length;
    } else {
      const rawIdx = typeof dropIndex === 'number' ? dropIndex : targetList.length;
      idx = Math.max(0, Math.min(rawIdx - 1, targetList.length));
    }
    const newDragged = { ...dragged, status: toStatus } as Task;
    if (toStatus === 'planned') newDragged.ready = false;
    else if (toStatus === 'on_stage' || toStatus === 'played') newDragged.ready = true;
    const newTasks = [...withoutDragged];
    if (idx < targetList.length) {
      const beforeId = targetList[idx].id;
      const beforeIndex = newTasks.findIndex(t => t.id === beforeId);
      newTasks.splice(beforeIndex, 0, newDragged);
    } else if (targetList.length) {
      const lastId = targetList[targetList.length - 1].id;
      const lastIndex = newTasks.findIndex(t => t.id === lastId);
      newTasks.splice(lastIndex + 1, 0, newDragged);
    } else {
      newTasks.push(newDragged);
    }
    this.tasks = newTasks;
    // Reindex only approved in open_for_candidates; clear others
    const approvedList = this.tasks.filter(isOpenApproved);
    approvedList.forEach((t, i) => {
      const idxGlobal = this.tasks.findIndex(x => x.id === t.id);
      this.tasks[idxGlobal] = { ...this.tasks[idxGlobal], orderIndex: i + 1 } as Task;
    });
    this.tasks.filter(t => t.status !== 'open_for_candidates' || !t.ready).forEach(t => {
      const idxGlobal = this.tasks.findIndex(x => x.id === t.id);
      if (idxGlobal !== -1) this.tasks[idxGlobal] = { ...this.tasks[idxGlobal], orderIndex: undefined } as Task;
    });

    const orderedIds = this.tasks.filter(t => t.status === 'open_for_candidates' && t.ready).map(t => t.id);
    const orderedOnStageIds = this.tasks.filter(t => t.status === 'on_stage').map(t => t.id);

    try { console.log('[Kanban] Atualizar ordem', { status: toStatus, ordered_ids: orderedIds, on_stage_ids: orderedOnStageIds }); } catch {}
    const jam = this.selectedJam;
    const eventId = this.selectedEventIdCode;
    if (jam && eventId && toStatus !== 'canceled') {
      // Se moveu para ou dentro de open_for_candidates, persiste ordem open
      const draggedStatus = dragged.status as string;
      const targetStatus = toStatus as string;
      if (targetStatus === 'open_for_candidates' || (draggedStatus === 'open_for_candidates' && targetStatus !== 'open_for_candidates')) {
         const persistStatus: 'planned' | 'open_for_candidates' | 'on_stage' | 'played' = 'open_for_candidates';
         this.eventService.updateSongOrder(eventId, jam.id, persistStatus, orderedIds).subscribe({
           next: (ok) => { try { console.log('[Kanban] Ordem open persistida', ok); } catch {} },
           error: (err) => { try { console.log('[Kanban] Falha ao persistir ordem open', err?.message || err); } catch {} }
         });
      }

      // Se moveu para ou dentro de on_stage, persiste ordem stage
      if (targetStatus === 'on_stage' || (draggedStatus === 'on_stage' && targetStatus !== 'on_stage')) {
         const persistStatus: 'planned' | 'open_for_candidates' | 'on_stage' | 'played' = 'on_stage';
         this.eventService.updateSongOrder(eventId, jam.id, persistStatus, orderedOnStageIds).subscribe({
           next: (ok) => { try { console.log('[Kanban] Ordem stage persistida', ok); } catch {} },
           error: (err) => { try { console.log('[Kanban] Falha ao persistir ordem stage', err?.message || err); } catch {} }
         });
      }
    }
  }

  handleEditTask(task: Task): void {
    const idx = this.tasks.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      this.tasks[idx] = { ...this.tasks[idx], expanded: true };
      const map = this.loadExpandedState();
      map[String(task.id)] = 1;
      this.saveExpandedState(map);
    }
  }

  handleDeleteTask(task: Task): void {
    const jam = this.selectedJam;
    const eventId = this.selectedEventIdCode;
    const songId = task?.song?.id ?? task?.id;
    if (!jam || !eventId || !songId) return;
    this.eventService.deleteSong(eventId, jam.id, songId).subscribe({
      next: (ok) => {
        if (ok) {
          this.tasks = this.tasks.filter(t => t.id !== String(songId));
          this.triggerToast('success', 'jam excluída...', 'A música foi removida do setlist.');
        } else {
          this.triggerToast('error', 'Erro ao excluir', 'Falha ao remover a música.');
        }
      },
      error: (err) => {
        const msg = (err?.error?.message || err?.message || 'Falha ao remover a música.');
        this.triggerToast('error', 'Erro ao excluir', msg);
      }
    });
  }

  openAddModal() { if (!this.selectedEventIdCode) return; this.showAddModal = true; }
  closeAddModal() { this.showAddModal = false; }

  insertSong(): void {
    if (!this.selectedEventIdCode) return;
    const title = (this.newSong.title || '').trim();
    if (!title) return;
    const toggledSlots = Object.entries(this.instrumentForm)
      .filter(([_, v]) => v.enabled)
      .map(([k, v]) => ({ instrument: k, slots: Math.max(1, Number(v.slots) || 1) }));
    const payload = { title, artist: (this.newSong.artist || '').trim() || undefined, instrument_slots: toggledSlots };
    this.eventService.createSongAuto(this.selectedEventIdCode, payload).subscribe({
      next: (res) => {
        this.selectedJam = res.jam;
        const song = res.song;
        this.tasks.unshift({ id: String(song.id), title: song.title, dueDate: '', assignee: '/images/user/user-01.jpg', status: (song.status as SongStatus) || 'planned', category: { name: 'Jam', color: 'default' }, expanded: false, song, ready: false, orderIndex: (typeof (song as any).order_index === 'number' ? Number((song as any).order_index) : undefined) });
        this.resetForm();
        this.closeAddModal();
      },
      error: () => {}
    });
  }

  openPlaylistWindow(): void {
    if (!this.selectedEventIdCode) return;
    const url = `/events/home-guest-v2/${this.selectedEventIdCode}?view=playlist&standalone=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  resetForm(): void {
    this.newSong = { title: '', artist: '' };
    Object.keys(this.instrumentForm).forEach(k => { this.instrumentForm[k].enabled = false; this.instrumentForm[k].slots = 1; });
  }

  onTitleChange(val: string | number) { this.newSong.title = String(val || ''); }
  onArtistChange(val: string | number) { this.newSong.artist = String(val || ''); }

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

  handleExpandedToggled(task: Task): void {
    const idx = this.tasks.findIndex(t => t.id === task.id);
    if (idx === -1) return;
    this.tasks[idx] = { ...this.tasks[idx], expanded: !!task.expanded };
    const map = this.loadExpandedState();
    if (task.expanded) map[String(task.id)] = 1; else delete map[String(task.id)];
    this.saveExpandedState(map);
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

  private reindexApproved(): void {
    const isOpenApproved = (t: Task) => t.status === 'open_for_candidates' && t.ready === true;
    const approvedList = this.tasks.filter(isOpenApproved).sort((a,b)=>this.sortByOrder(a,b));
    approvedList.forEach((t, i) => {
      const idxGlobal = this.tasks.findIndex(x => x.id === t.id);
      this.tasks[idxGlobal] = { ...this.tasks[idxGlobal], orderIndex: i + 1 } as Task;
    });
    this.tasks.filter(t => t.status !== 'open_for_candidates' || !t.ready).forEach(t => {
      const idxGlobal = this.tasks.findIndex(x => x.id === t.id);
      if (idxGlobal !== -1) this.tasks[idxGlobal] = { ...this.tasks[idxGlobal], orderIndex: undefined } as Task;
    });
  }
}
