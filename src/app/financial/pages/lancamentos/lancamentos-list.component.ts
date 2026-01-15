import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FinancialService } from '../../financial.service';
import { ContaPagar, StatusConta } from '../../models/conta-pagar';
import { LocalStorageService } from '../../../shared/services/local-storage.service';
import { Store } from '../../../pages/pub/admin/home-admin/store.service';

// Material Imports
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-lancamentos-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './lancamentos-list.component.html',
})
export class LancamentosListComponent implements OnInit {
  protected readonly Math = Math;

  transactionForm!: FormGroup;
  transactionTypes = [
    { value: 'PAYABLE', label: 'Conta a Pagar' },
    { value: 'RECEIVABLE', label: 'Conta a Receber' },
    { value: 'TRANSFER', label: 'Transferência' },
    { value: 'ADJUSTMENT', label: 'Ajuste' }
  ];
  paymentMethods = [
    { value: 'cash', label: 'Dinheiro', requiresBankAccount: false },
    { value: 'pix', label: 'PIX', requiresBankAccount: true },
    { value: 'credit_card', label: 'Cartão de Crédito', requiresBankAccount: false },
    { value: 'debit_card', label: 'Cartão de Débito', requiresBankAccount: false },
    { value: 'bank_transfer', label: 'Transferência Bancária', requiresBankAccount: true },
    { value: 'boleto', label: 'Boleto Pago', requiresBankAccount: true }
  ];
  bankAccounts = [
    { id: 'acc-bb', label: 'Banco do Brasil • Ag 1234-5 • CC 99999-9' },
    { id: 'acc-nb', label: 'Nubank • Ag 0001 • CC 123456-7' }
  ];
  
  // Data Sources
  suppliers: any[] = [];
  customers: any[] = [];
  entities: any[] = []; // Dynamic list based on type
  costCenters: any[] = [];
  categories: any[] = [];
  
  allData: ContaPagar[] = [];
  paginatedData: ContaPagar[] = [];
  
  itemsPerPage = 10;
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  
  sortKey: string | null = null;
  sortOrder: 'asc' | 'desc' = 'asc';
  
  searchTerm: string = '';

  // Filtros inspirados em /invoices: Todos | Não pagos | Pagos
  statusFilter: 'all' | 'unpaid' | 'paid' = 'all';

  evidenceFiles: { name: string; url: string; file: File }[] = [];

  isEvidenceSidebarOpen = false;
  selectedTransaction: ContaPagar | null = null;
  selectedEvidenceItems: { name: string; url?: string; type: 'image' | 'pdf' | 'file'; extension?: string }[] = [];
  
  private readonly STORE_KEY = 'selectedStore';
  selectedStore: Store | null = null;

  isFormVisible = false;

  statusLabelMap: Record<StatusConta, string> = {
    pending: 'Pendente',
    approved: 'Aprovado',
    scheduled: 'Agendado',
    paid: 'Pago',
    overdue: 'Vencido',
    canceled: 'Cancelado'
  };

  get paymentMethodRequiresBank(): boolean {
    const method = this.transactionForm.get('payment_method')?.value;
    const def = this.paymentMethods.find(m => m.value === method);
    return !!def?.requiresBankAccount;
  }

  get totalPayablePending(): number {
    return this.allData
      .filter(t => t.type === 'PAYABLE' && t.status === 'pending')
      .reduce((acc, t) => acc + t.amount, 0);
  }

  get totalReceivablePending(): number {
    return this.allData
      .filter(t => t.type === 'RECEIVABLE' && t.status === 'pending')
      .reduce((acc, t) => acc + t.amount, 0);
  }

  get totalOverdue(): number {
    return this.allData
      .filter(t => t.status === 'overdue')
      .reduce((acc, t) => acc + t.amount, 0);
  }

  get totalPaid(): number {
    return this.allData
      .filter(t => t.status === 'paid')
      .reduce((acc, t) => acc + t.amount, 0);
  }

  constructor(
    private financial: FinancialService, 
    private fb: FormBuilder, 
    private cdr: ChangeDetectorRef,
    private localStorageService: LocalStorageService
  ) {
    this.initForm();
  }

