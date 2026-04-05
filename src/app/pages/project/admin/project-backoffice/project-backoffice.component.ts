import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { StoreContextService, Store } from '../../../../shared/services/store-context.service';
import { StoreInviteService, StoreInvite } from '../../../admin/stores/config/store-invite.service';
import { ProjectService } from '../../project.service';
import { ProjectInvoiceRow, ProjectMember } from '../../project.types';

@Component({
  selector: 'app-project-backoffice',
  standalone: false,
  templateUrl: './project-backoffice.component.html',
})
export class ProjectBackofficeComponent implements OnInit, OnDestroy {
  private projectService = inject(ProjectService);
  private storeContext = inject(StoreContextService);
  private storeInviteService = inject(StoreInviteService);
  private sub = new Subscription();

  tab: 'invoices' | 'costs' = 'invoices';
  invoices: ProjectInvoiceRow[] = [];
  members: ProjectMember[] = [];
  activeStore: Store | null = null;

  isMarkPaidOpen = false;
  selectedInvoice: ProjectInvoiceRow | null = null;
  markPaidDate = new Date().toISOString().slice(0, 10);
  markPaidValue: number | null = null;
  isSavingInvoice = false;

  isEditCostOpen = false;
  selectedMember: ProjectMember | null = null;
  editCostValue: number | null = null;
  editCostEffectiveMode: 'today' | 'retro' = 'today';
  editCostEffectiveFrom: string = new Date().toISOString().slice(0, 10);
  isSavingCost = false;

  ngOnInit(): void {
    this.sub.add(this.projectService.listInvoices().subscribe((i) => (this.invoices = i || [])));
    this.sub.add(this.projectService.listMembers().subscribe((m) => (this.members = m || [])));

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

  get invoiceGroups(): { month: string; rows: ProjectInvoiceRow[] }[] {
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
      .map(([month, rows]) => ({ month, rows: [...rows].sort((x, y) => String(x.project_name || '').localeCompare(String(y.project_name || ''))) }));
  }

  openMarkPaid(r: ProjectInvoiceRow): void {
    this.selectedInvoice = r;
    this.markPaidDate = new Date().toISOString().slice(0, 10);
    this.markPaidValue = r.expected_value;
    this.isMarkPaidOpen = true;
  }

  closeMarkPaid(): void {
    this.isMarkPaidOpen = false;
    this.selectedInvoice = null;
    this.isSavingInvoice = false;
  }

  confirmMarkPaid(): void {
    if (!this.selectedInvoice) return;
    this.isSavingInvoice = true;
    this.projectService.markInvoicePaid(this.selectedInvoice.id_code, this.markPaidDate, this.markPaidValue).subscribe({
      next: () => {
        this.isSavingInvoice = false;
        this.closeMarkPaid();
      },
      error: () => {
        this.isSavingInvoice = false;
      },
    });
  }

  openEditCost(m: ProjectMember): void {
    this.selectedMember = m;
    this.editCostValue = m.cost_per_hour ?? null;
    this.editCostEffectiveMode = 'today';
    this.editCostEffectiveFrom = new Date().toISOString().slice(0, 10);
    this.isEditCostOpen = true;
  }

  closeEditCost(): void {
    this.isEditCostOpen = false;
    this.selectedMember = null;
    this.isSavingCost = false;
  }

  confirmEditCost(): void {
    if (!this.selectedMember) return;
    const effectiveFrom = this.editCostEffectiveMode === 'retro' ? this.editCostEffectiveFrom : new Date().toISOString().slice(0, 10);
    this.isSavingCost = true;
    this.projectService.upsertMemberCost(this.selectedMember.id_code, this.editCostValue, effectiveFrom).subscribe({
      next: () => {
        this.isSavingCost = false;
        this.closeEditCost();
      },
      error: () => {
        this.isSavingCost = false;
      },
    });
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
}
