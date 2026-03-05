import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Task } from '../types/types';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { DndModule } from 'ngx-drag-drop';
import { EventService } from '../../../../../pages/events/event.service';
import { forkJoin } from 'rxjs';


@Component({
  selector: 'app-kanban-task-item',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    DndModule
  ],
  templateUrl: './kanban-task-item.component.html',
  styles: ``
})
export class KanbanTaskItemComponent {

  @Input() task: Task = {} as Task;
  @Input() index: number = 0;
  @Input() eventIdCode: string = '';
  @Input() jamId?: number | null;
  @Output() edit = new EventEmitter<Task>();
  @Output() delete = new EventEmitter<Task>();
  @Output() readyToggled = new EventEmitter<Task>();
  @Output() expandedToggled = new EventEmitter<Task>();

  isMenuOpen = false;

  constructor(private eventService: EventService) { }

  getBorderClass(): string {
    // Se estiver em on_stage
    if (this.task.status === 'on_stage') {
      // Se for o primeiro (index 0), borda verde
      if (this.index === 0) {
        return 'border-green-500 border-2';
      }
      // Se for os demais, borda amarela (warning)
      return 'border-warning-500 border-2';
    }

    // Comportamento original para ready em outras colunas (ex: open_for_candidates)
    if (this.task.ready) {
      return 'border-green-500';
    }

    // Padrão
    return 'border-gray-200 dark:border-gray-800';
  }

  getCategoryStyles(color: string): string {
    switch (color) {
      case 'error':
        return 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400';
      case 'success':
        return 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400';
      case 'brand':
        return 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400';
      case 'orange':
        return 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400';
      case 'purple':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400';
    }
  }

  onDragStart(event: DragEvent) {
    console.log('Task drag started:', this.task);
  }

  onDragEnd(event: DragEvent) {
    console.log('Task drag ended');
  }

  toggleExpand() {
    this.task.expanded = !this.task.expanded;
    this.expandedToggled.emit(this.task);
  }

  toggleReady(event?: MouseEvent) {
    if (event) { try { event.stopPropagation(); } catch { } }
    if (this.task.status !== 'open_for_candidates') return;
    const jamId = this.jamId ?? (this.task?.song?.jam?.id ?? this.task?.song?.jam_id);
    const eventId = this.eventIdCode;
    const songId = this.task?.song?.id ?? this.task?.id;
    if (!eventId || !jamId || !songId) return;

    const nextReady = !this.task.ready;
    try { console.log('[Kanban] Toggle ready da música', { eventId, jamId, songId, ready: nextReady }); } catch { }
    this.eventService.updateSongReady(eventId, jamId, songId, nextReady).subscribe({
      next: (ok) => {
        if (ok) {
          this.task.ready = nextReady;
          if (!nextReady) this.task.orderIndex = undefined;
          this.readyToggled.emit(this.task);
        }
      },
      error: (err) => {
        try { console.log('[Kanban] Falha ao atualizar ready', err?.message || err); } catch { }
      }
    });
  }

  isToggleDisabled(): boolean {
    return this.task.status !== 'open_for_candidates';
  }

  toggleMenu(event?: MouseEvent) {
    if (event) { try { event.stopPropagation(); } catch { } }
    this.isMenuOpen = !this.isMenuOpen;
  }

  onEditClick(event?: MouseEvent) {
    if (event) { try { event.stopPropagation(); } catch { } }
    this.isMenuOpen = false;
    this.edit.emit(this.task);
  }

  onDeleteClick(event?: MouseEvent) {
    if (event) { try { event.stopPropagation(); } catch { } }
    this.isMenuOpen = false;
    this.delete.emit(this.task);
  }

  getApprovedUsers(): any[] {
    const buckets = this.task.song?.instrument_buckets || [];
    return buckets.flatMap((b: any) => Array.isArray(b.approved) ? b.approved : []);
  }

  getApprovedCount(): number {
    const buckets = this.task.song?.instrument_buckets || [];
    return buckets.reduce((sum: number, b: any) => sum + (Array.isArray(b.approved) ? b.approved.length : 0), 0);
  }

  getPendingCount(): number {
    const buckets = this.task.song?.instrument_buckets || [];
    return buckets.reduce((sum: number, b: any) => sum + (Array.isArray(b.pending) ? b.pending.length : 0), 0);
  }

  getApprovedUsersDetailed(): Array<{ user: any; instrument: string; bucket: any }> {
    const buckets = this.task.song?.instrument_buckets || [];
    const res: Array<{ user: any; instrument: string; bucket: any }> = [];
    for (const b of buckets) {
      const approved = Array.isArray(b.approved) ? b.approved : [];
      for (const u of approved) res.push({ user: u, instrument: b.instrument, bucket: b });
    }
    return res;
  }

  getUserKey(user: any): string {
    const base = user?.candidate_id ?? user?.id ?? user?.id_code ?? user?.user_id ?? user?.email ?? `${user?.display_name || user?.name || user?.username || 'user'}_${user?.instrument || ''}`;
    return String(base);
  }

