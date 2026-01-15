import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FinancialService } from '../../financial.service';
import { ContaPagar, StatusConta } from '../../models/conta-pagar';

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

  // Filters similares a invoices
  statusFilter: 'all' | 'pending' | 'paid' | 'overdue' | 'canceled' = 'all';

  evidenceFiles: { name: string; url: string; file: File }[] = [];

  isEvidenceSidebarOpen = false;
  selectedTransaction: ContaPagar | null = null;
  selectedEvidenceItems: { name: string; url?: string; type: 'image' | 'pdf' | 'file'; extension?: string }[] = [];

  get paymentMethodRequiresBank(): boolean {
    const method = this.transactionForm.get('payment_method')?.value;
    const def = this.paymentMethods.find(m => m.value === method);
    return !!def?.requiresBankAccount;
  }

  constructor(private financial: FinancialService, private fb: FormBuilder, private cdr: ChangeDetectorRef) {
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
    if (this.transactionForm.invalid) return;

    const formVal = this.transactionForm.value;
    
    // Determine status based on is_paid checkbox
    const status: StatusConta = formVal.is_paid ? 'paid' : 'pending';

    const newTransaction: ContaPagar = {
      id_code: `txn-${Date.now()}`,
      vendor_id: formVal.party_id || 'N/A',
      nf: formVal.nf || undefined,
      amount: formVal.amount,
      description: formVal.description,
      due_date: new Date(formVal.due_date),
      paid_at: formVal.is_paid ? new Date(formVal.paid_at) : undefined,
      issue_date: new Date(),
      status: status,
      currency: 'BRL',
      type: formVal.type,
      cost_center: formVal.cost_center,
      category: formVal.category || 'Geral'
    };

    // Add to top
    this.allData.unshift(newTransaction);
    this.updatePagination();

    // Reset form preserving type
    this.transactionForm.reset({
      type: formVal.type,
      due_date: new Date().toISOString().split('T')[0],
      paid_at: null,
      status: 'pending',
      is_paid: false
    });
  }

  ngOnInit() {
    this.financial.getContasPagar().subscribe(rows => {
      this.allData = rows;
      this.updatePagination();
    });

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

    if (this.statusFilter !== 'all') {
      data = data.filter(item => item.status === this.statusFilter);
    }

    if (this.searchTerm) {
      const lowerTerm = this.searchTerm.toLowerCase();
      data = data.filter(item =>
        (item.vendor_id && item.vendor_id.toLowerCase().includes(lowerTerm)) ||
        (item.description && item.description.toLowerCase().includes(lowerTerm)) ||
        (item.nf && item.nf.toLowerCase().includes(lowerTerm))
      );
    }

    return data;
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

  onStatusFilterChange(status: 'all' | 'pending' | 'paid' | 'overdue' | 'canceled') {
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
