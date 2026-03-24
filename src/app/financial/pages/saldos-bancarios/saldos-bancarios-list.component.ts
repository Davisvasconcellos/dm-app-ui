import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, OnInit, ViewChild, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import Swiper from 'swiper';
import { FinancialService } from '../../financial.service';
import { FinancialToastService } from '../../financial-toast.service';
import { BadgeComponent } from '../../../shared/components/ui/badge/badge.component';
import { DropdownComponent } from '../../../shared/components/ui/dropdown/dropdown.component';
import { DropdownItemComponent } from '../../../shared/components/ui/dropdown/dropdown-item/dropdown-item.component';
import { DatePickerComponent } from '../../../shared/components/form/date-picker/date-picker.component';

import {
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexChart,
  ApexFill,
  ApexStroke,
  ApexGrid,
  ApexDataLabels,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis
} from 'ng-apexcharts';

interface Transaction {
  image: string;
  action: string;
  date: string;
  amount: string;
  category: string;
  costCenter: string;
  status: 'Success' | 'Pending' | 'Failed' | 'Provisioned';
  rawDate: Date | null;
  rawAmount: number;
  type: string;
  rawStatus: string;
  description: string;
  original: any;
  nf?: string;
  tags?: any[];
}

@Component({
  selector: 'app-saldos-bancarios-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BadgeComponent,
    TranslateModule,
    NgApexchartsModule,
    DropdownComponent,
    DropdownItemComponent,
    DatePickerComponent
  ],
  templateUrl: './saldos-bancarios-list.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SaldosBancariosListComponent implements OnInit {
  @ViewChild('swiperRef') swiperRef!: ElementRef;
  public swiperInstance: Swiper | undefined;
  protected readonly Math = Math;

  bankAccounts: any[] = [];
  selectedStore: any = null;
  selectedAccount: any = null;
  isLoadingTransactions = false;
  private readonly STORE_KEY = 'selectedStore';

  allData: Transaction[] = [];
  paginatedData: Transaction[] = [];

  kpiTotalIn = 0;
  kpiTotalOut = 0;
  kpiBalance = 0;

  searchTerm = '';
  isOpen = false;

  // Filters & Pagination
  typeFilter: 'all' | 'PAYABLE' | 'RECEIVABLE' = 'all';

  // Date Filters
  dateInterval: string = '30';
  startDate: Date | null = null;
  endDate: Date | null = null;

  itemsPerPage = 10;
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;

  sortKey: string | null = null;
  sortOrder: 'asc' | 'desc' = 'asc';

  // Offcanvas
  isOffcanvasOpen = false;
  selectedTransaction: Transaction | null = null;

  // Evidence Sidebar
  isEvidenceSidebarOpen = false;
  selectedEvidenceItems: { name: string; url?: string; type: 'image' | 'pdf' | 'file'; extension?: string }[] = [];

  // Delete Modal
  isDeleteModalOpen = false;
  transactionToDelete: any | null = null;

  // Chart Properties
  public chartSeries: ApexAxisChartSeries = [];
  public chartOptions: ApexChart = {
    fontFamily: 'Outfit, sans-serif',
    height: 140,
    type: 'area',
    toolbar: { show: false }
  };
  public chartColors: string[] = ['#22ad5c', '#ff4040'];
  public chartFill: ApexFill = {
    type: 'gradient',
    gradient: {
      opacityFrom: 0.55,
      opacityTo: 0,
    }
  };
  public chartStroke: ApexStroke = {
    curve: 'smooth',
    width: 2
  };
  public chartGrid: ApexGrid = {
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: false } }
  };
  public chartDataLabels: ApexDataLabels = { enabled: false };
  public chartTooltip: ApexTooltip = {
    x: { format: 'dd MMM yyyy' }
  };
  public chartXAxis: ApexXAxis = {
    type: 'datetime',
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { show: false }
  };
  public chartYAxis: ApexYAxis = {
    labels: { show: false },
    title: { text: undefined }
  };

  constructor(
    private financialService: FinancialService,
    private toastService: FinancialToastService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  ngOnInit() {
    // Initialize dates based on default interval
    this.onDateIntervalChange();
    this.loadBankAccounts();
  }

  openDeleteModal(row: Transaction) {
    this.transactionToDelete = row;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.transactionToDelete = null;
  }

  confirmDelete() {
    const row = this.transactionToDelete;
    if (!row) {
      return;
    }
    this.isDeleteModalOpen = false;
    this.transactionToDelete = null;
    this.deleteTransaction(row);
  }

  deleteTransaction(row: Transaction) {
    if (row.rawStatus === 'paid') {
      this.toastService.triggerToast(
        'warning',
        'Exclusão não permitida',
        'Lançamentos pagos devem ser estornados usando o cancelamento, não exclusão.'
      );
      return;
    }

    if (!this.selectedStore || !this.selectedStore.id_code) {
      this.toastService.triggerToast('warning', 'Empresa não selecionada', 'É obrigatório selecionar uma empresa para gerenciar o lançamento.');
      return;
    }

    const id = row.original?.id_code || row.original?.id;
    if (!id) return;

    this.financialService.updateTransaction(id, { is_deleted: true }).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.toastService.triggerToast('success', 'Lançamento excluído', 'O lançamento foi excluído com sucesso.');
          if (this.selectedAccount) {
            this.loadTransactions(this.selectedAccount.id_code);
          }
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Erro ao excluir lançamento', err);
          const msg = err?.error?.message || err?.message || 'Erro ao excluir lançamento.';
          this.toastService.triggerToast('error', 'Erro na exclusão', msg);
        });
      }
    });
  }

  get visiblePages(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const delta = 2;
    const range: number[] = [];
    const left = current - delta;
    const right = current + delta + 1;
    const rangeWithDots: number[] = [];
    let l: number | undefined;

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= left && i < right)) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          // We don't handle dots in the HTML currently, just simple buttons.
        }
      }
      rangeWithDots.push(i);
      l = i;
    }
    return rangeWithDots;
  }

  inferEvidenceType(input: string): 'image' | 'pdf' | 'file' {
    const lower = input.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp')) {
      return 'image';
    }
    if (lower.endsWith('.pdf')) {
      return 'pdf';
    }
    return 'file';
  }

  parseAttachmentsJson(raw: string): { url: string; filename: string }[] {
    const text = raw.trim();
    if (!text.startsWith('[') && !text.startsWith('{')) {
      return [];
    }
    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list
        .filter(item => item && typeof item.url === 'string')
        .map(item => {
          const url = item.url as string;
          const filename =
            (item.filename as string | undefined) ||
            (item.name as string | undefined) ||
            url.split('/').pop() ||
            'Evidência';
          return { url, filename };
        });
    } catch {
      return [];
    }
  }

  getRowAttachments(row: Transaction): { url: string; filename: string }[] {
    const fromRow = (row.original as any).attachments as { url?: string; filename?: string }[] | undefined;
    const attachments: { url: string; filename: string }[] = [];

    if (Array.isArray(fromRow) && fromRow.length > 0) {
      fromRow.forEach(item => {
        if (!item) {
          return;
        }
        if (typeof item.url === 'string') {
          const urlText = item.url.trim();
          const nested = this.parseAttachmentsJson(urlText);
          if (nested.length > 0) {
            attachments.push(...nested);
            return;
          }
          if (!urlText) {
            return;
          }
          const filename = item.filename || urlText.split('/').pop() || 'Evidência';
          attachments.push({
            url: urlText,
            filename
          });
          return;
        }
        if ((item as any).url && typeof (item as any).url === 'string') {
          const url = String((item as any).url);
          const filename =
            (item as any).filename ||
            url.split('/').pop() ||
            'Evidência';
          attachments.push({ url, filename });
        }
      });
      if (attachments.length > 0) {
        return attachments;
      }
    }

    if (row.original.attachment_url) {
      const raw = row.original.attachment_url.trim();
      const fromJson = this.parseAttachmentsJson(raw);
      if (fromJson.length > 0) {
        attachments.push(...fromJson);
      } else {
        const urls = raw
          .split(/[;,]/)
          .map((part: string) => part.trim())
          .filter((part: string) => part.length > 0);

        urls.forEach((url: string) => {
          const filename = url.split('/').pop() || 'Evidência';
          attachments.push({
            url,
            filename
          });
        });
      }
    }

    return attachments;
  }

  openEvidenceSidebar(row: Transaction) {
    this.selectedTransaction = row;
    const items: { name: string; url?: string; type: 'image' | 'pdf' | 'file'; extension?: string }[] = [];

    const attachments = this.getRowAttachments(row);

    attachments.forEach(att => {
      const sourceForType = att.url || att.filename;
      const type = this.inferEvidenceType(sourceForType);
      const extensionSource = att.filename || att.url;
      const extensionMatch = extensionSource.split('.').pop() || '';
      const sanitizedExtension =
        extensionMatch &&
          !extensionMatch.includes('/') &&
          extensionMatch.length > 0 &&
          extensionMatch.length <= 6
          ? extensionMatch.toUpperCase()
          : undefined;

      items.push({
        name: att.filename,
        url: att.url,
        type,
        extension: sanitizedExtension
      });
    });

    this.selectedEvidenceItems = items;
    this.isEvidenceSidebarOpen = true;
    this.cdr.detectChanges();
  }

  closeEvidenceSidebar() {
    this.isEvidenceSidebarOpen = false;
  }

  openEvidenceItem(item: { url?: string }) {
    if (item.url) {
      window.open(item.url, '_blank');
    }
  }

  getBadgeColor(type: 'Success' | 'Pending' | 'Failed' | 'Provisioned'): 'success' | 'warning' | 'error' | 'primary' {
    if (type === 'Success') return 'success';
    if (type === 'Pending') return 'warning';
    if (type === 'Provisioned') return 'primary';
    return 'error';
  }

  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  closeDropdown() {
    this.isOpen = false;
  }

  loadBankAccounts() {
    const storedStore = localStorage.getItem(this.STORE_KEY);
    if (storedStore) {
      this.selectedStore = JSON.parse(storedStore);
      if (this.selectedStore.id_code) {
        this.financialService.getBankAccounts(this.selectedStore.id_code).subscribe({
          next: (accounts) => {
            this.ngZone.run(() => {
              this.bankAccounts = accounts.map(account => ({
                ...account,
                balance: account.current_balance !== undefined ? account.current_balance : (account.balance !== undefined ? account.balance : parseFloat(account.initial_balance)),
                img: '/images/brand/brand-04.svg'
              }));

              if (this.bankAccounts.length > 0) {
                this.selectAccount(this.bankAccounts[0]);
              }
            });
          },
          error: (err) => console.error('Error fetching bank accounts', err)
        });
      }
    }
  }

  selectAccount(account: any) {
    this.ngZone.run(() => {
      this.selectedAccount = account;
      this.loadTransactions(account.id_code);
    });
  }

  loadTransactions(accountId: string) {
    this.ngZone.run(() => {
      this.isLoadingTransactions = true;
    });

    const filters: any = {};
    if (this.selectedStore?.id_code) {
      filters.store_id = this.selectedStore.id_code;
    }

    if (this.startDate) {
      filters.start_date = this.startDate.toISOString().split('T')[0];
    }
    if (this.endDate) {
      filters.end_date = this.endDate.toISOString().split('T')[0];
    }
    if (this.typeFilter !== 'all') {
      filters.type = this.typeFilter;
    }
    if (this.searchTerm) {
      filters.description = this.searchTerm;
    }

    this.financialService.getBankAccountTransactions(accountId, filters).subscribe({
      next: (transactions) => {
        this.ngZone.run(() => {
          let totalIn = 0;
          let totalOut = 0;
          const incomeData: { x: number, y: number }[] = [];
          const expenseData: { x: number, y: number }[] = [];

          this.allData = transactions.map(t => {
            const amount = parseFloat(t.amount) || 0;
            const type = (t.type || '').toUpperCase();
            const date = t.paid_at ? new Date(t.paid_at) : (t.due_date ? new Date(t.due_date) : null);

            if (type === 'RECEIVABLE') {
              totalIn += amount;
              if (date) incomeData.push({ x: date.getTime(), y: amount });
            } else if (type === 'PAYABLE') {
              totalOut += amount;
              if (date) expenseData.push({ x: date.getTime(), y: amount });
            }

            let status: 'Success' | 'Pending' | 'Failed' | 'Provisioned' = 'Failed';
            if (t.status === 'paid') status = 'Success';
            else if (t.status === 'pending') status = 'Pending';
            else if (t.status === 'provisioned') status = 'Provisioned';

            return {
              image: '/images/brand/brand-08.svg',
              action: t.description || t.party?.name || 'Movimentação',
              description: t.description || '',
              date: date ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-',
              amount: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: t.currency || 'BRL' }).format(amount),
              category: t.finCategory?.name || 'Sem Categoria',
              costCenter: t.finCostCenter?.name || '-',
              status: status,
              rawStatus: t.status,
              rawDate: date,
              rawAmount: amount,
              type: type,
              original: t,
              nf: t.nf,
              tags: t.tags
            };
          });

          this.kpiTotalIn = totalIn;
          this.kpiTotalOut = totalOut;
          this.kpiBalance = totalIn - totalOut;

          // Sort chart data
          incomeData.sort((a, b) => a.x - b.x);
          expenseData.sort((a, b) => a.x - b.x);

          this.chartSeries = [
            { name: 'Entradas', data: incomeData },
            { name: 'Saídas', data: expenseData }
          ];

          try {
            this.applyFilters();
          } catch (e) {
            console.error('Error applying filters', e);
          }

          this.isLoadingTransactions = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Error loading transactions', err);
          this.isLoadingTransactions = false;
          this.allData = [];
          try {
            this.applyFilters();
          } catch (e) {
            console.error('Error applying filters in error handler', e);
          }
          this.kpiTotalIn = 0;
          this.kpiTotalOut = 0;
          this.kpiBalance = 0;
          this.chartSeries = [];
          this.cdr.detectChanges();
        });
      }
    });
  }

  get filteredData() {
    let data = [...this.allData];
    // Filtering is now handled server-side
    return data;
  }

  onDateIntervalChange() {
    if (this.dateInterval !== 'custom') {
      const days = parseInt(this.dateInterval, 10);
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - days);
      this.startDate = start;
      this.endDate = end;
    } else {
      // Initialize with current date for custom interval
      this.startDate = new Date();
      this.endDate = new Date();
    }
    this.currentPage = 1;
    if (this.selectedAccount) {
      this.loadTransactions(this.selectedAccount.id_code);
    }
  }

  onDateRangeChange() {
    this.currentPage = 1;
    if (this.selectedAccount) {
      this.loadTransactions(this.selectedAccount.id_code);
    }
  }

  onStartDateChange(event: any) {
    if (event && event.selectedDates && event.selectedDates.length > 0) {
      this.startDate = event.selectedDates[0];
      this.startDate?.setHours(0, 0, 0, 0);
    } else {
      this.startDate = null;
    }
    this.onDateRangeChange();
  }

  onEndDateChange(event: any) {
    if (event && event.selectedDates && event.selectedDates.length > 0) {
      this.endDate = event.selectedDates[0];
      this.endDate?.setHours(23, 59, 59, 999);
    } else {
      this.endDate = null;
    }
    this.onDateRangeChange();
  }

  // Filter & Pagination Methods
  onTypeFilterChange(type: any) {
    this.typeFilter = type;
    this.currentPage = 1;
    if (this.selectedAccount) {
      this.loadTransactions(this.selectedAccount.id_code);
    }
  }

  get selectedBankAccountBalance(): number {
    return this.selectedAccount?.balance || 0;
  }

  viewEvidence(file: { url: string }) {
    if (file.url) {
      window.open(file.url, '_blank');
    }
  }

  cancelDelete() {
    this.closeDeleteModal();
  }

  onSearch() {
    this.currentPage = 1;
    if (this.selectedAccount) {
      this.loadTransactions(this.selectedAccount.id_code);
    }
  }

  handleSort(key: string) {
    if (this.sortKey === key) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortOrder = 'asc';
    }
    this.applyFilters();
  }

  applyFilters() {
    let data = this.filteredData;

    // Sorting
    if (this.sortKey) {
      data.sort((a: any, b: any) => {
        let valA = a[this.sortKey!] || '';
        let valB = b[this.sortKey!] || '';

        // Handle specific raw fields for sorting
        if (this.sortKey === 'amount') {
          valA = a.rawAmount;
          valB = b.rawAmount;
        } else if (this.sortKey === 'date') {
          valA = a.rawDate;
          valB = b.rawDate;
        }

        if (valA < valB) return this.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    this.totalItems = data.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);

    // Pagination
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedData = data.slice(startIndex, startIndex + this.itemsPerPage);
  }

  onItemsPerPageChange() {
    this.currentPage = 1;
    this.applyFilters();
  }

  onPageChange(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyFilters();
    }
  }

  // Offcanvas Methods
  viewTransaction(transaction: Transaction) {
    this.selectedTransaction = transaction;
    this.isOffcanvasOpen = true;
  }

  closeOffcanvas() {
    this.isOffcanvasOpen = false;
    this.selectedTransaction = null;
  }

  exportToCsv() {
    // Data is already filtered by server
    let data = [...this.allData];

    // Sorting (optional for CSV but good for consistency)
    if (this.sortKey) {
      data.sort((a: any, b: any) => {
        let valA = a[this.sortKey!] || '';
        let valB = b[this.sortKey!] || '';
        if (this.sortKey === 'amount') { valA = a.rawAmount; valB = b.rawAmount; }
        else if (this.sortKey === 'date') { valA = a.rawDate; valB = b.rawDate; }
        if (valA < valB) return this.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    if (!data.length) {
      this.toastService.triggerToast('info', 'Nada para exportar', 'Não há dados para exportar com os filtros atuais.');
      return;
    }

    const headers = [
      this.translate.instant('financial.transactions.csv.headers.id'),
      this.translate.instant('financial.transactions.csv.headers.paymentDate'),
      this.translate.instant('financial.transactions.csv.headers.type'),
      this.translate.instant('financial.transactions.csv.headers.nf'),
      this.translate.instant('financial.transactions.csv.headers.description'),
      this.translate.instant('financial.transactions.csv.headers.category'),
      this.translate.instant('financial.transactions.csv.headers.costCenter'),
      this.translate.instant('financial.transactions.csv.headers.status'),
      this.translate.instant('financial.transactions.csv.headers.bankAccount'),
      this.translate.instant('financial.transactions.csv.headers.amount')
    ];

    const lines = data.map(row => {
      const values = [
        row.original?.id_code || '',
        row.rawDate ? row.rawDate.toLocaleDateString('pt-BR') : '',
        row.type,
        row.original?.nf || '',
        row.description,
        row.category,
        row.original?.finCostCenter?.name || '',
        row.status,
        row.original?.bank_account_id || '',
        row.rawAmount.toFixed(2)
      ];

      return values.map(value => {
        const str = value != null ? String(value) : '';
        return `"${str.replace(/"/g, '""')}"`;
      }).join(';');
    });

    const csvContent = [headers.join(';'), ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const storeCode = this.selectedStore?.id_code || 'store';
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `saldos_${storeCode}_${timestamp}.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 0);
  }
}
