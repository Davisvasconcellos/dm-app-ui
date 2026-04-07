import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { StoreContextService, Store } from '../../../../shared/services/store-context.service';
import { ProjectService } from '../../project.service';
import { Project, ProjectInvoiceRow, ProjectMember } from '../../project.types';
import { ApexAxisChartSeries, ApexChart, ApexDataLabels, ApexStroke, ApexXAxis, ApexYAxis, ApexTooltip, ApexGrid, ApexLegend } from 'ng-apexcharts';

@Component({
  selector: 'app-project-admin-dashboard',
  standalone: false,
  templateUrl: './project-admin-dashboard.component.html',
})
export class ProjectAdminDashboardComponent implements OnInit, OnDestroy {
  private projectService = inject(ProjectService);
  private storeContext = inject(StoreContextService);

  private sub = new Subscription();

  isLoading = true;
  activeStore: Store | null = null;

  // Filters
  readonly ALL_PROJECTS_KEY = '__all__';
  availableProjects: Project[] = [];
  selectedProjectIds = new Set<string>([this.ALL_PROJECTS_KEY]);
  
  periods = [7, 15, 30, 60, 90, 'custom'] as const;
  selectedPeriod: number | 'custom' = 30;
  isPeriodDropdownOpen = false;
  start_date: string = '';
  end_date: string = '';

  // Data
  kpis = {
    total_contract: 0,
    total_burn_cost: 0,
    total_burn_minutes: 0,
    active_projects: 0,
    active_members: 0,
    margin_value: 0
  };

  compare_to_previous: any = null;
  timeseries: any[] = [];
  top_projects: any[] = [];
  top_members: any[] = [];

  // Chart
  chartSeries: ApexAxisChartSeries = [{ name: 'Custo (Burn)', data: [] }];
  chartOptions: any = {
    chart: { type: 'line', height: 320, toolbar: { show: false }, fontFamily: 'Outfit, sans-serif' },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3, colors: ['#465FFF'] },
    xaxis: { categories: [], axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { formatter: (v: number) => this.currencyCompact(v) } },
    tooltip: {
      shared: true,
      y: { formatter: (v: number) => this.currency(v) }
    },
    grid: { strokeDashArray: 4, padding: { left: 20, right: 20 } },
    legend: { position: 'top', horizontalAlign: 'right' },
    colors: ['#465FFF']
  };

  ngOnInit(): void {
    this.initDates(30);

    // Initial load of all projects to populate filters
    this.sub.add(
      this.projectService.refreshProjects().subscribe(p => {
        this.availableProjects = p || [];
      })
    );

    this.sub.add(
      this.storeContext.activeStore$.subscribe((st) => {
        this.activeStore = st;
        if (st) this.applyFilters();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private initDates(days: number): void {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    this.start_date = start.toISOString().slice(0, 10);
    this.end_date = end.toISOString().slice(0, 10);
  }

  toggleProject(projectId: string): void {
    if (this.isLoading) return;
    if (projectId === this.ALL_PROJECTS_KEY) {
      this.selectedProjectIds = new Set([this.ALL_PROJECTS_KEY]);
      this.applyFilters();
      return;
    }

    const next = new Set(this.selectedProjectIds);
    if (next.has(this.ALL_PROJECTS_KEY)) next.delete(this.ALL_PROJECTS_KEY);

    if (next.has(projectId)) next.delete(projectId);
    else next.add(projectId);

    if (next.size === 0) next.add(this.ALL_PROJECTS_KEY);

    this.selectedProjectIds = next;
    this.applyFilters();
  }

  isProjectSelected(projectId: string): boolean {
    return this.selectedProjectIds.has(this.ALL_PROJECTS_KEY) || this.selectedProjectIds.has(projectId);
  }

  selectPeriod(p: number | 'custom'): void {
    if (this.isLoading) return;
    this.selectedPeriod = p;
    if (p !== 'custom') {
      this.initDates(p as number);
      this.applyFilters();
    }
  }

  applyCustomRange(): void {
    if (this.isLoading) return;
    this.selectedPeriod = 'custom';
    this.applyFilters();
  }

  onDateChange(event: any, field: 'start' | 'end'): void {
    const dateStr = event?.dateStr || event;
    if (!dateStr) return;
    if (field === 'start') this.start_date = dateStr;
    else this.end_date = dateStr;
    
    this.selectedPeriod = 'custom';
  }

  applyFilters(): void {
    this.isLoading = true;
    const project_ids = this.selectedProjectIds.has(this.ALL_PROJECTS_KEY) ? [] : Array.from(this.selectedProjectIds);
    
    this.projectService.refreshAdminDashboard({
      start_date: this.start_date,
      end_date: this.end_date,
      project_ids
    }).subscribe(data => {
      if (data) {
        this.kpis = data.kpis;
        this.compare_to_previous = data.compare_to_previous;
        this.timeseries = data.timeseries || [];
        this.top_projects = data.top_projects || [];
        this.top_members = data.top_members || [];

        // Update Chart
        const categories = this.timeseries.map(t => this.formatDateLabel(t.date));
        const costData = this.timeseries.map(t => t.cost);
        this.chartSeries = [{ name: 'Custo (Burn)', data: costData }];
        this.chartOptions = {
          ...this.chartOptions,
          xaxis: { ...this.chartOptions.xaxis, categories }
        };
      }
      this.isLoading = false;
    });
  }

  private formatDateLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  }

  // Delta helpers
  getDeltaPct(field: string): number | null {
    const v = this.compare_to_previous?.delta_pct?.[field];
    return typeof v === 'number' ? v : null;
  }

  getDeltaSign(field: string): 'up' | 'down' | 'neutral' {
    const d = this.compare_to_previous?.delta?.[field];
    if (d == null || d === 0) return 'neutral';
    return d > 0 ? 'up' : 'down';
  }

  formatDeltaPct(field: string): string {
    const pct = this.getDeltaPct(field);
    if (pct == null) return '—';
    return `${pct > 0 ? '+' : ''}${pct}%`;
  }

  // Formatting utilities
  currency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  }

  currencyCompact(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  formatMinutes(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return `${h}h ${m}m`;
  }

  togglePeriodDropdown(): void {
    this.isPeriodDropdownOpen = !this.isPeriodDropdownOpen;
  }
}
