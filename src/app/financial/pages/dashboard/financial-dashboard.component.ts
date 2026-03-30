import { ApplicationRef, Component, ComponentRef, EnvironmentInjector, Injector, OnDestroy, OnInit, createComponent, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule, ApexAxisChartSeries, ApexChart, ApexDataLabels, ApexStroke, ApexXAxis, ApexYAxis, ApexTooltip, ApexGrid, ApexLegend, ApexNonAxisChartSeries, ApexPlotOptions, ApexFill, ApexMarkers } from 'ng-apexcharts';
import { OrganizationService, OrganizationStore } from '../../../pages/admin/organizations/organization.service';
import { AuthService, User } from '../../../shared/services/auth.service';
import { FinancialAnalyticsDashboardV1, FinancialAnalyticsService } from '../../financial-analytics.service';
import { FinancialToastService } from '../../financial-toast.service';
import { DatePickerComponent } from '../../../shared/components/form/date-picker/date-picker.component';
import { DropdownComponent } from '../../../shared/components/ui/dropdown/dropdown.component';
import { DropdownItemComponent } from '../../../shared/components/ui/dropdown/dropdown-item/dropdown-item.component';
import { Subscription } from 'rxjs';
import { FinancialDashboardLoaderOverlayComponent } from './financial-dashboard-loader-overlay.component';

@Component({
  selector: 'app-financial-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, DatePickerComponent, DropdownComponent, DropdownItemComponent],
  templateUrl: './financial-dashboard.component.html',
})
export class FinancialDashboardComponent implements OnInit, OnDestroy {
  private orgService = inject(OrganizationService);
  private authService = inject(AuthService);
  private analytics = inject(FinancialAnalyticsService);
  private toast = inject(FinancialToastService);

  readonly ALL_STORES_KEY = '__all__';
  stores: Array<{ id_code: string; name: string }> = [{ id_code: this.ALL_STORES_KEY, name: 'Todos' }];
  selectedStoreIds = new Set<string>([this.ALL_STORES_KEY]);
  private pendingScopeStoreIds: string[] | null = null;

  periods = [7, 15, 30, 60, 90, 'custom'] as const;
  selectedPeriod: number | 'custom' = 30;
  isPeriodDropdownOpen = false;
  start_date: string = '';
  end_date: string = '';
  date_mode: 'cash' | 'competence' = 'cash';

  isLoading = false;
  private dashboardSub: Subscription | null = null;
  private appRef = inject(ApplicationRef);
  private injector = inject(Injector);
  private envInjector = inject(EnvironmentInjector);
  private loaderRef: ComponentRef<FinancialDashboardLoaderOverlayComponent> | null = null;

  kpis = {
    total_received: 0,
    total_paid: 0,
    balance: 0,
    receivable_open: 0,
    payable_open: 0,
    overdue_total: 0,
    overdue_receivable: 0,
    overdue_payable: 0,
  };

  timeseries: Array<{ date: string; received?: number; paid?: number; received_actual?: number; paid_actual?: number; received_planned?: number; paid_planned?: number }> = [];
  top_expense_categories: Array<{ category_id: string | null; category_name: string | null; total_paid: number }> = [];
  top_customers: Array<{ party_id: string | null; party_name: string | null; total_received: number }> = [];
  cost_centers: NonNullable<FinancialAnalyticsDashboardV1['cost_centers']> = [];
  selectedCostCenter: NonNullable<FinancialAnalyticsDashboardV1['cost_centers']>[number] | null = null;
  commissions = { pending_amount: 0, pending_count: 0, paid_amount: 0, paid_count: 0 };
  commission_inconsistencies: FinancialAnalyticsDashboardV1['commission_inconsistencies'] | null = null;
  compare_to_previous: FinancialAnalyticsDashboardV1['compare_to_previous'] | null = null;
  payment_methods: NonNullable<FinancialAnalyticsDashboardV1['payment_methods']> = { receivable: [], payable: [] };
  bank_accounts: NonNullable<FinancialAnalyticsDashboardV1['bank_accounts']> = [];
  tags: FinancialAnalyticsDashboardV1['tags'] | null = null;
  forecast_recurrences: FinancialAnalyticsDashboardV1['forecast_recurrences'] | null = null;
  upcoming = {
    receivable: [] as Array<{ id_code: string; due_date: string; description: string; amount: number; party_id: string | null; party_name: string | null; category_id: string | null; category_name: string | null }>,
    payable: [] as Array<{ id_code: string; due_date: string; description: string; amount: number; party_id: string | null; party_name: string | null; category_id: string | null; category_name: string | null }>,
  };

