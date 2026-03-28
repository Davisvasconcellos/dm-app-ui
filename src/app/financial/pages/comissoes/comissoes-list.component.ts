import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import Swiper from 'swiper';
import { FinancialService } from '../../financial.service';
import { FinancialToastService } from '../../financial-toast.service';
import { BadgeComponent } from '../../../shared/components/ui/badge/badge.component';
import { StoreContextService } from '../../../shared/services/store-context.service';
import { Commission } from '../../models/comissao';

@Component({
  selector: 'app-comissoes-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BadgeComponent,
    TranslateModule,
  ],
  templateUrl: './comissoes-list.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ComissoesListComponent implements OnInit, AfterViewInit {
  @ViewChild('swiperRef') swiperRef!: ElementRef;
  public swiperInstance: Swiper | undefined;

  private financial = inject(FinancialService);
  private storeContext = inject(StoreContextService);
  private toastService = inject(FinancialToastService);
  private translate = inject(TranslateService);

  selectedStore: any = null;
  bankAccounts: any[] = [];
  selectedAccount: any = null;

  commissions: Commission[] = [];
  isLoading = false;

  ngAfterViewInit() {
    if (this.swiperRef) {
      setTimeout(() => {
        this.swiperInstance = (this.swiperRef.nativeElement as any).swiper;
      }, 500);
    }
  }

  // Filters
  statusFilter: 'all' | 'pending' | 'paid' | 'canceled' = 'all';
  searchTerm = '';

  // Selection
  selectedCommissions = new Set<string>();

  // KPIs
  kpiPendingAmount = 0;
  kpiPaidAmount = 0;
  kpiPendingCount = 0;
  kpiPaidCount = 0;

  // Pagination meta
  totalItems = 0;
  currentPage = 1;
  itemsPerPage = 20;
  totalPages = 1;

  ngOnInit() {
    this.storeContext.activeStore$.subscribe(store => {
      if (store) {
        this.selectedStore = store;
        this.loadBankAccounts();
        this.loadCommissions();
      }
    });
  }

  loadBankAccounts() {
    if (!this.selectedStore?.id_code) return;
    this.financial.getBankAccounts(this.selectedStore.id_code).subscribe({
      next: (accounts) => {
        this.bankAccounts = accounts.map((a: any) => ({
          ...a,
          displayBalance: a.current_balance !== undefined ? a.current_balance : (a.balance || 0)
        }));
        // Select default account if available
        if (!this.selectedAccount && accounts.length > 0) {
          const defaultAcc = this.bankAccounts.find((a: any) => a.is_default) || this.bankAccounts[0];
          this.selectedAccount = defaultAcc;
        }
      },
      error: (err) => console.error('Erro ao carregar contas', err)
    });
  }

  selectAccount(account: any) {
    this.selectedAccount = account;
  }

  loadCommissions() {
    if (!this.selectedStore?.id_code) return;
    this.isLoading = true;

    const filters: any = {
      page: this.currentPage,
      limit: this.itemsPerPage
    };

    if (this.statusFilter !== 'all') {
      filters.status = this.statusFilter;
    }

    this.financial.getCommissions(this.selectedStore.id_code, filters).subscribe({
      next: (response) => {
        this.commissions = response.data.map((c: any) => ({
          ...c,
          commission_rate: typeof c.commission_rate === 'string' ? parseFloat(c.commission_rate) : c.commission_rate,
          commission_amount: typeof c.commission_amount === 'string' ? parseFloat(c.commission_amount) : c.commission_amount,
          sourceTransaction: c.sourceTransaction ? {
            ...c.sourceTransaction,
            amount: typeof c.sourceTransaction.amount === 'string' ? parseFloat(c.sourceTransaction.amount) : c.sourceTransaction.amount
          } : null
        }));

        const summary = response.summary || {};
        this.kpiPendingCount = summary.pending?.count || 0;
        this.kpiPendingAmount = summary.pending?.amount || 0;
        this.kpiPaidCount = summary.paid?.count || 0;
        this.kpiPaidAmount = summary.paid?.amount || 0;

        this.totalItems = response.meta.total;
        this.totalPages = response.meta.pages;
        this.isLoading = false;
        this.selectedCommissions.clear();
      },
      error: (err) => {
        console.error('Erro ao carregar comissões', err);
        this.toastService.triggerToast('error', 'Erro', 'Não foi possível carregar as comissões.');
        this.isLoading = false;
      }
    });
  }

  onStatusFilterChange(status: string) {
    this.statusFilter = status as any;
    this.currentPage = 1;
    this.loadCommissions();
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.loadCommissions();
  }

  toggleSelection(commId: string) {
    if (this.selectedCommissions.has(commId)) {
      this.selectedCommissions.delete(commId);
    } else {
      this.selectedCommissions.add(commId);
    }
  }

  isAllSelected(): boolean {
    const payable = this.commissions.filter(c => c.payable);
    return payable.length > 0 && payable.every(c => this.selectedCommissions.has(c.id_code));
  }

  hasPayableCommissions(): boolean {
    return this.commissions.some(c => c.payable);
  }

  toggleAll(event: any) {
    const checked = event.target.checked;
    if (checked) {
      this.commissions.forEach(c => {
        if (c.payable) {
          this.selectedCommissions.add(c.id_code);
        }
      });
    } else {
      this.selectedCommissions.clear();
    }
  }

  getBadgeColor(status: string): 'success' | 'warning' | 'error' | 'primary' {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': return 'warning';
      case 'canceled': return 'error';
      default: return 'primary';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'paid': return 'Pago';
      case 'pending': return 'Pendente';
      case 'canceled': return 'Cancelado';
      default: return status;
    }
  }

  paySelected() {
    if (this.selectedCommissions.size === 0) {
      this.toastService.triggerToast('warning', 'Nenhuma seleção', 'Selecione ao menos uma comissão para pagar.');
      return;
    }
    if (!this.selectedAccount) {
      this.toastService.triggerToast('warning', 'Conta não selecionada', 'Selecione uma conta bancária para realizar o pagamento.');
      return;
    }

    if (!this.selectedStore?.id_code) return;

    this.isLoading = true;
    const payload = {
      commission_ids: Array.from(this.selectedCommissions),
      bank_account_id: this.selectedAccount.id_code,
      payment_method: 'bank_transfer'
    };

    this.financial.payCommissions(this.selectedStore.id_code, payload).subscribe({
      next: (response) => {
        this.isLoading = false;

        let successMsg = `Comissões processadas com sucesso.`;
        if (response.data) {
          const { paid_count, not_found_count, skipped_count } = response.data;
          successMsg = `${paid_count} comissão(ões) paga(s) via ${this.selectedAccount.name}.`;
          if (not_found_count > 0) {
            successMsg += ` (${not_found_count} não encontradas).`;
          }
          if (skipped_count > 0) {
            this.toastService.triggerToast('warning', 'Comissões não elegíveis',
              `${skipped_count} comissão(ões) não paga(s): a transação de origem ainda não foi quitada.`);
          }
        }

        this.toastService.triggerToast('success', 'Pagamento Realizado', successMsg);

        // Reload list and KPIs
        this.selectedCommissions.clear();
        this.loadCommissions();
        this.loadBankAccounts(); // refresh bank balance just in case
      },
      error: (err) => {
        console.error('Erro ao pagar comissões', err);
        this.isLoading = false;
        this.toastService.triggerToast('error', 'Erro no Pagamento', 'Houve um erro ao processar o pagamento das comissões.');
      }
    });
  }

  get selectedCommissionsTotal(): number {
    return this.commissions
      .filter(c => this.selectedCommissions.has(c.id_code))
      .reduce((acc, c) => acc + (Number(c.commission_amount) || 0), 0);
  }

  get visiblePages(): number[] {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