  initForm() {
    this.transactionForm = this.fb.group({
      type: ['PAYABLE', Validators.required],
      nf: [''],
      description: ['', Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      due_date: [new Date().toISOString().split('T')[0], Validators.required],
      paid_at: [null],
      party_id: [''],
      cost_center: [''],
      category: [''],
      is_paid: [false],
      status: ['pending'],
      payment_method: [null],
      bank_account_id: [null],
      attachment_url: [''] // Added attachment field
    });

    // Listen to type changes to update entities list
    this.transactionForm.get('type')?.valueChanges.subscribe(type => {
      this.updateEntitiesList(type);
    });

    // Listen to is_paid changes to toggle paid_at requirement
    this.transactionForm.get('is_paid')?.valueChanges.subscribe(isPaid => {
      const paidAtControl = this.transactionForm.get('paid_at');
      const paymentMethodControl = this.transactionForm.get('payment_method');
      const bankAccountControl = this.transactionForm.get('bank_account_id');

      if (isPaid) {
        paidAtControl?.setValidators(Validators.required);
        if (!paidAtControl?.value) {
          paidAtControl?.setValue(new Date().toISOString().split('T')[0]);
        }
        paymentMethodControl?.setValidators(Validators.required);
        this.transactionForm.patchValue({ status: 'paid' }, { emitEvent: false });
      } else {
        paidAtControl?.clearValidators();
        paidAtControl?.setValue(null);

        paymentMethodControl?.clearValidators();
        paymentMethodControl?.setValue(null);

        bankAccountControl?.clearValidators();
        bankAccountControl?.setValue(null);

        this.transactionForm.patchValue({ status: 'pending' }, { emitEvent: false });
      }

      paidAtControl?.updateValueAndValidity();
      paymentMethodControl?.updateValueAndValidity();
      bankAccountControl?.updateValueAndValidity();
    });

    this.transactionForm.get('payment_method')?.valueChanges.subscribe(method => {
      const bankAccountControl = this.transactionForm.get('bank_account_id');
      const requiresBank = this.paymentMethods.find(m => m.value === method)?.requiresBankAccount;
      if (requiresBank && this.transactionForm.get('is_paid')?.value) {
        bankAccountControl?.setValidators(Validators.required);
      } else {
        bankAccountControl?.clearValidators();
        bankAccountControl?.setValue(null);
      }
      bankAccountControl?.updateValueAndValidity();
    });
  }

  toggleForm() {
    this.isFormVisible = !this.isFormVisible;
  }

  updateEntitiesList(type: string) {
    if (type === 'PAYABLE') {
      this.entities = this.suppliers.map(s => ({ id: s.id_code, name: s.name }));
    } else if (type === 'RECEIVABLE') {
      this.entities = this.customers.map(c => ({ id: c.id_code, name: c.name }));
    } else {
      this.entities = [];
    }
    // Clear entity selection when type changes
    this.transactionForm.patchValue({ party_id: '' });
  }

  onEvidenceFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    const mapped = files.map(file => ({
      name: file.name,
      url: URL.createObjectURL(file),
      file
    }));
    this.evidenceFiles = [...this.evidenceFiles, ...mapped];
    this.cdr.detectChanges();
  }

  viewEvidence(file: { url: string }) {
    window.open(file.url, '_blank');
  }

  removeEvidence(index: number) {
    const file = this.evidenceFiles[index];
    if (file) {
      URL.revokeObjectURL(file.url);
    }
    this.evidenceFiles = this.evidenceFiles.filter((_, i) => i !== index);
  }

