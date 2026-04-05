import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
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
  invitesLoading = false;
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
  globalRunning = false;
  globalTimeEntryId = '';
  globalConfirmedMinutes = 0;
  globalRunningMinutesEstimated = 0;
  globalHeartbeatLocalMs = 0;
  globalLastSyncLocalMs = 0;
  globalSyncing = false;

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
          if (this.selectedProjectIdCode) this.restoreProjectStageHistory(this.selectedProjectIdCode);
          this.loadGlobalToday(st.id_code);
        } else {
          this.globalLoading = false;
          this.globalRunning = false;
          this.globalTimeEntryId = '';
          this.globalConfirmedMinutes = 0;
          this.globalRunningMinutesEstimated = 0;
          this.globalHeartbeatLocalMs = 0;
          this.globalLastSyncLocalMs = 0;
          this.globalSyncing = false;
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
    if (!pid) return;
    this.selectedStageIdCode = s.id_code;
    this.selectedStage = s;
    this.upsertStageHistory(pid, s);
    const dateKey = this.timer.getDateKey(new Date());
    if (this.globalRunning) this.timer.start(pid, dateKey, s.id_code);
    this.closeStages();
  }

  toggleTimer(): void {
    const storeId = (this.activeStore?.id_code || '').trim();
    if (!storeId) return;
    if (this.globalRunning) {
      this.stopGlobal(storeId);
    } else {
      this.startGlobal(storeId);
    }
  }

  get isTimerRunning(): boolean {
    return this.globalRunning;
  }

  get todayTotalLabel(): string {
    const totalSeconds =
      Math.max(0, Math.floor(this.globalConfirmedMinutes * 60)) +
      (this.globalRunning
        ? Math.max(0, Math.floor(this.globalRunningMinutesEstimated * 60) + Math.floor((this.nowMs - this.globalHeartbeatLocalMs) / 1000))
        : 0);
    return this.formatDurationHms(totalSeconds * 1000);
  }

  get globalHeartbeatProgressPercent(): number {
    if (!this.globalRunning) return 0;
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
    if (!pid) return;
    if (this.selectedStageIdCode === s.id_code) {
      this.openStagesForSelectedProject();
      return;
    }
    this.selectedStageIdCode = s.id_code;
    this.selectedStage = s;
    this.upsertStageHistory(pid, s);
    if (this.globalRunning) {
      const dateKey = this.timer.getDateKey(new Date());
      this.timer.start(pid, dateKey, s.id_code);
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
    this.projectService.getMyScope().subscribe({
      next: (itemsRaw) => {
        const parsed = (itemsRaw || [])
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

        this.scopeItems = parsed;
        this.scopeLoading = false;
        this.scopeEmpty = parsed.length === 0;
        if (this.scopeEmpty) this.loadPendingInvites();
        else {
          this.pendingInvites = [];
          this.invitesLoading = false;
        }

        const current = this.storeContext.getActiveStore();
        if (current?.id_code) {
          const match = parsed.find((x) => x.store.id_code === current.id_code);
          if (match) {
            this.applyScopeProjects(match);
            return;
          }
          this.storeContext.setActiveStore(null);
        }

        if (parsed.length === 1) {
          this.selectScopeStore(parsed[0]);
        } else if (parsed.length === 0) {
          this.projectService.setProjectsFromExternal([]);
          this.isLoading = false;
        }
      },
      error: () => {
        this.scopeItems = [];
        this.scopeLoading = false;
        this.scopeEmpty = true;
        this.loadPendingInvites();
        this.projectService.setProjectsFromExternal([]);
        this.storeContext.setActiveStore(null);
        this.isLoading = false;
      },
    });
  }

  private loadPendingInvites(): void {
    this.invitesLoading = true;
    this.inviteService.getMyInvites('pending').subscribe({
      next: (res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        this.pendingInvites = list.filter((i) => i.status === 'pending');
        this.invitesLoading = false;
      },
      error: () => {
        this.pendingInvites = [];
        this.invitesLoading = false;
      },
    });
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
            this.router.navigate(['/'], { replaceUrl: true });
          },
          error: () => {
            this.processingInvites.delete(inv.id_code);
            this.storeContext.setActiveStore(null);
            this.router.navigate(['/'], { replaceUrl: true });
          },
        });
      },
      error: () => {
        this.toast.triggerToast('error', 'Erro', 'Não foi possível aceitar o convite.');
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
        const data = resp?.data || resp?.body?.data || null;
        const metaTotals = resp?.meta?.totals || resp?.body?.meta?.totals || null;
        const confirmed = Number(metaTotals?.confirmed_minutes ?? data?.meta?.totals?.confirmed_minutes ?? 0);
        const running = data?.running || null;
        const id = String(running?.id || running?.time_entry_id || '').trim();
        const minutesEstimated = Number(running?.minutes_estimated ?? 0);

        this.globalConfirmedMinutes = Number.isFinite(confirmed) ? confirmed : 0;
        this.globalRunning = !!id;
        this.globalTimeEntryId = id || '';
        this.globalRunningMinutesEstimated = this.globalRunning && Number.isFinite(minutesEstimated) ? minutesEstimated : 0;
        this.globalHeartbeatLocalMs = Date.now();
        this.globalLastSyncLocalMs = Date.now();
        this.globalLoading = false;

        if (this.globalRunning && this.globalTimeEntryId) {
          this.startHeartbeatLoop(storeId, this.globalTimeEntryId);
        } else {
          this.stopHeartbeatLoop();
        }
      },
      error: () => {
        this.globalLoading = false;
        this.globalRunning = false;
        this.globalTimeEntryId = '';
        this.globalRunningMinutesEstimated = 0;
        this.stopHeartbeatLoop();
      },
    });
  }

  private startGlobal(storeId: string): void {
    if (this.globalLoading) return;
    this.globalLoading = true;
    this.projectService.checkIn(storeId, { source: 'web' }).subscribe({
      next: () => {
        this.projectService.startGlobalTimeEntry(storeId, 'Expediente').subscribe({
          next: (startResp) => {
            const id = String(startResp?.data?.time_entry_id || startResp?.data?.id || startResp?.data?.timeEntryId || '').trim();
            if (!id) {
              this.globalLoading = false;
              return;
            }
            this.globalRunning = true;
            this.globalTimeEntryId = id;
            this.globalRunningMinutesEstimated = 0;
            this.globalHeartbeatLocalMs = Date.now();
            this.globalLastSyncLocalMs = Date.now();
            this.globalLoading = false;
            this.heartbeatOnce(storeId, id);
            this.startHeartbeatLoop(storeId, id);
          },
          error: () => {
            this.globalLoading = false;
          },
        });
      },
      error: () => {
        this.globalLoading = false;
      },
    });
  }

  private stopGlobal(storeId: string): void {
    const id = String(this.globalTimeEntryId || '').trim();
    if (!id || this.globalLoading) return;
    this.globalLoading = true;
    this.projectService.stopTimeEntry(storeId, id).subscribe({
      next: (resp) => {
        const minutes = Number(resp?.data?.minutes ?? 0);
        if (Number.isFinite(minutes) && minutes > 0) this.globalConfirmedMinutes += minutes;
        this.globalRunning = false;
        this.globalTimeEntryId = '';
        this.globalRunningMinutesEstimated = 0;
        this.globalHeartbeatLocalMs = Date.now();
        this.globalLastSyncLocalMs = Date.now();
        this.globalLoading = false;
        this.stopHeartbeatLoop();
        this.timer.stopAllRunning();
        this.closeStages();
      },
      error: () => {
        this.globalLoading = false;
      },
    });
  }

  private startHeartbeatLoop(storeId: string, timeEntryId: string): void {
    this.stopHeartbeatLoop();
    this.heartbeatIntervalId = setInterval(() => {
      this.heartbeatOnce(storeId, timeEntryId);
    }, 60_000);
  }

  private stopHeartbeatLoop(): void {
    if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId);
    this.heartbeatIntervalId = null;
    this.globalSyncing = false;
  }

  private heartbeatOnce(storeId: string, timeEntryId: string): void {
    if (!this.globalRunning) return;
    this.globalSyncing = true;
    this.projectService.heartbeatTimeEntry(storeId, timeEntryId).subscribe({
      next: (resp) => {
        const minutesEstimated = Number(resp?.data?.minutes_estimated ?? 0);
        const id = String(resp?.data?.time_entry_id || timeEntryId).trim();
        if (!id || id !== timeEntryId) return;
        if (Number.isFinite(minutesEstimated)) this.globalRunningMinutesEstimated = minutesEstimated;
        this.globalHeartbeatLocalMs = Date.now();
        this.globalLastSyncLocalMs = Date.now();
        this.globalSyncing = false;
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
    this.stageHistory.addStage(dateKey, projectIdCode, {
      id_code: s.id_code,
      title: s.title,
      acronym: s.acronym,
      color_1: s.color_1,
    });
    this.restoreProjectStageHistory(projectIdCode);
  }
}
