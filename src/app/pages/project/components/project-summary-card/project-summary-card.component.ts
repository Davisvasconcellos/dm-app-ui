import { Component, Input } from '@angular/core';
import { Project, ProjectStage } from '../../project.types';

@Component({
  selector: 'app-project-summary-card',
  standalone: false,
  templateUrl: './project-summary-card.component.html',
})
export class ProjectSummaryCardComponent {
  @Input({ required: true }) project!: Project;
  @Input() viewMode: 'financial' | 'deadline' = 'financial';

  get stages(): ProjectStage[] {
    const list = this.project?.stages || [];
    return [...list].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }

  private get currentStageOrder(): number {
    const s = this.stages.find((x) => x.acronym === this.project?.current_stage);
    return s?.order_index || 0;
  }

  segmentClass(s: ProjectStage): string {
    const isCompleted = (s.order_index || 0) < this.currentStageOrder;
    const isCurrent = s.acronym === this.project?.current_stage;
    if (isCurrent) return 'bg-brand-500';
    if (isCompleted) return 'bg-emerald-500/70';
    return 'bg-gray-200 dark:bg-white/10';
  }

  get contractTotal(): number {
    return Number(this.project?.contract_total || 0);
  }

  get burnCostTotal(): number {
    return Number(this.project?.burn_cost_total || 0);
  }

  get burnPct(): number {
    const total = this.contractTotal;
    if (!total) return 0;
    return Math.max(0, Math.min(1, this.burnCostTotal / total));
  }

  get burnPctLabel(): string {
    return `${Math.round(this.burnPct * 100)}%`;
  }

  get burnIndicatorClass(): string {
    if (this.burnPct >= 0.85) return 'bg-red-500';
    if (this.burnPct >= 0.7) return 'bg-amber-400';
    return 'bg-emerald-500';
  }

  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  }

  get currentStage(): ProjectStage | null {
    return this.stages.find((s) => s.acronym === this.project?.current_stage) || null;
  }

  get currentStageName(): string {
    return this.currentStage?.title || '';
  }

  get currentStageDueDateLabel(): string {
    const d = this.currentStage?.due_date;
    if (!d) return '—';
    try {
      return new Intl.DateTimeFormat('pt-BR').format(new Date(d));
    } catch {
      return d;
    }
  }

  get currentStageDaysRemainingLabel(): string {
    const d = this.currentStage?.due_date;
    if (!d) return '—';
    const due = new Date(d);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (!Number.isFinite(days)) return '—';
    if (days < 0) return `${Math.abs(days)}d atrasado`;
    return `${days}d`;
  }
}
