import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ToastService } from '../../../../shared/services/toast.service';
import { StoreContextService, Store } from '../../../../shared/services/store-context.service';
import { ProjectService } from '../../project.service';
import { Project, ProjectMember, ProjectStatus, ProjectStage } from '../../project.types';

type StatusFilter = 'active' | 'draft' | 'paused' | 'canceled';
type ViewMode = 'cards' | 'columns';

@Component({
  selector: 'app-project-list',
  standalone: false,
  templateUrl: './project-list.component.html',
})
export class ProjectListComponent implements OnInit, OnDestroy {
  private projectService = inject(ProjectService);
  private toast = inject(ToastService);
  private storeContext = inject(StoreContextService);
  private sub = new Subscription();

  isLoading = true;
  isUpdatingStatus = false;

  projects: Project[] = [];
  filteredProjects: Project[] = [];
  members: ProjectMember[] = [];
  activeStore: Store | null = null;

  statusFilter: StatusFilter = 'active';
  viewMode: ViewMode = 'cards';

  activeCount = 0;
  draftCount = 0;
  pausedCount = 0;
  canceledCount = 0;

  ngOnInit(): void {
    this.sub.add(this.projectService.listProjects().subscribe((items) => {
      this.projects = items || [];
      this.applyFilter();
    }));
    this.sub.add(this.projectService.listMembers().subscribe((m) => (this.members = m || [])));
    this.sub.add(
      this.storeContext.activeStore$.subscribe((st) => {
        this.activeStore = st;
        this.isLoading = true;
        this.sub.add(
          this.projectService.refreshProjects(st?.id_code || null).subscribe({
            next: (items) => {
              this.projects = items || [];
              this.applyFilter();
              this.isLoading = false;
            },
            error: () => {
              this.isLoading = false;
            },
          })
        );
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  setFilter(filter: StatusFilter): void {
    this.statusFilter = filter;
    this.applyFilter();
  }

  private applyFilter(): void {
    this.activeCount = this.projects.filter((p) => this.normalizedStatus(p.status) === 'active').length;
    this.draftCount = this.projects.filter((p) => !p.status || p.status === 'draft').length;
    this.pausedCount = this.projects.filter((p) => p.status === 'paused').length;
    this.canceledCount = this.projects.filter((p) => p.status === 'canceled').length;

    if (this.statusFilter === 'active') {
      this.filteredProjects = this.projects.filter((p) => this.normalizedStatus(p.status) === 'active');
    } else if (this.statusFilter === 'draft') {
      this.filteredProjects = this.projects.filter((p) => !p.status || p.status === 'draft');
    } else {
      this.filteredProjects = this.projects.filter((p) => p.status === this.statusFilter);
    }
  }

  private router = inject(Router);
  
  // ... existing injects ...
  
  onEditProject(p: Project): void {
    this.router.navigate(['/project/admin/projects/edit', p.id_code]);
  }

  onDeleteProject(p: Project): void {
    if (!confirm(`Deseja realmente excluir o projeto "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    this.isUpdatingStatus = true;
    this.projectService.deleteProject(p.id_code).subscribe({
      next: (ok) => {
        this.isUpdatingStatus = false;
        if (ok) {
          this.toast.triggerToast('success', 'Excluído', 'Projeto removido com sucesso.');
        } else {
          this.toast.triggerToast('error', 'Erro', 'Falha ao excluir projeto.');
        }
      },
      error: () => {
        this.isUpdatingStatus = false;
        this.toast.triggerToast('error', 'Erro', 'Falha ao excluir projeto.');
      }
    });
  }

  onPublishProject(p: Project): void {
    this.setProjectStatus(p, 'active');
  }

  onTogglePause(p: Project): void {
    const normalized = this.normalizedStatus(p.status);
    if (normalized === 'canceled') return;
    const next: ProjectStatus = normalized === 'paused' ? 'active' : 'paused';
    this.setProjectStatus(p, next);
  }

  onToggleCancel(p: Project): void {
    const normalized = this.normalizedStatus(p.status);
    const next: ProjectStatus = normalized === 'canceled' ? 'active' : 'canceled';
    this.setProjectStatus(p, next);
  }

  private setProjectStatus(p: Project, status: ProjectStatus): void {
    if (this.isUpdatingStatus) return;
    this.isUpdatingStatus = true;
    this.projectService.updateProjectStatus(p.id_code, status).subscribe({
      next: (ok) => {
        this.isUpdatingStatus = false;
        if (!ok) {
          this.toast.triggerToast('error', 'Erro', 'Falha ao atualizar status do projeto.');
          return;
        }
        const label = this.statusLabel(status);
        this.toast.triggerToast('success', 'OK', `Projeto atualizado: ${label}.`);
      },
      error: () => {
        this.isUpdatingStatus = false;
        this.toast.triggerToast('error', 'Erro', 'Falha ao atualizar status do projeto.');
      },
    });
  }

  normalizedStatus(status?: ProjectStatus | null): ProjectStatus {
    if (status === 'published') return 'active';
    return (status || 'draft') as ProjectStatus;
  }

  statusLabel(status?: ProjectStatus | null): string {
    if (status === 'active' || status === 'published') return 'Ativo';
    if (status === 'paused') return 'Pausado';
    if (status === 'canceled') return 'Cancelado';
    return 'Rascunho';
  }

  statusPillClass(status?: ProjectStatus | null): string {
    if (status === 'active' || status === 'published') return 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200';
    if (status === 'paused') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200';
    if (status === 'canceled') return 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-200';
    return 'bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200';
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  }

  burnPctLabel(p: Project): string {
    const total = Number(p.contract_total || 0);
    const burn = Number(p.burn_cost_total || 0);
    if (!total) return '0%';
    const pct = Math.max(0, Math.min(1, burn / total));
    return `${Math.round(pct * 100)}%`;
  }

  projectLogoLetter(p: Project): string {
    const name = String(p?.name || '').trim();
    return (name[0] || 'P').toUpperCase();
  }

  formatShortDate(iso?: string | null): string {
    if (!iso) return '—';
    try {
      const dt = new Date(iso);
      return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(dt);
    } catch {
      return iso;
    }
  }

  progressPct(p: Project): number {
    const stages = Array.isArray(p?.stages) ? (p.stages as ProjectStage[]) : [];
    const total = stages.length || 0;
    if (!total) return 0;
    const current = stages.find((s) => s.acronym === p.current_stage);
    const order = Number(current?.order_index || 0);
    const maxOrder = Math.max(...stages.map((s) => Number(s.order_index || 0)));
    if (!maxOrder) return 0;
    const pct = Math.max(0, Math.min(1, order / maxOrder));
    return Math.round(pct * 100);
  }

  teamForProject(p: Project): ProjectMember[] {
    if (Array.isArray(p.members) && p.members.length > 0) return p.members;
    
    // Fallback para IDs se necessário
    const ids = Array.isArray(p.team_member_ids) ? p.team_member_ids : [];
    if (ids.length > 0) {
      const byId = new Map(this.members.map((m) => [m.id_code, m]));
      return ids.map((id) => byId.get(id)).filter((x): x is ProjectMember => !!x);
    }
    return [];
  }

  memberInitials(m: ProjectMember): string {
    const name = String(m?.name || '').trim();
    const parts = name.split(' ').filter(Boolean);
    const first = parts[0]?.[0] || 'U';
    const last = parts.length > 1 ? parts.at(-1)?.[0] : '';
    return `${first}${last}`.toUpperCase();
  }
}