  isUserApproved(bucket: any, user: any): boolean {
    const approved = bucket?.approved || [];
    const key = this.getUserKey(user);
    return approved.some((u: any) => this.getUserKey(u) === key);
  }

  onCandidateClick(bucket: any, user: any) {
    const approved = Array.isArray(bucket?.approved) ? bucket.approved : [];
    const pending = Array.isArray(bucket?.pending) ? bucket.pending : [];
    const key = this.getUserKey(user);
    if (approved.some((u: any) => this.getUserKey(u) === key)) return;
    const slots = Number(bucket?.slots || 0);
    if (approved.length >= slots) return;
    const prevApproved = [...approved];
    const prevPending = [...pending];
    bucket.approved = [...approved, user];
    bucket.pending = pending.filter((u: any) => this.getUserKey(u) !== key);
    const songId = this.task?.song?.id;
    const jamId = this.jamId ?? (this.task?.song?.jam?.id ?? this.task?.song?.jam_id);
    const eventId = this.eventIdCode;
    const instrument = String(bucket?.instrument || '');
    const candidateId = user?.candidate_id ?? user?.id_code ?? user?.application_id ?? user?.id ?? user?.user_id;
    console.log('[Kanban] Approve candidate payload', {
      eventId,
      jamId,
      songId,
      instrument,
      candidateId,
      status: 'approved'
    });
    if (eventId && jamId && songId && candidateId) {
      this.eventService.approveSongCandidate(eventId, jamId, songId, candidateId).subscribe({
        error: () => {
          bucket.approved = prevApproved;
          bucket.pending = prevPending;
        }
      });
    }
  }

  onApprovedClick(bucket: any, user: any) {
    const approved = Array.isArray(bucket?.approved) ? bucket.approved : [];
    const pending = Array.isArray(bucket?.pending) ? bucket.pending : [];
    const key = this.getUserKey(user);
    if (!approved.some((u: any) => this.getUserKey(u) === key)) return;
    const prevApproved = [...approved];
    const prevPending = [...pending];
    bucket.approved = approved.filter((u: any) => this.getUserKey(u) !== key);
    const existsInPending = pending.some((u: any) => this.getUserKey(u) === key);
    bucket.pending = existsInPending ? pending : [...pending, user];
    const songId = this.task?.song?.id;
    const jamId = this.jamId ?? (this.task?.song?.jam?.id ?? this.task?.song?.jam_id);
    const eventId = this.eventIdCode;
    const instrument = String(bucket?.instrument || '');
    const candidateId = user?.candidate_id ?? user?.id_code ?? user?.application_id ?? user?.id ?? user?.user_id;
    console.log('[Kanban] Revert candidate to pending payload', {
      eventId,
      jamId,
      songId,
      instrument,
      candidateId,
      status: 'pending'
    });
    if (eventId && jamId && songId && candidateId) {
      this.eventService.rejectSongCandidate(eventId, jamId, songId, candidateId).subscribe({
        error: () => {
          bucket.approved = prevApproved;
          bucket.pending = prevPending;
        }
      });
    }
  }

  getUserName(user: any): string {
    return user?.display_name || user?.name || user?.username || `#${user?.id}`;
  }

  getUserAvatar(user: any): string {
    return user?.avatar_url || user?.photo_url || '/images/user/user-01.jpg';
  }

  getInstrumentLabel(bucket: any): string {
    const map: any = { guitar: 'Guitarra', bass: 'Baixo', vocals: 'Voz', drums: 'Bateria', keys: 'Teclado' };
    const base = map[bucket?.instrument] || bucket?.instrument || '';
    const slots = Number(bucket?.slots || 0);
    return `${base} - ${slots} slot${slots > 1 ? 's' : ''}`;
  }

  getInstrumentShort(bucketOrKey: any): string {
    const key = typeof bucketOrKey === 'string' ? bucketOrKey : bucketOrKey?.instrument;
    const map: any = { guitar: 'Guitarra', bass: 'Baixo', vocals: 'Voz', drums: 'Bateria', keys: 'Teclado' };
    return map[key] || key || '';
  }

  getInstrumentRemainingLabel(bucket: any): string {
    const base = this.getInstrumentShort(bucket);
    const slots = Number(bucket?.slots || 0);
    const approvedCount = Array.isArray(bucket?.approved) ? bucket.approved.length : 0;
    const remaining = Math.max(0, slots - approvedCount);
    return `${base} - ${remaining}`;
  }

  getTrackKey(user: any, bucket?: any, index?: number): string {
    const base = this.getUserKey(user);
    const inst = typeof bucket?.instrument === 'string' ? bucket.instrument : '';
    if (base && base.trim().length) return `${base}:${inst}`;
    if (typeof index === 'number') return `idx:${index}:${inst}`;
    return `unknown:${inst}`;
  }

}
