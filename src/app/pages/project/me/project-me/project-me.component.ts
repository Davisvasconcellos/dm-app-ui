import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { StoreContextService, Store } from '../../../../shared/services/store-context.service';
import { StoreInviteService, StoreInvite } from '../../../admin/stores/config/store-invite.service';
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
  private storeInviteService = inject(StoreInviteService);
  private sub = new Subscription();

  members: ProjectMember[] = [];
  projects: Project[] = [];
  myMember: ProjectMember | null = null;
  activeStore: Store | null = null;

  ngOnInit(): void {
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
        if (!st?.id_code) return;
        this.storeInviteService.listInvites(st.id_code).subscribe({
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
}