  private inferEvidenceType(url: string): 'image' | 'pdf' | 'file' {
    const lower = url.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp')) {
      return 'image';
    }
    if (lower.endsWith('.pdf')) {
      return 'pdf';
    }
    return 'file';
  }

  openEvidenceSidebar(row: ContaPagar) {
    this.selectedTransaction = row;
    const items: { name: string; url?: string; type: 'image' | 'pdf' | 'file'; extension?: string }[] = [];

    if (row.attachment_url) {
      const type = this.inferEvidenceType(row.attachment_url);
      const extensionMatch = row.attachment_url.split('.').pop();
      const extension = extensionMatch ? extensionMatch.toUpperCase() : undefined;
      items.push({
        name: row.attachment_url.split('/').pop() || 'Evidência',
        url: row.attachment_url,
        type,
        extension
      });
    }

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

  saveTransaction() {
    if (this.transactionForm.valid) {
      if (!this.selectedStore || !this.selectedStore.id_code) {
        alert('Nenhuma empresa selecionada!');
        return;
      }

      const formValue = this.transactionForm.value;
      
      // Prepare payload based on documentation
      const payload: any = {
        type: formValue.type,
        description: formValue.description,
        amount: formValue.amount,
        due_date: new Date(formValue.due_date).toISOString().split('T')[0], // YYYY-MM-DD
        is_paid: formValue.is_paid,
        status: formValue.is_paid ? 'paid' : 'pending',
        store_id: this.selectedStore.id_code
      };

      // Optional fields
      if (formValue.nf) payload.nf = formValue.nf;
      if (formValue.party_id) payload.party_id = formValue.party_id;
      if (formValue.cost_center) payload.cost_center = formValue.cost_center;
      if (formValue.category) payload.category = formValue.category;
      if (formValue.attachment_url) payload.attachment_url = formValue.attachment_url;

      // Conditional fields for PAID status
      if (formValue.is_paid) {
        payload.paid_at = new Date(formValue.paid_at).toISOString().split('T')[0]; // YYYY-MM-DD
        payload.payment_method = formValue.payment_method;
        
        // Conditional bank_account_id
        if (['pix', 'bank_transfer', 'boleto'].includes(formValue.payment_method)) {
          payload.bank_account_id = formValue.bank_account_id;
        }
      }

      console.log('Enviando payload:', payload);

      this.financial.createTransaction(payload).subscribe({
        next: (response) => {
          console.log('Transação criada com sucesso', response);
          this.toggleForm();
          this.initForm(); // Reset form
          
          // Refresh list
          if (this.selectedStore?.id_code) {
            this.financial.getContasPagar(this.selectedStore.id_code).subscribe(rows => {
              this.allData = this.normalizeRows(rows);
              this.updatePagination();
            });
          }
          alert('Lançamento criado com sucesso!');
        },
        error: (err) => {
          console.error('Erro ao criar transação', err);
          alert('Erro ao criar lançamento. Verifique os dados e tente novamente.');
        }
      });
    } else {
      // Mark all fields as touched to show errors
      Object.keys(this.transactionForm.controls).forEach(key => {
        this.transactionForm.get(key)?.markAsTouched();
      });
      alert('Por favor, preencha todos os campos obrigatórios corretamente.');
    }
  }

  ngOnInit() {
    this.selectedStore = this.localStorageService.getData<Store>(this.STORE_KEY);

    if (this.selectedStore && this.selectedStore.id_code) {
      this.financial.getContasPagar(this.selectedStore.id_code).subscribe({
        next: (rows) => {
          this.allData = this.normalizeRows(rows);
          this.updatePagination();
        },
        error: (err) => console.error('Erro ao buscar lançamentos', err)
      });
    } else {
      this.allData = [];
      this.updatePagination();
    }

    // Load dependencies
    this.financial.getFornecedores().subscribe(data => {
      this.suppliers = data;
      this.updateEntitiesList(this.transactionForm.get('type')?.value || 'PAYABLE');
    });

    this.financial.getClientes().subscribe(data => {
      this.customers = data;
      // Re-update if type is RECEIVABLE (unlikely on init but good practice)
      const currentType = this.transactionForm.get('type')?.value;
      if (currentType === 'RECEIVABLE') {
        this.updateEntitiesList(currentType);
      }
    });

    this.financial.getCategorias().subscribe(data => {
      this.categories = data;
    });

    this.financial.getCentrosDeCusto().subscribe(data => {
      this.costCenters = data;
    });
  }

  // Search + filtros
  get filteredData() {
    let data = this.allData;

    if (this.statusFilter === 'paid') {
      data = data.filter(item => item.status === 'paid');
    } else if (this.statusFilter === 'unpaid') {
      data = data.filter(item => item.status !== 'paid' && item.status !== 'canceled');
    }

    if (this.searchTerm) {
      const lowerTerm = this.searchTerm.toLowerCase();
      data = data.filter(item =>
        ((item as any).party_id && ((item as any).party_id as string).toLowerCase().includes(lowerTerm)) ||
        (item.vendor_id && item.vendor_id.toLowerCase().includes(lowerTerm)) ||
        (item.description && item.description.toLowerCase().includes(lowerTerm)) ||
        (item.nf && item.nf.toLowerCase().includes(lowerTerm)) ||
        (item.category && item.category.toLowerCase().includes(lowerTerm)) ||
        (item.cost_center && item.cost_center.toLowerCase().includes(lowerTerm)) ||
        (item.id_code && item.id_code.toLowerCase().includes(lowerTerm))
      );
    }

    return data;
  }

  isDelayed(row: ContaPagar): boolean {
    if (!row.due_date || row.status !== 'pending') {
      return false;
    }
    const due = new Date(row.due_date);
    if (isNaN(due.getTime())) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }

  private normalizeRows(rows: ContaPagar[]): ContaPagar[] {
    return rows.map(row => {
      const amount = typeof row.amount === 'string' ? parseFloat(row.amount as any) : row.amount;
      const statusValue = ((row.status as unknown as string) || 'pending').toLowerCase() as StatusConta;
      return {
        ...row,
        amount: isNaN(amount as number) ? 0 : (amount as number),
        status: statusValue
      };
    });
  }

  getStatusLabel(status: StatusConta | string | null | undefined): string {
    const key = (status || 'pending').toString().toLowerCase() as StatusConta;
    return this.statusLabelMap[key] || (status as string) || '';
  }

  // Pagination Logic
  updatePagination() {
    let data = this.filteredData;
    
    // Sort
    if (this.sortKey) {
      data = this.sortData(data, this.sortKey, this.sortOrder);
    }
    
    this.totalItems = data.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    
    // Ensure current page is valid
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedData = data.slice(startIndex, startIndex + this.itemsPerPage);
  }

  onItemsPerPageChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.updatePagination();
  }
  
  onSearchChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  onStatusFilterChange(status: 'all' | 'unpaid' | 'paid') {
    this.statusFilter = status;
    this.currentPage = 1;
    this.updatePagination();
  }

  // Sorting Logic
  handleSort(key: string) {
    if (this.sortKey === key) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortOrder = 'asc';
    }
    this.updatePagination();
  }

  sortData(data: any[], key: string, order: 'asc' | 'desc'): any[] {
    return [...data].sort((a, b) => {
      const valueA = a[key];
      const valueB = b[key];

      if (valueA < valueB) {
        return order === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
  
  // Helpers for template
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
