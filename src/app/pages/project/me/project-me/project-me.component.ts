import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { StoreContextService, Store } from '../../../../shared/services/store-context.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ProjectService } from '../../project.service';
import { Project, ProjectMember } from '../../project.types';

@Component({
  selector: 'app-project-me',
  standalone: false,
  templateUrl: './project-me.component.html',
})
export class ProjectMeComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private projectService = inject(ProjectService);
  private storeContext = inject(StoreContextService);
  private sub = new Subscription();

  members: ProjectMember[] = [];
  projects: Project[] = [];
  myMember: ProjectMember | null = null;
  activeStore: Store | null = null;
  selectedDate: string = new Date().toISOString().slice(0, 10);
  daysOfWeek: { date: string; dayName: string; dayNumber: number; isSelected: boolean; isToday: boolean }[] = [];
  
  timelineData: any = null;
  nowMs: number = Date.now();
  private ticker: any;
  
  editingTask: any = null;
  draftNote: string = '';

  ngOnInit(): void {
    this.generateDaysStrip();
    this.sub.add(this.projectService.listProjects().subscribe((p) => (this.projects = p || [])));
    this.sub.add(
      this.projectService.listMembers().subscribe((m) => {
        this.members = m || [];
        this.recomputeMyMember();
      })
    );
    this.sub.add(
      this.storeContext.activeStore$.subscribe((st) => {
        this.activeStore = st;
        this.loadData();
      })
    );

    this.ticker = setInterval(() => {
      this.nowMs = Date.now();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.sub.unsubscribe();
  }

  private recomputeMyMember(): void {
    const me = this.auth.getCurrentUser();
    const email = (me as any)?.email as string | undefined;
    if (!email) {
      this.myMember = null;
      return;
    }
    this.myMember = this.members.find((m) => (m.email || '').toLowerCase() === email.toLowerCase()) || null;
  }

  clampPct(v: number): number {
    const n = Number(v || 0);
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  statusLabel(s: ProjectMember['status']): string {
    if (s === 'working') return 'Trabalhando';
    if (s === 'break') return 'Pausa';
    if (s === 'idle') return 'Ocioso';
    return 'Offline';
  }

  statusClass(s: ProjectMember['status']): string {
    if (s === 'working') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300';
    if (s === 'break') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300';
    if (s === 'idle') return 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200';
    return 'bg-gray-50 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400';
  }

  isTodayStr(d: string): boolean {
    return d === new Date().toISOString().slice(0, 10);
  }

  selectedDateFormatted(): string {
    const d = new Date(this.selectedDate + 'T12:00:00Z');
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  }

  selectedDateMonthYear(): string {
    const d = new Date(this.selectedDate + 'T12:00:00Z');
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  setToday(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.selectDate(today);
  }

  onDatePickerChange(event: any): void {
    if (event && event.dateStr) {
      this.selectDate(event.dateStr);
    }
  }

  selectDate(iso: string): void {
    this.selectedDate = iso;
    this.generateDaysStrip();
    this.loadData();
  }

  generateDaysStrip(): void {
    const d = new Date(this.selectedDate + 'T12:00:00Z');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Get monday
    const monday = new Date(d.setDate(diff));
    
    const strip = [];
    const todayIso = new Date().toISOString().slice(0, 10);
    
    for (let i = 0; i < 7; i++) {
      const iterDate = new Date(monday);
      iterDate.setDate(monday.getDate() + i);
      const iso = iterDate.toISOString().slice(0, 10);
      
      strip.push({
        date: iso,
        dayName: iterDate.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3),
        dayNumber: iterDate.getDate(),
        isSelected: iso === this.selectedDate,
        isToday: iso === todayIso
      });
    }
    this.daysOfWeek = strip;
  }

  formatSecondsToHms(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  getLiveSeconds(entry: any): number {
    if (!entry.is_running) return (entry.minutes || 0) * 60;
    const start = new Date(entry.start_at).getTime();
    return Math.max(0, Math.floor((this.nowMs - start) / 1000));
  }

  getLiveBlockSeconds(block: any): number {
    if (!block.entries) return 0;
    return block.entries.reduce((acc: number, e: any) => acc + this.getLiveSeconds(e), 0);
  }

  getTotalDaySeconds(): number {
    if (!this.timelineData?.summary) return 0;
    const s = this.timelineData.summary;
    const projectTotal = (this.timelineData.timeline_blocks || []).reduce((acc: number, b: any) => acc + this.getLiveBlockSeconds(b), 0);
    
    // For General: we use the API value. If it's running, it will tick because getMeToday/timeline
    // returns updated minutes, but for a true "live" feel we can add a small delta or 
    // simply rely on the fact that general_minutes is the sum of confirmed + running.
    return ((s.general_minutes || 0) * 60) + projectTotal;
  }

  loadData(): void {
    const storeId = this.activeStore?.id_code;
    if (!storeId) {
      this.timelineData = null;
      return;
    }

    this.projectService.getMyTimeline(storeId, this.selectedDate).subscribe({
      next: (resp) => {
        this.timelineData = resp?.data || resp;
      },
      error: () => {
        this.timelineData = null;
      }
    });
  }

  loadMockData(): void {
    // Deprecated for real data
  }

  // Note Modal Actions
  openNoteModal(task: any): void {
    this.editingTask = task;
    this.draftNote = task.description || '';
  }

  saveNote(): void {
    const storeId = this.activeStore?.id_code;
    if (this.editingTask && storeId) {
      this.projectService.updateTimeEntryNote(storeId, this.editingTask.id_code, this.draftNote).subscribe({
        next: () => {
          this.editingTask.description = this.draftNote;
          this.closeNoteModal();
        }
      });
    }
  }

  closeNoteModal(): void {
    this.editingTask = null;
    this.draftNote = '';
  }

  getProjectMembers(projectIdCode: string): ProjectMember[] {
    if (!projectIdCode || !this.members) return [];
    return this.members.filter(m => m.current_project_id_code === projectIdCode).slice(0, 4);
  }

  isBlockRunning(block: any): boolean {
    return (block?.entries || []).some((e: any) => e.is_running);
  }
}
