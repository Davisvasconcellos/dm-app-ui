import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, forkJoin, of, catchError } from 'rxjs';
import { StoreInviteService, StoreInvite } from '../../admin/stores/config/store-invite.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../shared/services/auth.service';
import { StoreContextService, Store } from '../../../shared/services/store-context.service';
import { ProjectService } from '../project.service';
import { ProjectContextService } from '../services/project-context.service';
import { ProjectStageHistoryService } from '../services/project-stage-history.service';
import { ProjectTimerService } from '../services/project-timer.service';
import { Project, ProjectMember } from '../project.types';

interface StageItem {
  id_code: string;
  title: string;
  acronym: string | null;
  status: string | null;
  due_date: string | null;
  color_1: string | null;
  total_minutes?: number;
  total_amount?: number;
}

interface ScopeStore {
  id_code: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  banner_url: string | null;
  my_role: string | null;
  my_permissions: string[];
}

interface ScopeItem {
  store: ScopeStore;
  projects: any[];
}

@Component({
  selector: 'app-home-project',
  standalone: false,
  templateUrl: './home-project.component.html',
})
export class HomeProjectComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private inviteService = inject(StoreInviteService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private storeContext = inject(StoreContextService);
  private projectService = inject(ProjectService);
  private projectContext = inject(ProjectContextService);
  private stageHistory = inject(ProjectStageHistoryService);
  private timer = inject(ProjectTimerService);
  private sub = new Subscription();
  private tickIntervalId: any = null;
  private closeStagesTimeoutId: any = null;
  private heartbeatIntervalId: any = null;

  @ViewChildren('projectCardEl') projectCardEls!: QueryList<ElementRef<HTMLElement>>;

  activeStore: Store | null = null;
  projects: Project[] = [];
  members: ProjectMember[] = [];
  isLoading = true;

  scopeLoading = true;
  scopeItems: ScopeItem[] = [];
  scopeEmpty = false;
  pendingInvites: StoreInvite[] = [];
  processingInvites = new Set<string>();

  selectedProjectIdCode = '';
  isStagesRendered = false;
  isStagesOpen = false;
  isLoadingStages = false;
  stages: StageItem[] = [];
  selectedStageIdCode = '';
  selectedStage: StageItem | null = null;
  stageHistoryItems: StageItem[] = [];
  nowMs = Date.now();
  globalLoading = false;
  isGeneralRunning = false;
  generalTimeEntryId = '';
  generalConfirmedMinutes = 0;
  generalRunningMinutesEstimated = 0;
  generalHeartbeatLocalMs = 0;
  
  isTaskRunning = false;
  taskTimeEntryId = '';
  taskConfirmedMinutes = 0;
  taskRunningMinutesEstimated = 0;
  taskRunningProjectIdCode = '';
  taskRunningStageIdCode = '';
  taskHeartbeatLocalMs = 0;
  
  globalLastSyncLocalMs = 0;
  globalSyncing = false;
  sessionCheckInAt: string | null = null;
  taskLoading = false;
  dragIndex: number | null = null;
  dragOverIndex: number | null = null;

  ngOnInit(): void {
    const current = this.projectContext.getActiveProject();
    if (current?.id_code) this.selectedProjectIdCode = current.id_code;

    this.tickIntervalId = setInterval(() => {
      this.nowMs = Date.now();
    }, 1000);

    this.sub.add(
      this.projectService.listProjects().subscribe((items) => {
        this.projects = items || [];
        if (!this.scopeLoading && this.activeStore?.id_code) this.isLoading = false;
      })
    );

    this.sub.add(this.projectService.listMembers().subscribe((m) => (this.members = m || [])));

    this.sub.add(
      this.storeContext.activeStore$.subscribe((st) => {
        this.activeStore = st;
        this.closeStages();
        this.stages = [];
        this.selectedStageIdCode = '';
        this.selectedStage = null;
        this.stageHistoryItems = [];
        this.stopHeartbeatLoop();
        if (st?.id_code) {
          this.refreshPendingInvitesOnly();
          if (this.selectedProjectIdCode) this.restoreProjectStageHistory(this.selectedProjectIdCode);
          this.loadGlobalToday(st.id_code);
        } else {
          this.globalLoading = false;
          this.isGeneralRunning = false;
          this.generalTimeEntryId = '';
          this.generalConfirmedMinutes = 0;
          this.generalRunningMinutesEstimated = 0;
          this.isTaskRunning = false;
          this.taskTimeEntryId = '';
          this.taskRunningProjectIdCode = '';
          this.taskRunningStageIdCode = '';
          this.globalSyncing = false;
          this.sessionCheckInAt = null;
          this.taskLoading = false;
        }
      })
    );

    this.loadScope();
  }

  ngOnDestroy(): void {
    if (this.tickIntervalId) clearInterval(this.tickIntervalId);
    if (this.closeStagesTimeoutId) clearTimeout(this.closeStagesTimeoutId);
    this.stopHeartbeatLoop();
    this.sub.unsubscribe();
  }

  selectProject(p: Project): void {
    if (!p?.id_code) return;
    this.selectedProjectIdCode = p.id_code;
    this.projectContext.setActiveProject(p);
    this.restoreProjectStageHistory(p.id_code);
    this.openStages(p.id_code);
    setTimeout(() => this.scrollSelectedProjectIntoView(), 0);
  }

  startWork(): void {
    const pick = this.projects.find((p) => p.id_code === this.selectedProjectIdCode) || null;
    if (pick) this.projectContext.setActiveProject(pick);
    this.router.navigate(['/project/work']);
  }

  projectLogoLetter(p: Project): string {
    const name = String(p?.name || '').trim();
    return (name[0] || 'P').toUpperCase();
  }

  onProjectCardClick(p: Project): void {
    if (!p?.id_code) return;
    if (this.selectedProjectIdCode !== p.id_code) {
      this.selectProject(p);
      return;
    }

    if (this.isStagesOpen) this.closeStages();
    else this.openStages(p.id_code);
  }

  onStageClick(s: StageItem): void {
    const pid = this.selectedProjectIdCode;
    const storeId = (this.activeStore?.id_code || '').trim();
    if (!pid || !storeId || this.globalLoading || this.taskLoading) return;

    this.selectedStageIdCode = s.id_code;
    this.selectedStage = s;
    this.upsertStageHistory(pid, s);
    
    // Close the stages modal immediately as requested
    this.closeStages();

    // Start or Switch API task
    this.performTaskSwitch(storeId, pid, s.id_code);
  }

  toggleTimer(): void {
    const storeId = (this.activeStore?.id_code || '').trim();
    if (!storeId || this.globalLoading || this.taskLoading) return;
    if (this.isGeneralRunning) {
      this.stopGlobal(storeId);
    } else {
      this.startTask(storeId);
    }
  }

  get isTimerRunning(): boolean {
    return this.isGeneralRunning;
  }

  get todayTotalLabel(): string {
    // Base from confirmed (closed) entries + server-synced running estimate
    const confirmedSeconds = this.generalConfirmedMinutes * 60;
    const serverEstimatedSeconds = this.isGeneralRunning ? this.generalRunningMinutesEstimated * 60 : 0;
    
    // Add live seconds ticking locally since the last heartbeat
    const liveExtraSeconds = this.isGeneralRunning && this.generalHeartbeatLocalMs
      ? Math.floor(Math.max(0, this.nowMs - this.generalHeartbeatLocalMs) / 1000)
      : 0;

    const totalSeconds = confirmedSeconds + serverEstimatedSeconds + liveExtraSeconds;
    return this.formatSecondsToHms(totalSeconds);
  }

  private formatSecondsToHms(totalSeconds: number): string {
    const s = Math.floor(totalSeconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  get isTaskActive(): boolean {
    return this.isTaskRunning;
  }

  get globalHeartbeatProgressPercent(): number {
    if (!this.isGeneralRunning && !this.isTaskRunning) return 0;
    if (!this.globalLastSyncLocalMs) return 0;
    const elapsedMs = Math.max(0, this.nowMs - this.globalLastSyncLocalMs);
    return Math.min(100, Math.floor((elapsedMs / 60_000) * 100));
  }

  get selectedStageTotalLabel(): string {
    const pid = this.selectedProjectIdCode;
    const sid = this.selectedStageIdCode;
    if (!pid || !sid) return '00:00:00';
    const dateKey = this.timer.getDateKey(new Date());
    const ms = this.timer.getElapsedMs(pid, dateKey, this.nowMs, sid);
    return this.formatDurationHms(ms);
  }

  stageHistoryLabel(stageIdCode: string): string {
    const pid = this.selectedProjectIdCode;
    if (!pid) return '00:00:00';
    const dateKey = this.timer.getDateKey(new Date());
    const ms = this.timer.getElapsedMs(pid, dateKey, this.nowMs, stageIdCode);
    return this.formatDurationHms(ms);
  }

  onStageCardClick(s: StageItem): void {
    const pid = this.selectedProjectIdCode;
    const storeId = (this.activeStore?.id_code || '').trim();
    if (!pid || !storeId || this.globalLoading || this.taskLoading) return;

    // Ignore if we just finished a drag (dragIndex gets cleared on dragend)
    if (this.dragIndex !== null) return;

    // Toggle logic: If clicking the one that's already running, do nothing
    if (this.isTaskRunning && this.taskRunningStageIdCode === s.id_code && this.taskRunningProjectIdCode === pid) {
      this.openStagesForSelectedProject();
      return;
    }

    // Otherwise, perform switch
    this.selectedStageIdCode = s.id_code;
    this.selectedStage = s;
    this.upsertStageHistory(pid, s);
    this.performTaskSwitch(storeId, pid, s.id_code);
  }

  onDragStart(index: number): void {
    if (this.taskLoading) return;
    this.dragIndex = index;
  }

  onDragOver(index: number, event: DragEvent): void {
    event.preventDefault();
    this.dragOverIndex = index;
  }

  onDrop(targetIndex: number): void {
    if (this.dragIndex === null || this.dragIndex === targetIndex) {
      this.dragIndex = null;
      this.dragOverIndex = null;
      return;
    }

    const items = [...this.stageHistoryItems];
    const [moved] = items.splice(this.dragIndex, 1);
    items.splice(targetIndex, 0, moved);
    this.stageHistoryItems = items;

    // Persist new order
    const pid = this.selectedProjectIdCode;
    if (pid) {
      const dateKey = this.timer.getDateKey(new Date());
      this.stageHistory.reorderStages(dateKey, pid, items.map((s) => ({
        id_code: s.id_code,
        title: s.title,
        acronym: s.acronym,
        color_1: s.color_1 ?? null,
      })));
    }

    this.dragIndex = null;
    this.dragOverIndex = null;
  }

  onDragEnd(): void {
    this.dragIndex = null;
    this.dragOverIndex = null;
  }

  private performTaskSwitch(storeId: string, projectId: string, stageId: string): void {
    if (this.isTaskRunning) {
      if (this.taskRunningStageIdCode === stageId && this.taskRunningProjectIdCode === projectId) return;
      
      this.taskLoading = true;
      this.projectService.stopTaskEntry(storeId, this.taskTimeEntryId).subscribe({
        next: (resp) => {
          const dataArr = Array.isArray(resp?.data) ? resp.data : [resp?.data];
          dataArr.forEach((d: any) => {
            if (d.time_entry_id === this.generalTimeEntryId) {
              this.generalConfirmedMinutes += Number(d.minutes || 0);
            } else if (d.time_entry_id === this.taskTimeEntryId) {
              this.taskConfirmedMinutes += Number(d.minutes || 0);
            }
          });
          
          // Local timer stop
          const dateKey = this.timer.getDateKey(new Date());
          this.timer.stop(this.taskRunningProjectIdCode, dateKey, this.taskRunningStageIdCode);

          this.isTaskRunning = false;
          this.taskTimeEntryId = '';
          this.taskRunningProjectIdCode = '';
          this.taskRunningStageIdCode = '';
          this.stopHeartbeatLoop();
          
          this.taskLoading = false;
          this.startTask(storeId, projectId, stageId);
        },
        error: (err) => {
          if (err?.status === 409) {
            this.loadGlobalToday(storeId);
          } else {
            this.taskLoading = false;
          }
        }
      });
    } else {
      this.startTask(storeId, projectId, stageId);
    }
  }

  projectAvatars(p: Project): ProjectMember[] {
    const projectId = p?.id_code || '';
    const byProject = (this.members || []).filter((m) => m.current_project_id_code === projectId);
    const list = byProject.length ? byProject : this.members || [];
    return list.slice(0, 3);
  }

  private formatDurationHms(ms: number): string {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  protected formatMinutesToHms(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h}:${String(m).padStart(2, '0')}h`;
  }

  private scrollSelectedProjectIntoView(): void {
    const idx = (this.projects || []).findIndex((p) => p.id_code === this.selectedProjectIdCode);
    if (idx < 0) return;
    const el = this.projectCardEls?.get(idx)?.nativeElement;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  closeStages(): void {
    this.isStagesOpen = false;
    if (this.closeStagesTimeoutId) clearTimeout(this.closeStagesTimeoutId);
    if (this.isStagesRendered) {
      this.closeStagesTimeoutId = setTimeout(() => {
        this.isStagesRendered = false;
      }, 260);
    }
  }

  private openStages(projectIdCode: string): void {
    if (this.closeStagesTimeoutId) clearTimeout(this.closeStagesTimeoutId);
    this.isStagesRendered = true;
    setTimeout(() => {
      this.isStagesOpen = true;
    }, 0);
    this.loadStages(projectIdCode);
  }

  openStagesForSelectedProject(): void {
    const pid = this.selectedProjectIdCode;
    if (!pid) return;
    this.openStages(pid);
  }

  selectScopeStore(item: ScopeItem): void {
    const store = this.mapScopeStore(item.store);
    this.scopeEmpty = false;
    this.storeContext.setActiveStore(store);
    this.applyScopeProjects(item);
  }

  private loadScope(): void {
    this.scopeLoading = true;

    forkJoin({
      scope: this.projectService.getMyScope(),
      invites: this.inviteService.getMyInvites('pending').pipe(
        catchError(() => of({ success: true as const, data: [] as StoreInvite[] }))
      ),
    }).subscribe({
      next: ({ scope: itemsRaw, invites: invRes }) => {
        const parsed = this.parseScopeItems(itemsRaw || []);
        const list = Array.isArray(invRes?.data) ? invRes.data : [];
        const pending = list.filter((i) => i.status === 'pending');

        this.applyScopeAndInvites(parsed, pending);
      },
      error: () => {
        this.scopeItems = [];
        this.scopeLoading = false;
        this.scopeEmpty = true;
        this.pendingInvites = [];
        this.projectService.setProjectsFromExternal([]);
        this.storeContext.setActiveStore(null);
        this.isLoading = false;
      },
    });
  }

  private parseScopeItems(itemsRaw: any[]): ScopeItem[] {
    return (itemsRaw || [])
      .map((it: any) => {
        const st = it?.store;
        const idCode = String(st?.id_code || st?.id || '').trim();
        if (!idCode) return null;
        const store: ScopeStore = {
          id_code: idCode,
          name: String(st?.name || '').trim() || idCode,
          slug: st?.slug ? String(st.slug) : null,
          logo_url: st?.logo_url ? String(st.logo_url) : null,
          banner_url: st?.banner_url ? String(st.banner_url) : null,
          my_role: st?.my_role ? String(st.my_role) : null,
          my_permissions: Array.isArray(st?.my_permissions) ? (st.my_permissions as string[]) : [],
        };
        const projects = Array.isArray(it?.projects) ? (it.projects as any[]) : [];
        return { store, projects } satisfies ScopeItem;
      })
      .filter((x: any): x is ScopeItem => !!x);
  }

  /** Atualiza só a lista de convites (ex.: na Home com unidade já escolhida). */
  private refreshPendingInvitesOnly(): void {
    this.inviteService.getMyInvites('pending').subscribe({
      next: (res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        this.pendingInvites = list.filter((i) => i.status === 'pending');
      },
      error: () => {
        this.pendingInvites = [];
      },
    });
  }

  private applyScopeAndInvites(parsed: ScopeItem[], pendingInvites: StoreInvite[]): void {
    this.scopeItems = parsed;
    this.scopeLoading = false;
    this.scopeEmpty = parsed.length === 0;
    this.pendingInvites = pendingInvites;

    const hasPendingInvites = pendingInvites.length > 0;

    if (hasPendingInvites) {
      this.storeContext.setActiveStore(null);
    } else {
      const current = this.storeContext.getActiveStore();
      if (current?.id_code) {
        const match = parsed.find((x) => x.store.id_code === current.id_code);
        if (match) {
          this.applyScopeProjects(match);
          return;
        }
        this.storeContext.setActiveStore(null);
      }
    }

    if (!hasPendingInvites && parsed.length === 1) {
      this.selectScopeStore(parsed[0]);
    } else if (parsed.length === 0) {
      this.projectService.setProjectsFromExternal([]);
      this.isLoading = false;
    }
  }

  acceptPendingInvite(inv: StoreInvite): void {
    if (!inv?.id_code) return;
    if (this.processingInvites.has(inv.id_code)) return;
    this.processingInvites.add(inv.id_code);
    this.inviteService.acceptInviteById(inv.id_code).subscribe({
      next: () => {
        this.toast.triggerToast('success', 'Sucesso', 'Convite aceito com sucesso!');
        this.auth.getUserMe().subscribe({
          next: () => {
            this.processingInvites.delete(inv.id_code);
            this.storeContext.setActiveStore(null);
            this.loadScope();
          },
          error: () => {
            this.processingInvites.delete(inv.id_code);
            this.storeContext.setActiveStore(null);
            this.loadScope();
          },
        });
      },
      error: () => {
        this.toast.triggerToast('error', 'Erro', 'Não foi possível aceitar o convite.');
        this.processingInvites.delete(inv.id_code);
      },
    });
  }

  rejectPendingInvite(inv: StoreInvite): void {
    if (!inv?.id_code) return;
    if (this.processingInvites.has(inv.id_code)) return;
    const name = inv.store?.name || 'esta unidade';
    if (!confirm(`Recusar o convite para ${name}?`)) return;
    this.processingInvites.add(inv.id_code);
    this.inviteService.revokeMyInvite(inv.id_code).subscribe({
      next: () => {
        this.toast.triggerToast('success', 'Sucesso', 'Convite recusado.');
        this.processingInvites.delete(inv.id_code);
        this.storeContext.setActiveStore(null);
        this.loadScope();
      },
      error: () => {
        this.toast.triggerToast('error', 'Erro', 'Não foi possível recusar o convite.');
        this.processingInvites.delete(inv.id_code);
      },
    });
  }

  private mapScopeStore(st: ScopeStore): Store {
    return {
      id_code: st.id_code,
      id: 0,
      name: st.name,
      logo_url: st.logo_url,
      banner_url: st.banner_url,
    };
  }

  private applyScopeProjects(item: ScopeItem): void {
    const mapped = (item.projects || [])
      .map((p: any) => {
        const idCode = String(p?.id_code || p?.id || '').trim();
        const name = String(p?.title || p?.name || '').trim();
        if (!idCode || !name) return null;
        const statusRaw = String(p?.status || '').trim();
        const status: any = statusRaw === 'published' ? 'active' : statusRaw || null;
        return {
          id_code: idCode,
          name,
          description: null,
          client_name: p?.client_name ?? null,
          client_party_id: p?.client_party_id ?? null,
          responsible_name: null,
          logo_url: p?.logo_url ?? null,
          start_date: p?.start_date ?? null,
          end_date: p?.end_date ?? null,
          team_member_ids: null,
          status,
          current_stage: null,
          stages: null,
          contract_total: null,
          burn_cost_total: null,
          updated_at: null,
        } as Project;
      })
      .filter((x): x is Project => !!x);

    this.projectService.setProjectsFromExternal(mapped);
    this.isLoading = false;
  }

  private loadStages(projectIdCode: string): void {
    this.isLoadingStages = true;
    this.projectService.getProjectById(projectIdCode).subscribe({
      next: (p) => {
        const rawStages: any[] = Array.isArray((p as any)?.stages) ? ((p as any).stages as any[]) : [];
        this.stages = rawStages
          .map((s, idx) => {
            const id = String(s?.id_code || s?.id || `${idx + 1}`).trim();
            const title = String(s?.title || s?.name || '').trim();
            if (!title) return null;
            return {
              id_code: id,
              title,
              acronym: s?.acronym ? String(s.acronym) : (s?.code ? String(s.code) : null),
              status: s?.status ? String(s.status) : null,
              due_date: s?.due_date ? String(s.due_date) : null,
              color_1: s?.color_1 ? String(s.color_1) : (s?.color ? String(s.color) : null),
              total_minutes: s?.total_minutes !== undefined ? Number(s.total_minutes) : 0,
              total_amount: s?.total_amount !== undefined ? Number(s.total_amount) : 0,
            } as StageItem;
          })
          .filter((x): x is StageItem => !!x);
        const match = this.selectedStageIdCode ? this.stages.find((s) => s.id_code === this.selectedStageIdCode) : null;
        if (match) this.selectedStage = match;
        this.isLoadingStages = false;
      },
      error: () => {
        this.stages = [];
        this.isLoadingStages = false;
      },
    });
  }

  private loadGlobalToday(storeId: string): void {
    this.globalLoading = true;
    this.projectService.getMeToday(storeId).subscribe({
      next: (resp) => {
        const data = resp?.data || {};
        const meta = resp?.meta?.totals || {};
        
        this.sessionCheckInAt = data?.session?.check_in_at || null;
        
        this.generalConfirmedMinutes = Number(meta.confirmed_general_minutes || 0);
        const rg = data.running_general;
        this.isGeneralRunning = !!rg;
        this.generalTimeEntryId = rg?.id_code || '';
        this.generalRunningMinutesEstimated = Number(rg?.minutes_estimated || 0);
        this.generalHeartbeatLocalMs = Date.now();

        this.taskConfirmedMinutes = Number(meta.confirmed_task_minutes || 0);
        const rt = data.running_task;
        this.isTaskRunning = !!rt;
        this.taskTimeEntryId = rt?.id_code || '';
        this.taskRunningProjectIdCode = rt?.project?.id_code || '';
        this.taskRunningStageIdCode = rt?.stage?.id_code || '';
        this.taskRunningMinutesEstimated = Number(rt?.minutes_estimated || 0);
        this.taskHeartbeatLocalMs = Date.now();

        this.globalLastSyncLocalMs = Date.now();
        this.globalLoading = false;
        this.taskLoading = false;

        if (this.isGeneralRunning || this.isTaskRunning) {
          // Sync local timer for ticking
          const dateKey = this.timer.getDateKey(new Date());
          if (this.isTaskRunning) {
            this.timer.start(this.taskRunningProjectIdCode, dateKey, this.taskRunningStageIdCode);
          }
          this.startHeartbeatLoop(storeId);
        } else {
          this.stopHeartbeatLoop();
        }
      },
      error: () => {
        this.globalLoading = false;
        this.taskLoading = false;
      }
    });
  }

  private startTask(storeId: string, projectId?: string, stageId?: string): void {
    // Session is required for any task
    if (!this.sessionCheckInAt) {
      if (this.globalLoading) return;
      this.startGlobalSessionAndTask(storeId, projectId, stageId);
      return;
    }

    if (this.taskLoading) return; 
    this.taskLoading = true;
    
    const payload = {
      description: null,
      project_id: projectId || null,
      stage_id: stageId || null
    };

    this.projectService.startTimeEntry(storeId, payload).subscribe({
      next: (startResp) => {
        const d = startResp?.data || {};
        const id = String(d.time_entry_id || d.id || '').trim();
        if (!id) {
          this.taskLoading = false;
          return;
        }
        this.isTaskRunning = true;
        this.taskTimeEntryId = id;
        this.taskRunningProjectIdCode = d.project?.id_code || projectId || '';
        this.taskRunningStageIdCode = d.stage?.id_code || stageId || '';
        this.taskRunningMinutesEstimated = 0;
        // Sync local timer for ticking
        const dateKey = this.timer.getDateKey(new Date());
        this.timer.start(this.taskRunningProjectIdCode, dateKey, this.taskRunningStageIdCode);

        this.taskLoading = false;
        this.heartbeatOnce(storeId, id, 'task');
        this.startHeartbeatLoop(storeId);
      },
      error: () => {
        this.taskLoading = false;
      }
    });
  }

  private startGlobalSessionAndTask(storeId: string, projectId?: string, stageId?: string): void {
    this.globalLoading = true;
    this.projectService.checkIn(storeId, { source: 'web' }).subscribe({
      next: (resp) => {
        const d = resp?.data || {};
        this.sessionCheckInAt = d.check_in_at || new Date().toISOString();
        
        const payload = {
          description: null,
          project_id: projectId || null,
          stage_id: stageId || null
        };

        this.projectService.startTimeEntry(storeId, payload).subscribe({
          next: (startResp) => {
            const sd = startResp?.data || {};
            const id = String(sd.time_entry_id || sd.id || '').trim();
            if (!id) {
              this.globalLoading = false;
              return;
            }

            const isTask = !!(projectId || stageId);
            if (isTask) {
              this.isTaskRunning = true;
              this.taskTimeEntryId = id;
              this.taskRunningProjectIdCode = sd.project?.id_code || projectId || '';
              this.taskRunningStageIdCode = sd.stage?.id_code || stageId || '';
              this.taskRunningMinutesEstimated = 0;
              this.taskHeartbeatLocalMs = Date.now();
              const dateKey = this.timer.getDateKey(new Date());
              this.timer.start(this.taskRunningProjectIdCode, dateKey, this.taskRunningStageIdCode);
            } else {
              this.isGeneralRunning = true;
              this.generalTimeEntryId = id;
              this.generalRunningMinutesEstimated = 0;
              this.generalHeartbeatLocalMs = Date.now();
            }

            this.globalLastSyncLocalMs = Date.now();
            this.globalLoading = false;
            
            // Immediate sync
            if (isTask) this.heartbeatOnce(storeId, id, 'task');
            else this.heartbeatOnce(storeId, id, 'general');
            
            this.startHeartbeatLoop(storeId);
          },
          error: (err) => {
            if (err?.status === 409) {
              this.loadGlobalToday(storeId);
            } else {
              this.globalLoading = false;
            }
          }
        });
      },
      error: () => {
        this.globalLoading = false;
      }
    });
  }

  private stopGlobal(storeId: string): void {
    if (!this.isGeneralRunning || this.globalLoading) return;
    this.globalLoading = true;
    this.projectService.stopTimeEntry(storeId, this.generalTimeEntryId).subscribe({
      next: (resp) => {
        const dataArr = Array.isArray(resp?.data) ? resp.data : [resp?.data];
        
        dataArr.forEach((d: any) => {
          if (d.time_entry_id === this.generalTimeEntryId) {
            this.generalConfirmedMinutes += Number(d.minutes || 0);
          } else if (d.time_entry_id === this.taskTimeEntryId) {
            this.taskConfirmedMinutes += Number(d.minutes || 0);
          }
        });

        this.isGeneralRunning = false;
        this.generalTimeEntryId = '';
        this.generalRunningMinutesEstimated = 0;
        
        this.isTaskRunning = false;
        this.taskTimeEntryId = '';
        this.taskRunningProjectIdCode = '';
        this.taskRunningStageIdCode = '';
        this.taskRunningMinutesEstimated = 0;

        this.sessionCheckInAt = null; 
        this.globalLastSyncLocalMs = Date.now();
        this.globalLoading = false;
        // Clear task selection — closed tasks should not appear selected on next session start
        this.selectedStageIdCode = '';
        this.selectedStage = null;
        if (this.selectedProjectIdCode) {
          const dateKey = this.timer.getDateKey(new Date());
          this.stageHistory.setActiveStage(dateKey, this.selectedProjectIdCode, null);
        }
        this.stopHeartbeatLoop();
        this.timer.stopAllRunning();
        this.closeStages();
      },
      error: (err) => {
        if (err?.status === 409) {
          this.loadGlobalToday(storeId);
        } else {
          this.globalLoading = false;
        }
      },
    });
  }

  private startHeartbeatLoop(storeId: string): void {
    this.stopHeartbeatLoop();
    this.heartbeatIntervalId = setInterval(() => {
      if (this.isGeneralRunning) this.heartbeatOnce(storeId, this.generalTimeEntryId, 'general');
      if (this.isTaskRunning) this.heartbeatOnce(storeId, this.taskTimeEntryId, 'task');
      this.globalLastSyncLocalMs = Date.now();
    }, 60_000);
  }

  private stopHeartbeatLoop(): void {
    if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId);
    this.heartbeatIntervalId = null;
    this.globalSyncing = false;
  }

  private heartbeatOnce(storeId: string, timeEntryId: string, type: 'general' | 'task'): void {
    this.globalSyncing = true;
    this.projectService.heartbeatTimeEntry(storeId, timeEntryId).subscribe({
      next: (resp) => {
        const d = resp?.data || {};
        const minutesEstimated = Number(d.minutes_estimated ?? 0);

        if (type === 'general') {
          this.generalRunningMinutesEstimated = minutesEstimated;
          this.generalHeartbeatLocalMs = Date.now();
        } else {
          this.taskRunningMinutesEstimated = minutesEstimated;
          this.taskHeartbeatLocalMs = Date.now();
        }

        this.globalLastSyncLocalMs = Date.now();
        this.globalSyncing = false;

        // Update live stats from heartbeat
        if (d.project && d.project.id_code) {
          const pIdx = this.projects.findIndex(p => p.id_code === d.project.id_code);
          if (pIdx > -1) {
            this.projects[pIdx] = {
              ...this.projects[pIdx],
              burn_minutes: d.project.burn_minutes,
              burn_cost_total: d.project.burn_cost_total
            };
          }
        }

        if (d.stage && d.stage.id_code) {
          const sIdx = this.stages.findIndex(s => s.id_code === d.stage.id_code);
          if (sIdx > -1) {
            this.stages[sIdx] = {
              ...this.stages[sIdx],
              total_minutes: d.stage.total_minutes,
              total_amount: d.stage.total_amount
            };
          }
          const hIdx = this.stageHistoryItems.findIndex(s => s.id_code === d.stage.id_code);
          if (hIdx > -1) {
            this.stageHistoryItems[hIdx] = {
              ...this.stageHistoryItems[hIdx],
              total_minutes: d.stage.total_minutes,
              total_amount: d.stage.total_amount
            };
          }
        }
      },
      error: () => {
        this.globalSyncing = false;
      },
    });
  }

  private restoreProjectStageHistory(projectIdCode: string): void {
    const dateKey = this.timer.getDateKey(new Date());
    const hist = this.stageHistory.getProjectHistory(dateKey, projectIdCode);
    this.stageHistoryItems = (hist.stages || []).map((s) => ({
      id_code: s.id_code,
      title: s.title,
      acronym: s.acronym,
      status: null,
      due_date: null,
      color_1: s.color_1,
    }));
    const activeId = hist.active_stage_id_code;
    if (activeId) {
      const st = this.stageHistoryItems.find((x) => x.id_code === activeId) || null;
      this.selectedStageIdCode = activeId;
      this.selectedStage = st;
    } else {
      this.selectedStageIdCode = '';
      this.selectedStage = null;
    }
  }

  private upsertStageHistory(projectIdCode: string, s: StageItem): void {
    const dateKey = this.timer.getDateKey(new Date());
    const hist = this.stageHistory.getProjectHistory(dateKey, projectIdCode);
    const alreadyInList = hist.stages.some((x) => x.id_code === s.id_code);

    if (alreadyInList) {
      // Only update the active pointer — DO NOT reorder
      this.stageHistory.setActiveStage(dateKey, projectIdCode, s.id_code);
    } else {
      // New stage: add to top of list
      this.stageHistory.addStage(dateKey, projectIdCode, {
        id_code: s.id_code,
        title: s.title,
        acronym: s.acronym,
        color_1: s.color_1,
      });
    }
    this.restoreProjectStageHistory(projectIdCode);
  }
}
