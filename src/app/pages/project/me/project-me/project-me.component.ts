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
  
  timelineProjects: any[] = [];
  
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
      })
    );
  }

  ngOnDestroy(): void {
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
    this.loadMockData();
  }

  loadMockData(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.selectedDate === today) {
      this.timelineProjects = [
        {
          id: 'p1',
          projectName: 'Dmedia - Interno',
          totalDuration: '4h 00m',
          status: 'completed',
          tasks: [
            {
              id: 't1',
              stageTitle: 'Alinhamento',
              stageColor: 'bg-purple-500',
              duration: '1h 30m',
              startTime: '09:00',
              endTime: '10:30',
              status: 'completed',
              description: 'Reunião de alinhamento com a equipe para fechar os escopos.'
            },
            {
              id: 't2',
              stageTitle: 'Processos Internos',
              stageColor: 'bg-indigo-500',
              duration: '2h 30m',
              startTime: '10:30',
              endTime: '13:00',
              status: 'completed',
              description: '' // Sem descrição para testar o placeholder ou '+'
            }
          ]
        },
        {
          id: 'p2',
          projectName: 'DM-APP SaaS',
          totalDuration: 'Rodando...',
          status: 'active',
          tasks: [
            {
              id: 't3',
              stageTitle: 'Desenvolvimento Frontend',
              stageColor: 'bg-emerald-500',
              duration: '1h 15m',
              startTime: '14:00',
              endTime: null,
              status: 'active',
              description: 'Construção da interface de Meu Dia com hierarquia e modal de observação.'
            }
          ]
        }
      ];
    } else {
      this.timelineProjects = [];
    }
  }

  // Note Modal Actions
  openNoteModal(task: any): void {
    this.editingTask = task;
    this.draftNote = task.description || '';
  }

  saveNote(): void {
    if (this.editingTask) {
      this.editingTask.description = this.draftNote;
    }
    this.closeNoteModal();
  }

  closeNoteModal(): void {
    this.editingTask = null;
    this.draftNote = '';
  }
}