  chartSeries: ApexAxisChartSeries = [
    { name: 'Recebido (Realizado)', data: [] },
    { name: 'Recebido (Previsto)', data: [] },
    { name: 'Pago (Realizado)', data: [] },
    { name: 'Pago (Previsto)', data: [] },
  ];
  chartOptions: {
    chart: ApexChart;
    dataLabels: ApexDataLabels;
    stroke: ApexStroke;
    xaxis: ApexXAxis;
    yaxis: ApexYAxis;
    tooltip: ApexTooltip;
    grid: ApexGrid;
    legend: ApexLegend;
  } = {
    chart: { type: 'line', height: 320, toolbar: { show: false } },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    xaxis: { categories: [] },
    yaxis: { labels: { formatter: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v as number) } },
    tooltip: {
      shared: true,
      y: { formatter: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v as number) },
      custom: ({ series, dataPointIndex, w }: any) => {
        const label = w?.globals?.categoryLabels?.[dataPointIndex] || '';
        const receivedActual = Number(series?.[0]?.[dataPointIndex] ?? 0);
        const receivedPlanned = Number(series?.[1]?.[dataPointIndex] ?? 0);
        const paidActual = Number(series?.[2]?.[dataPointIndex] ?? 0);
        const paidPlanned = Number(series?.[3]?.[dataPointIndex] ?? 0);
        const netActual = receivedActual - paidActual;
        const netPlanned = receivedPlanned - paidPlanned;
        const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
        return `
          <div class="rounded-lg border border-gray-200 bg-white p-3 shadow-theme-sm dark:border-gray-800 dark:bg-[#1E2635]">
            <div class="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">${label}</div>
            <div class="space-y-1 text-xs text-gray-700 dark:text-gray-200">
              <div class="flex items-center justify-between gap-6"><span>Recebido (Realizado)</span><span class="font-medium">${fmt(receivedActual)}</span></div>
              <div class="flex items-center justify-between gap-6"><span>Recebido (Previsto)</span><span class="font-medium">${fmt(receivedPlanned)}</span></div>
              <div class="flex items-center justify-between gap-6"><span>Pago (Realizado)</span><span class="font-medium">${fmt(paidActual)}</span></div>
              <div class="flex items-center justify-between gap-6"><span>Pago (Previsto)</span><span class="font-medium">${fmt(paidPlanned)}</span></div>
              <div class="mt-2 border-t border-gray-200 pt-2 dark:border-gray-800"></div>
              <div class="flex items-center justify-between gap-6"><span>Net (Realizado)</span><span class="font-semibold">${fmt(netActual)}</span></div>
              <div class="flex items-center justify-between gap-6"><span>Net (Previsto)</span><span class="font-semibold">${fmt(netPlanned)}</span></div>
            </div>
          </div>
        `;
      }
    },
    grid: { strokeDashArray: 4 },
    legend: { position: 'top' },
  };

  paymentMethodsSeries: ApexAxisChartSeries = [
    { name: 'Pix', data: [9125, 1255] },
    { name: 'Transferência', data: [3200, 1385] },
    { name: 'Dinheiro', data: [900, 180] },
  ];

  paymentMethodsColors: string[] = ['#2a31d8', '#465fff', '#7592ff'];

  paymentMethodsChart: ApexChart = {
    fontFamily: 'Outfit, sans-serif',
    type: 'bar',
    stacked: true,
    height: 315,
    toolbar: { show: false },
    zoom: { enabled: false },
  };

  paymentMethodsPlotOptions: ApexPlotOptions = {
    bar: {
      horizontal: false,
      columnWidth: '39%',
      borderRadius: 10,
      borderRadiusApplication: 'end',
      borderRadiusWhenStacked: 'last',
    },
  };

  paymentMethodsDataLabels: ApexDataLabels = { enabled: false };

  paymentMethodsXaxis: ApexXAxis = {
    categories: ['Recebíveis', 'Pagos'],
    axisBorder: { show: false },
    axisTicks: { show: false },
  };

  paymentMethodsLegend: ApexLegend = {
    show: true,
    position: 'top',
    horizontalAlign: 'left',
    fontFamily: 'Outfit',
    fontSize: '14px',
    fontWeight: 400,
    markers: {
      shape: 'circle',
      strokeWidth: 0,
    },
    itemMargin: {
      horizontal: 10,
      vertical: 0,
    },
  };

  paymentMethodsYaxis: ApexYAxis = {
    title: { text: undefined },
  };

  paymentMethodsGrid: ApexGrid = {
    yaxis: { lines: { show: true } },
  };

  paymentMethodsFill: ApexFill = { opacity: 1 };

  paymentMethodsTooltip: ApexTooltip = {
    x: { show: false },
    y: { formatter: (val: number) => val.toString() },
  };

  netAreaSeries: ApexAxisChartSeries = [
    { name: 'Net (Realizado)', data: [] },
    { name: 'Net (Previsto)', data: [] },
  ];
  netAreaChart: ApexChart = {
    fontFamily: 'Outfit, sans-serif',
    type: 'area',
    height: 320,
    toolbar: { show: false },
  };
  netAreaDataLabels: ApexDataLabels = { enabled: false };
  netAreaStroke: ApexStroke = { curve: 'smooth', width: 2 };
  netAreaFill: ApexFill = { type: 'gradient' };
  netAreaXaxis: ApexXAxis = { categories: [], axisBorder: { show: false }, axisTicks: { show: false } };
  netAreaYaxis: ApexYAxis = { labels: { formatter: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v as number) } };
  netAreaGrid: ApexGrid = { strokeDashArray: 4 };
  netAreaLegend: ApexLegend = { position: 'top' };
  netAreaTooltip: ApexTooltip = { shared: true, y: { formatter: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v as number) } };

  bankAccountSeries: ApexAxisChartSeries = [
    { name: 'Recebido', data: [] },
    { name: 'Pago', data: [] },
  ];
  bankAccountOptions: { chart: ApexChart; xaxis: ApexXAxis; dataLabels: ApexDataLabels; tooltip: ApexTooltip; grid: ApexGrid; legend: ApexLegend } = {
    chart: { type: 'bar', height: 320, toolbar: { show: false } },
    xaxis: { categories: [] },
    dataLabels: { enabled: false },
    tooltip: { shared: true, y: { formatter: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v as number) } },
    grid: { strokeDashArray: 4 },
    legend: { position: 'top' },
  };

  tagsTopLabels: string[] = [];
  tagsTopSeries: ApexAxisChartSeries = [{ name: 'Valor', data: [] }];
  tagsTopOptions: { chart: ApexChart; xaxis: ApexXAxis; dataLabels: ApexDataLabels; tooltip: ApexTooltip; grid: ApexGrid; legend: ApexLegend } = {
    chart: { type: 'bar', height: 320, toolbar: { show: false } },
    xaxis: { categories: [] },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v as number) } },
    grid: { strokeDashArray: 4 },
    legend: { show: false } as any,
  };

  tagsCoverageSeries: ApexNonAxisChartSeries = [0];
  tagsCoverageChart: ApexChart = {
    fontFamily: 'Outfit, sans-serif',
    type: 'radialBar',
    height: 220,
    sparkline: { enabled: true },
  };
  tagsCoveragePlotOptions: ApexPlotOptions = {
    radialBar: {
      startAngle: -85,
      endAngle: 85,
      hollow: { size: '80%' },
      track: {
        background: '#E4E7EC',
        strokeWidth: '100%',
        margin: 5,
      },
      dataLabels: {
        name: { show: false },
        value: {
          fontSize: '28px',
          fontWeight: '600',
          offsetY: -25,
          color: '#1D2939',
          formatter: (val: number) => `${Number(val).toFixed(2)}%`,
        },
      },
    },
  };
  tagsCoverageFill: ApexFill = { type: 'solid', colors: ['#465FFF'] };
  tagsCoverageStroke: ApexStroke = { lineCap: 'round' };
  tagsCoverageLabels: string[] = ['Cobertura'];
  tagsCoverageColors: string[] = ['#465FFF'];

  tagsRadarSeries: ApexAxisChartSeries = [{ name: '% do maior', data: [] }];
  tagsRadarChart: ApexChart = {
    fontFamily: 'Outfit, sans-serif',
    type: 'radar',
    height: 320,
    toolbar: { show: false },
  };
  tagsRadarDataLabels: ApexDataLabels = {
    enabled: true,
    formatter: (val: number) => `${Math.round(val)}%`,
  };
  tagsRadarPlotOptions: ApexPlotOptions = {
    radar: {
      size: 140,
      polygons: {
        strokeColors: '#e9e9e9',
        fill: {
          colors: ['#f8f8f8', '#fff'],
        },
      },
    },
  };
  tagsRadarColors: string[] = ['#465FFF'];
  tagsRadarMarkers: ApexMarkers = {
    size: 4,
    colors: ['#fff'],
    strokeColors: '#465FFF',
    strokeWidth: 2,
  };
  tagsRadarTooltip: ApexTooltip = {
    y: { formatter: (val: number) => `${Math.round(val)}%` },
  };
  tagsRadarXaxis: ApexXAxis = { categories: [] };
  tagsRadarYaxis: ApexYAxis = {
    labels: {
      formatter: (val: number, i?: number) => (typeof i === 'number' && i % 2 === 0 ? `${val}` : ''),
    } as any,
  };

  forecastSeries: ApexAxisChartSeries = [
    { name: 'Receber', data: [] },
    { name: 'Pagar', data: [] },
    { name: 'Net', data: [] },
  ];
  forecastOptions: { chart: ApexChart; xaxis: ApexXAxis; dataLabels: ApexDataLabels; tooltip: ApexTooltip; grid: ApexGrid; legend: ApexLegend } = {
    chart: { type: 'line', height: 320, toolbar: { show: false } },
    xaxis: { categories: [] },
    dataLabels: { enabled: false },
    tooltip: { shared: true, y: { formatter: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v as number) } },
    grid: { strokeDashArray: 4 },
    legend: { position: 'top' },
  };

  ngOnInit(): void {
    this.initDates(30);
    this.ensureDemoCharts();
    const user = this.authService.getCurrentUser() as User | null;
    const owned = (user as any)?.ownedOrganizations;
    const firstOrg = Array.isArray(owned) && owned.length > 0 ? owned[0] : null;
    if (firstOrg?.id_code) {
      this.orgService.getOrganizationStores(firstOrg.id_code).subscribe((list: OrganizationStore[]) => {
        const safe = (list || []).map(s => ({ id_code: s.id_code || (s as any).id, name: s.name || 'Loja' }));
        this.stores = [{ id_code: this.ALL_STORES_KEY, name: 'Todos' }, ...safe.filter(s => !!s.id_code)];
        if (this.pendingScopeStoreIds) {
          this.applyScopeStoreIds(this.pendingScopeStoreIds);
          this.pendingScopeStoreIds = null;
        } else {
          this.syncAllSelection();
        }
      });
    }
    this.applyFilters();
  }

  ngOnDestroy(): void {
    this.dashboardSub?.unsubscribe();
    this.hideGlobalLoader();
  }

  toggleStore(storeId: string): void {
    if (this.isLoading) return;
    if (storeId === this.ALL_STORES_KEY) {
      this.selectedStoreIds = new Set([this.ALL_STORES_KEY]);
      this.applyFilters();
      return;
    }

    const next = new Set(this.selectedStoreIds);
    if (next.has(this.ALL_STORES_KEY)) next.delete(this.ALL_STORES_KEY);

    if (next.has(storeId)) next.delete(storeId);
    else next.add(storeId);

    if (next.size === 0) next.add(this.ALL_STORES_KEY);

    this.selectedStoreIds = next;
    this.syncAllSelection();
    this.applyFilters();
  }

  isStoreSelected(storeId: string): boolean {
    return this.selectedStoreIds.has(this.ALL_STORES_KEY) || this.selectedStoreIds.has(storeId);
  }

  selectPeriod(p: number | 'custom'): void {
    if (this.isLoading) return;
    this.selectedPeriod = p;
    if (p !== 'custom') {
      this.initDates(p as number);
      this.applyFilters();
    }
  }

  togglePeriodDropdown(): void {
    if (this.isLoading) return;
    this.isPeriodDropdownOpen = !this.isPeriodDropdownOpen;
  }

  closePeriodDropdown(): void {
    this.isPeriodDropdownOpen = false;
  }

  selectPeriodFromDropdown(p: number | 'custom'): void {
    if (this.isLoading) return;
    this.closePeriodDropdown();
    this.selectPeriod(p);
  }

  getSelectedPeriodLabel(): string {
    return this.selectedPeriod === 'custom' ? 'Custom' : `${this.selectedPeriod} dias`;
  }

  applyCustomRange(): void {
    if (this.isLoading) return;
    this.selectedPeriod = 'custom';
    this.applyFilters();
  }

  setDateMode(mode: 'cash' | 'competence'): void {
    if (this.isLoading) return;
    this.date_mode = mode;
    this.applyFilters();
  }

  getDeltaPct(field: string): number | null {
    const v = this.compare_to_previous?.delta_pct?.[field];
    return typeof v === 'number' ? v : null;
  }

  getDelta(field: string): number | null {
    const v = this.compare_to_previous?.delta?.[field];
    return typeof v === 'number' ? v : null;
  }

  getDeltaSign(field: string): 'up' | 'down' | 'neutral' {
    const d = this.getDelta(field);
    if (d == null) return 'neutral';
    if (d > 0) return 'up';
    if (d < 0) return 'down';
    return 'neutral';
  }

  formatDeltaPct(field: string): string {
    const pct = this.getDeltaPct(field);
    if (pct == null) return '—';
    const n = Math.round(pct * 10) / 10;
    return `${n}%`;
  }

  selectCostCenter(cc: NonNullable<FinancialAnalyticsDashboardV1['cost_centers']>[number]): void {
    this.selectedCostCenter = cc;
  }

  private getPaymentMethodLabel(method: string): string {
    const m = String(method || '').toLowerCase();
    const map: Record<string, string> = {
      pix: 'Pix',
      bank_transfer: 'Transferência',
      cash: 'Dinheiro',
      credit_card: 'Crédito',
      debit_card: 'Débito',
      boleto: 'Boleto',
    };
    return map[m] || m.replace(/_/g, ' ');
  }

  private getPaymentMethodColor(method: string): string {
    const m = String(method || '').toLowerCase();
    const map: Record<string, string> = {
      pix: '#22C55E',
      bank_transfer: '#3B82F6',
      cash: '#F59E0B',
      credit_card: '#8B5CF6',
      debit_card: '#06B6D4',
      boleto: '#EF4444',
    };
    return map[m] || '#465FFF';
  }

  private ensureDemoCharts(): void {
    const hasPaymentData = Array.isArray(this.paymentMethodsSeries) && this.paymentMethodsSeries.some(s => Array.isArray(s.data) && s.data.some(v => Number(v) > 0));
    if (!hasPaymentData) {
      const methods = ['pix', 'bank_transfer', 'cash'];
      this.paymentMethodsSeries = methods.map((m) => ({
        name: this.getPaymentMethodLabel(m),
        data: [m === 'pix' ? 9125 : (m === 'bank_transfer' ? 3200 : 900), m === 'pix' ? 1255 : (m === 'bank_transfer' ? 1385 : 180)],
      }));
      this.paymentMethodsColors = methods.map((m) => this.getPaymentMethodColor(m));
      this.paymentMethodsXaxis = { ...this.paymentMethodsXaxis, categories: ['Recebíveis', 'Pagos'] };
    }

    if (!this.tagsRadarXaxis?.categories?.length) {
      this.tagsRadarSeries = [{ name: '% do maior', data: [100, 70, 45, 30, 20] }];
      this.tagsRadarXaxis = { categories: ['TAG1', 'TAG2', 'TAG3', 'TAG4', 'Sem tag'] };
    }

    if (!this.tagsCoverageSeries?.length || this.tagsCoverageSeries[0] === 0) {
      this.tagsCoverageSeries = [42.86];
    }

    if (!this.netAreaXaxis?.categories?.length) {
      const cats = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'];
      this.netAreaXaxis = { ...this.netAreaXaxis, categories: cats };
      this.netAreaSeries = [
        { name: 'Net (Realizado)', data: [0, 0, 500, 1200, 300, 2400, 1800] },
        { name: 'Net (Previsto)', data: [200, 400, 700, 900, 1100, 1600, 2000] },
      ];
    }
  }

  onStartPickerChange(event: any): void {
    if (this.isLoading) return;
    const dateStr = String(event?.dateStr || '').trim();
    if (!dateStr) return;
    this.selectedPeriod = 'custom';
    this.start_date = dateStr;
    if (this.end_date && this.end_date < this.start_date) {
      this.end_date = this.start_date;
    }
  }

  onEndPickerChange(event: any): void {
    if (this.isLoading) return;
    const dateStr = String(event?.dateStr || '').trim();
    if (!dateStr) return;
    this.selectedPeriod = 'custom';
    this.end_date = dateStr;
    if (this.start_date && this.end_date < this.start_date) {
      this.end_date = this.start_date;
    }
  }

  private initDates(days: number): void {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    this.start_date = start.toISOString().slice(0, 10);
    this.end_date = end.toISOString().slice(0, 10);
  }

  private applyFilters(): void {
    this.dashboardSub?.unsubscribe();
    this.isLoading = true;
    this.showGlobalLoader();
    const selected = this.getSelectedStoreIdsForApi();
    const store_ids_csv = selected.length > 0 ? selected.join(',') : undefined;

    this.dashboardSub = this.analytics.getDashboardV1({
      start_date: this.start_date,
      end_date: this.end_date,
      date_mode: this.date_mode,
      store_ids_csv,
      limit_top: 10,
    }).subscribe({
      next: (data) => {
        if (data?.scope) {
          const scopeStoreIds = Array.isArray(data.scope.store_ids) ? data.scope.store_ids : [];
          if (scopeStoreIds.length > 0) {
            if (this.stores.length > 1) this.applyScopeStoreIds(scopeStoreIds);
            else this.pendingScopeStoreIds = scopeStoreIds;
          } else {
            this.selectedStoreIds = new Set([this.ALL_STORES_KEY]);
          }
          if (typeof data.scope.start_date === 'string') this.start_date = data.scope.start_date;
          if (typeof data.scope.end_date === 'string') this.end_date = data.scope.end_date;
          if (data.scope.date_mode === 'cash' || data.scope.date_mode === 'competence') this.date_mode = data.scope.date_mode;
        }
        this.compare_to_previous = data.compare_to_previous || null;
        this.kpis = data.kpis;
        const ts = (data.timeseries || []) as any[];
        const categories = ts.map(t => t.date);
        const receivedActual = ts.map(t => Number(t.received_actual ?? t.received ?? 0));
        const paidActual = ts.map(t => Number(t.paid_actual ?? t.paid ?? 0));
        const receivedPlanned = ts.map(t => Number(t.received_planned ?? 0));
        const paidPlanned = ts.map(t => Number(t.paid_planned ?? 0));
        this.timeseries = ts as any;
        this.top_expense_categories = data.top_expense_categories || [];
        this.top_customers = data.top_customers || [];
        this.cost_centers = data.cost_centers || [];
        if (this.selectedCostCenter) {
          const id = this.selectedCostCenter.cost_center_id;
          this.selectedCostCenter = (this.cost_centers || []).find(c => c.cost_center_id === id) || null;
        }
        this.commissions = data.commissions;
        this.commission_inconsistencies = data.commission_inconsistencies || null;
        this.payment_methods = data.payment_methods || { receivable: [], payable: [] };
        this.bank_accounts = data.bank_accounts || [];
        this.tags = data.tags || null;
        this.forecast_recurrences = data.forecast_recurrences || null;
        this.upcoming = data.upcoming;

        this.chartSeries = [
          { name: 'Recebido (Realizado)', data: receivedActual },
          { name: 'Recebido (Previsto)', data: receivedPlanned },
          { name: 'Pago (Realizado)', data: paidActual },
          { name: 'Pago (Previsto)', data: paidPlanned },
        ];
        this.chartOptions = {
          ...this.chartOptions,
          xaxis: { categories },
        };

        const recv = this.payment_methods.receivable || [];
        const pay = this.payment_methods.payable || [];
        const methodSet = new Set<string>([...recv.map(p => p.method), ...pay.map(p => p.method)].filter(Boolean));
        const methods = Array.from(methodSet);
        const recvMap = new Map<string, number>(recv.map(p => [p.method, p.total_amount]));
        const payMap = new Map<string, number>(pay.map(p => [p.method, p.total_amount]));
        this.paymentMethodsSeries = methods.map((m) => ({
          name: this.getPaymentMethodLabel(m),
          data: [recvMap.get(m) ?? 0, payMap.get(m) ?? 0],
        }));
        this.paymentMethodsColors = methods.map((m) => this.getPaymentMethodColor(m));

        const netActual = receivedActual.map((v, i) => v - (paidActual[i] ?? 0));
        const netPlanned = receivedPlanned.map((v, i) => v - (paidPlanned[i] ?? 0));
        this.netAreaXaxis = { ...this.netAreaXaxis, categories };
        this.netAreaSeries = [
          { name: 'Net (Realizado)', data: netActual },
          { name: 'Net (Previsto)', data: netPlanned },
        ];

        const baCats = (this.bank_accounts || []).map(b => b.bank_account_name || b.bank_name || 'Conta');
        this.bankAccountSeries = [
          { name: 'Recebido', data: (this.bank_accounts || []).map(b => b.totals?.received ?? 0) },
          { name: 'Pago', data: (this.bank_accounts || []).map(b => b.totals?.paid ?? 0) },
        ];
        this.bankAccountOptions = { ...this.bankAccountOptions, xaxis: { categories: baCats } };

        const top = (this.tags?.top || []).slice(0, 7).map(t => ({ name: t.tag_name, amount: t.total_amount }));
        const points = [...top];
        if (this.tags?.untagged && points.length < 8) {
          points.push({ name: this.tags.untagged.tag_name, amount: this.tags.untagged.total_amount });
        }
        const maxAmount = Math.max(1, ...points.map(p => p.amount));
        this.tagsRadarSeries = [{ name: '% do maior', data: points.map(p => Math.round((p.amount / maxAmount) * 1000) / 10) }];
        this.tagsRadarXaxis = { categories: points.map(p => p.name) };
        const coverage = Number(this.tags?.coverage_pct ?? 0);
        this.tagsCoverageSeries = [Math.max(0, Math.min(100, coverage))];

        this.ensureDemoCharts();

        const f = this.forecast_recurrences;
        const fCats = (f?.monthly || []).map(m => m.month);
        this.forecastSeries = [
          { name: 'Receber', data: (f?.monthly || []).map(m => m.receivable) },
          { name: 'Pagar', data: (f?.monthly || []).map(m => m.payable) },
          { name: 'Net', data: (f?.monthly || []).map(m => m.net) },
        ];
        this.forecastOptions = { ...this.forecastOptions, xaxis: { categories: fCats } };

        this.isLoading = false;
        this.hideGlobalLoader();
        this.dashboardSub = null;
      },
      error: () => {
        this.toast.triggerToast('error', 'Erro', 'Não foi possível carregar o dashboard. Exibindo dados fictícios.');
        const fallback = this.generateMock();
        this.kpis = fallback.kpis;
        this.timeseries = fallback.timeseries;
        this.top_expense_categories = fallback.top_expense_categories;
        this.top_customers = fallback.top_customers;
        this.cost_centers = [];
        this.selectedCostCenter = null;
        this.commissions = fallback.commissions;
        this.commission_inconsistencies = null;
        this.compare_to_previous = null;
        this.payment_methods = { receivable: [], payable: [] };
        this.paymentMethodsSeries = [];
        this.paymentMethodsColors = [];
        this.netAreaSeries = [
          { name: 'Net (Realizado)', data: [] },
          { name: 'Net (Previsto)', data: [] },
        ];
        this.netAreaXaxis = { ...this.netAreaXaxis, categories: [] };
        this.bank_accounts = [];
        this.tags = null;
        this.tagsCoverageSeries = [0];
        this.forecast_recurrences = null;
        this.upcoming = fallback.upcoming;
        this.chartSeries = [
          { name: 'Recebido (Realizado)', data: this.timeseries.map((t: any) => t.received ?? 0) },
          { name: 'Recebido (Previsto)', data: this.timeseries.map(() => 0) },
          { name: 'Pago (Realizado)', data: this.timeseries.map((t: any) => t.paid ?? 0) },
          { name: 'Pago (Previsto)', data: this.timeseries.map(() => 0) },
        ];
        this.chartOptions = {
          ...this.chartOptions,
          xaxis: { categories: this.timeseries.map((t: any) => t.date) },
        };
        this.ensureDemoCharts();
        this.isLoading = false;
        this.hideGlobalLoader();
        this.dashboardSub = null;
      }
    });
  }

  private showGlobalLoader(): void {
    if (this.loaderRef) return;
    this.loaderRef = createComponent(FinancialDashboardLoaderOverlayComponent, {
      environmentInjector: this.envInjector,
      elementInjector: this.injector,
    });
    this.appRef.attachView(this.loaderRef.hostView);
    const host = this.loaderRef.location.nativeElement as HTMLElement;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483646';
    host.style.pointerEvents = 'auto';
    document.body.appendChild(host);
  }

  private hideGlobalLoader(): void {
    if (!this.loaderRef) return;
    this.appRef.detachView(this.loaderRef.hostView);
    this.loaderRef.destroy();
    this.loaderRef = null;
  }

  private applyScopeStoreIds(scopeStoreIds: string[]): void {
    const actualIds = this.stores
      .map(s => s.id_code)
      .filter(id => id && id !== this.ALL_STORES_KEY);

    const next = new Set<string>(scopeStoreIds.filter(id => actualIds.includes(id)));

    if (next.size === 0) {
      this.selectedStoreIds = new Set([this.ALL_STORES_KEY]);
      return;
    }

    const allSelected = actualIds.length > 0 && actualIds.every(id => next.has(id));
    this.selectedStoreIds = allSelected ? new Set([this.ALL_STORES_KEY]) : next;
  }

  private getSelectedStoreIdsForApi(): string[] {
    if (this.selectedStoreIds.has(this.ALL_STORES_KEY)) return [];
    return Array.from(this.selectedStoreIds).filter(id => id !== this.ALL_STORES_KEY);
  }

  private syncAllSelection(): void {
    if (this.selectedStoreIds.has(this.ALL_STORES_KEY)) return;

    const actualIds = this.stores
      .map(s => s.id_code)
      .filter(id => id && id !== this.ALL_STORES_KEY);

    const next = new Set<string>(
      Array.from(this.selectedStoreIds).filter(id => actualIds.includes(id))
    );

    if (next.size === 0) {
      this.selectedStoreIds = new Set([this.ALL_STORES_KEY]);
      return;
    }

    const allSelected = actualIds.length > 0 && actualIds.every(id => next.has(id));
    if (allSelected) {
      this.selectedStoreIds = new Set([this.ALL_STORES_KEY]);
      return;
    }

    this.selectedStoreIds = next;
  }

  private generateMock() {
    const start = new Date(this.start_date);
    const end = new Date(this.end_date);
    const days: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d).toISOString().slice(0, 10));
    }
    const rand = (min: number, max: number) => Math.round(Math.random() * (max - min) + min);
    const ts = days.map(date => {
      const received = rand(500, 4000);
      const paid = rand(400, 3500);
      return { date, received, paid };
    });
    const totalsR = ts.reduce((a, b) => a + b.received, 0);
    const totalsP = ts.reduce((a, b) => a + b.paid, 0);
    const topCats = Array.from({ length: 10 }).map((_, i) => ({
      category_id: `cat-${i + 1}`,
      category_name: `Categoria ${i + 1}`,
      total_paid: rand(1000, 15000),
    })).sort((a, b) => b.total_paid - a.total_paid);
    const topCust = Array.from({ length: 10 }).map((_, i) => ({
      party_id: `cust-${i + 1}`,
      party_name: `Cliente ${i + 1}`,
      total_received: rand(1200, 16000),
    })).sort((a, b) => b.total_received - a.total_received);
    const upcomingRecv = Array.from({ length: 10 }).map((_, i) => ({
      id_code: `rc-${i}`,
      due_date: new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10),
      description: `Receber ${i + 1}`,
      amount: rand(200, 4000),
      party_id: null,
      party_name: null,
      category_id: null,
      category_name: null,
    }));
    const upcomingPay = Array.from({ length: 10 }).map((_, i) => ({
      id_code: `py-${i}`,
      due_date: new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10),
      description: `Pagar ${i + 1}`,
      amount: rand(150, 3500),
      party_id: null,
      party_name: null,
      category_id: null,
      category_name: null,
    }));
    return {
      kpis: {
        total_received: totalsR,
        total_paid: totalsP,
        balance: totalsR - totalsP,
        receivable_open: rand(3000, 20000),
        payable_open: rand(3000, 20000),
        overdue_total: rand(1000, 8000),
        overdue_receivable: rand(500, 4000),
        overdue_payable: rand(500, 4000),
      },
      timeseries: ts,
      top_expense_categories: topCats,
      top_customers: topCust,
      commissions: {
        pending_amount: rand(500, 7000),
        pending_count: rand(3, 25),
        paid_amount: rand(800, 9000),
        paid_count: rand(5, 35),
      },
      upcoming: { receivable: upcomingRecv, payable: upcomingPay },
    };
  }
}
