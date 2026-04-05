import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { StoreContextService, Store } from '../../../../shared/services/store-context.service';
import { StoreInviteService, StoreInvite } from '../../../admin/stores/config/store-invite.service';
import { ProjectService } from '../../project.service';
import { Project, ProjectInvoiceRow, ProjectMember } from '../../project.types';

@Component({
  selector: 'app-project-admin-dashboard',
  standalone: false,
  templateUrl: './project-admin-dashboard.component.html',
})
export class ProjectAdminDashboardComponent implements OnInit, OnDestroy {
  private projectService = inject(ProjectService);
  private storeContext = inject(StoreContextService);
  private storeInviteService = inject(StoreInviteService);

  private sub = new Subscription();

  viewMode: 'financial' | 'deadline' = 'financial';
  isLoadingProjects = true;
  projects: Project[] = [];
  invoices: ProjectInvoiceRow[] = [];
  members: ProjectMember[] = [];
  activeStore: Store | null = null;

  ngOnInit(): void {
    this.sub.add(
      this.projectService.listProjects().subscribe((p) => {
        this.projects = p || [];
        this.isLoadingProjects = false;
      })
    );

    this.sub.add(
      this.projectService.listInvoices().subscribe((rows) => {
        this.invoices = rows || [];
      })
    );

    this.sub.add(
      this.projectService.listMembers().subscribe((rows) => {
        this.members = rows || [];
      })
    );

    this.sub.add(
      this.storeContext.activeStore$.subscribe((st) => {
        this.activeStore = st;
        if (!st?.id_code) return;
        this.loadStoreCollaborators(st.id_code);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private loadStoreCollaborators(storeIdCode: string): void {
    this.storeInviteService.listInvites(storeIdCode).subscribe({
      next: (res) => {
        const allInvites: StoreInvite[] = (res?.data || []) as StoreInvite[];
        const accepted = allInvites.filter((i) => i.status === 'accepted' && i.store_member_status === 'active');
        const mapped: ProjectMember[] = accepted.map((i) => {
          const email = i.invited_email || '';
          const stableId = i.store_member_id_code || i.member_id_code || email || i.id_code;
          const name = (email || '').split('@')[0] || stableId;
          return {
            id_code: stableId,
            member_id_code: i.store_member_id_code || i.member_id_code || null,
            name,
            email: email || null,
            role: i.role,
            avatar_url: null,
            cost_per_hour: null,
            status: 'offline',
            today_project_pct: 0,
            today_office_pct: 100,
            current_project_id_code: null,
            current_project_name: null,
          };
        });
        if (mapped.length > 0) this.projectService.setMembersFromExternal(mapped);
      },
    });
  }

  get cashFlowGroups(): { month: string; rows: ProjectInvoiceRow[] }[] {
    const byMonth = new Map<string, ProjectInvoiceRow[]>();
    for (const r of this.invoices) {
      const month = (r.month || '').trim() || (r.expected_date ? r.expected_date.slice(0, 7) : '');
      const key = month || '—';
      const prev = byMonth.get(key) || [];
      prev.push(r);
      byMonth.set(key, prev);
    }

    return Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, rows]) => ({
        month,
        rows: [...rows].sort((x, y) => String(x.project_name || '').localeCompare(String(y.project_name || ''))),
      }));
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  }

  monthLabel(yyyyMm: string): string {
    if (!yyyyMm || yyyyMm === '—') return 'Sem mês';
    const [y, m] = yyyyMm.split('-');
    const dt = new Date(Number(y), Number(m) - 1, 1);
    try {
      return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(dt);
    } catch {
      return yyyyMm;
    }
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
}
