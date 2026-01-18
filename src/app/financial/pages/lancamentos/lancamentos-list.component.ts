import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FinancialService } from '../../financial.service';
import { FinancialToastService } from '../../financial-toast.service';
import { ContaPagar, StatusConta, TransactionsSummary } from '../../models/conta-pagar';
import { LocalStorageService } from '../../../shared/services/local-storage.service';
import { Store } from '../../../pages/pub/admin/home-admin/store.service';
import { PopoverComponent } from '../../../shared/components/ui/popover/popover/popover.component';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { UploadService } from '../../../services/upload.service';
import { forkJoin } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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
    TranslateModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    PopoverComponent,
    ModalComponent
  ],
  templateUrl: './lancamentos-list.component.html',
})
export class LancamentosListComponent implements OnInit {
  protected readonly Math = Math;

  transactionForm!: FormGroup;
  transactionTypes = [
    { value: 'PAYABLE', labelKey: 'financial.transactions.type.payable' },
    { value: 'RECEIVABLE', labelKey: 'financial.transactions.type.receivable' },
    { value: 'TRANSFER', labelKey: 'financial.transactions.type.transfer' },
    { value: 'ADJUSTMENT', labelKey: 'financial.transactions.type.adjustment' }
  ];
  paymentMethods = [
    { value: 'cash', labelKey: 'financial.transactions.form.payment.cash', requiresBankAccount: false },
    { value: 'pix', labelKey: 'financial.transactions.form.payment.pix', requiresBankAccount: true },
    { value: 'credit_card', labelKey: 'financial.transactions.form.payment.creditCard', requiresBankAccount: false },
    { value: 'debit_card', labelKey: 'financial.transactions.form.payment.debitCard', requiresBankAccount: false },
    { value: 'bank_transfer', labelKey: 'financial.transactions.form.payment.bankTransfer', requiresBankAccount: true },
    { value: 'boleto', labelKey: 'financial.transactions.form.payment.billet', requiresBankAccount: true }
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
  existingEvidenceFiles: { name: string; url: string; type: 'image' | 'pdf' | 'file' }[] = [];
  evidenceWarningMessage: string | null = null;

  isEvidenceSidebarOpen = false;
  selectedTransaction: ContaPagar | null = null;
  selectedEvidenceItems: { name: string; url?: string; type: 'image' | 'pdf' | 'file'; extension?: string }[] = [];
  isDeleteModalOpen = false;
  transactionToDelete: ContaPagar | null = null;
  
  private readonly STORE_KEY = 'selectedStore';
  selectedStore: Store | null = null;

  summary: TransactionsSummary | null = null;

  isFormVisible = false;

  formMode: 'create' | 'edit' | 'pay' | 'cancel' | 'delete' = 'create';
  editingTransaction: ContaPagar | null = null;

  statusLabelMap: Record<StatusConta, string> = {
    pending: 'financial.transactions.status.pending',
    approved: 'financial.transactions.status.approved',
    scheduled: 'financial.transactions.status.scheduled',
    paid: 'financial.transactions.status.paid',
    overdue: 'financial.transactions.status.overdue',
    canceled: 'financial.transactions.status.canceled'
  };

  get paymentMethodRequiresBank(): boolean {
    const method = this.transactionForm.get('payment_method')?.value;
    const def = this.paymentMethods.find(m => m.value === method);
    return !!def?.requiresBankAccount;
  }

  get totalPayablePending(): number {
    if (this.summary?.payable?.pending != null) {
      return this.summary.payable.pending;
    }
    return this.allData
      .filter(t => t.type === 'PAYABLE' && t.status === 'pending')
      .reduce((acc, t) => acc + t.amount, 0);
  }

  get totalReceivablePending(): number {
    if (this.summary?.receivable?.pending != null) {
      return this.summary.receivable.pending;
    }
    return this.allData
      .filter(t => t.type === 'RECEIVABLE' && t.status === 'pending')
      .reduce((acc, t) => acc + t.amount, 0);
  }

  get totalPayablePaid(): number {
    if (this.summary?.payable?.paid != null) {
      return this.summary.payable.paid;
    }
    return this.allData
      .filter(t => t.type === 'PAYABLE' && t.status === 'paid')
      .reduce((acc, t) => acc + t.amount, 0);
  }

  get totalReceivablePaid(): number {
    if (this.summary?.receivable?.paid != null) {
      return this.summary.receivable.paid;
    }
    return this.allData
      .filter(t => t.type === 'RECEIVABLE' && t.status === 'paid')
      .reduce((acc, t) => acc + t.amount, 0);
  }

  get totalOverdue(): number {
    if (this.summary?.overdue != null) {
      return this.summary.overdue;
    }
    return this.allData
      .filter(t => t.status === 'overdue')
      .reduce((acc, t) => acc + t.amount, 0);
  }

  get totalPaid(): number {
    if (this.summary?.total_paid != null) {
      return this.summary.total_paid;
    }
    return this.allData
      .filter(t => t.status === 'paid')
      .reduce((acc, t) => acc + t.amount, 0);
  }

  constructor(
    private financial: FinancialService, 
    private fb: FormBuilder, 
    private cdr: ChangeDetectorRef,
    private localStorageService: LocalStorageService,
    private toastService: FinancialToastService,
    private uploadService: UploadService,
    private translate: TranslateService
  ) {
    this.initForm();
  }

  private loadTransactions() {
    if (!this.selectedStore || !this.selectedStore.id_code) {
      this.allData = [];
      this.paginatedData = [];
      this.totalItems = 0;
      this.totalPages = 1;
      this.summary = null;
      return;
    }

    // Carrega "tudo" (limite alto) para permitir filtro no front
    // e mantém os KPIs globais (independentes dos filtros da listagem)
    this.financial.getContasPagar(this.selectedStore.id_code, 1, 1000, false).subscribe({
      next: (result) => {
        const rows = result.transactions || [];
        this.allData = this.normalizeRows(rows);
        this.summary = result.summary || null;
        
        // Atualiza paginação com os dados carregados
        this.updatePagination();
      },
      error: (err) => {
        console.error('Erro ao buscar lançamentos', err);
        this.allData = [];
        this.paginatedData = [];
        this.totalItems = 0;
        this.totalPages = 1;
        this.summary = null;
      }
    });
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

  private inferEvidenceType(input: string): 'image' | 'pdf' | 'file' {
    const lower = input.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp')) {
      return 'image';
    }
    if (lower.endsWith('.pdf')) {
      return 'pdf';
    }
    return 'file';
  }

  private parseAttachmentsJson(raw: string): { url: string; filename: string }[] {
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

  private getRowAttachments(row: ContaPagar): { url: string; filename: string }[] {
    const fromRow = (row as any).attachments as { url?: string; filename?: string }[] | undefined;
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

    if (row.attachment_url) {
      const raw = row.attachment_url.trim();
      const fromJson = this.parseAttachmentsJson(raw);
      if (fromJson.length > 0) {
        attachments.push(...fromJson);
      } else {
        const urls = raw
          .split(/[;,]/)
          .map(part => part.trim())
          .filter(part => part.length > 0);

        urls.forEach(url => {
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

  toggleForm() {
    this.isFormVisible = !this.isFormVisible;

    if (this.isFormVisible && this.transactionForm) {
      this.formMode = 'create';
      this.editingTransaction = null;
      this.existingEvidenceFiles = [];

      Object.keys(this.transactionForm.controls).forEach(key => {
        this.transactionForm.get(key)?.enable({ emitEvent: false });
      });

      this.transactionForm.reset({
        type: 'PAYABLE',
        nf: '',
        description: '',
        amount: null,
        due_date: new Date().toISOString().split('T')[0],
        paid_at: null,
        party_id: '',
        cost_center: '',
        category: '',
        is_paid: false,
        status: 'pending',
        payment_method: null,
        bank_account_id: null,
        attachment_url: ''
      });

      this.updateEntitiesList('PAYABLE');
    }
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

    if (!files.length) {
      return;
    }

    const maxFiles = 5;
    const maxSizeBytes = 2 * 1024 * 1024;
    const allowedExtensions = ['jpg', 'jpeg', 'pdf', 'txt', 'csv'];

    const remainingSlots = maxFiles - this.evidenceFiles.length;
    const filesWithinLimit = remainingSlots > 0 ? files.slice(0, remainingSlots) : [];

    let rejectedByCount = files.length - filesWithinLimit.length;
    let rejectedBySize = 0;
    let rejectedByType = 0;

    const mapped = filesWithinLimit.reduce<{ name: string; url: string; file: File }[]>((acc, file) => {
      const name = file.name || '';
      const extension = name.includes('.') ? name.split('.').pop() || '' : '';
      const normalizedExtension = extension.toLowerCase();

      if (!allowedExtensions.includes(normalizedExtension)) {
        rejectedByType++;
        return acc;
      }

      if (file.size > maxSizeBytes) {
        rejectedBySize++;
        return acc;
      }

      acc.push({
        name,
        url: URL.createObjectURL(file),
        file
      });
      return acc;
    }, []);

    if (rejectedByCount > 0 || rejectedBySize > 0 || rejectedByType > 0) {
      const reasons: string[] = [];
      if (rejectedByCount > 0) {
        reasons.push(this.translate.instant('financial.evidence.warning.fileLimit'));
      }
      if (rejectedBySize > 0) {
        reasons.push(this.translate.instant('financial.evidence.warning.fileSize'));
      }
      if (rejectedByType > 0) {
        reasons.push(this.translate.instant('financial.evidence.warning.fileType'));
      }
      this.evidenceWarningMessage = this.translate.instant('financial.evidence.warning.ignoredFiles', {
        reasons: reasons.join(this.translate.instant('financial.evidence.warning.andSeparator'))
      });
    } else {
      this.evidenceWarningMessage = null;
    }

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

  openEvidenceSidebar(row: ContaPagar) {
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

  openDeleteModal(row: ContaPagar) {
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

  canEdit(row: ContaPagar): boolean {
    return row.status !== 'paid' && row.status !== 'canceled';
  }

  canPay(row: ContaPagar): boolean {
    return row.status !== 'paid' && row.status !== 'canceled';
  }

  canCancel(row: ContaPagar): boolean {
    return row.status !== 'canceled';
  }

  canDelete(row: ContaPagar): boolean {
    return row.status !== 'paid' && row.status !== 'canceled';
  }

  onSelectRowAction(event: MouseEvent, row: ContaPagar, mode: 'edit' | 'pay' | 'cancel' | 'delete') {
    try { event.stopPropagation(); } catch {}
    
    if (row.status === 'canceled') {
      this.toastService.triggerToast(
        'warning',
        'Ação não permitida',
        'Lançamentos cancelados não podem ser editados, pagos, cancelados novamente ou excluídos.'
      );
      return;
    }

    if (mode === 'delete') {
      this.openDeleteModal(row);
      return;
    }
    this.startFormFromRow(row, mode);
  }

  private startFormFromRow(row: ContaPagar, mode: 'edit' | 'pay' | 'cancel') {
    this.formMode = mode;
    this.editingTransaction = row;
    this.isFormVisible = true;

    Object.keys(this.transactionForm.controls).forEach(key => {
      this.transactionForm.get(key)?.enable({ emitEvent: false });
    });

    const isPaid = mode === 'pay' || row.status === 'paid';
    const raw: any = row as any;

    const dueDateValue = row.due_date ? new Date(row.due_date) : new Date();
    const paidAtValue = isPaid && row.paid_at ? new Date(row.paid_at as any) : null;

    this.transactionForm.patchValue({
      type: row.type || 'PAYABLE',
      nf: raw.nf || '',
      description: row.description || '',
      amount: row.amount,
      due_date: dueDateValue,
      paid_at: paidAtValue,
      party_id: raw.party_id || row.vendor_id || '',
      cost_center: row.cost_center || '',
      category: row.category || '',
      is_paid: isPaid,
      status: isPaid ? 'paid' : (row.status || 'pending'),
      payment_method: isPaid ? raw.payment_method || null : null,
      bank_account_id: isPaid ? raw.bank_account_id || null : null,
      attachment_url: row.attachment_url || ''
    });

    this.updateEntitiesList(this.transactionForm.get('type')?.value || 'PAYABLE');

    const attachments = this.getRowAttachments(row);
    this.existingEvidenceFiles = attachments.map(att => {
      const type = this.inferEvidenceType(att.url || att.filename);
      return {
        name: att.filename,
        url: att.url,
        type
      };
    });

    if (mode === 'pay') {
      const controlsToDisable = [
        'type',
        'description',
        'amount',
        'due_date',
        'party_id',
        'cost_center',
        'category',
        'status',
        'attachment_url'
      ];
      controlsToDisable.forEach(name => {
        this.transactionForm.get(name)?.disable({ emitEvent: false });
      });

      const hasNf = !!raw.nf;
      const nfControl = this.transactionForm.get('nf');
      if (hasNf) {
        nfControl?.disable({ emitEvent: false });
      } else {
        nfControl?.enable({ emitEvent: false });
      }

      this.transactionForm.get('is_paid')?.disable({ emitEvent: false });
    } else if (mode === 'cancel') {
      // Disable all fields for cancellation confirmation
      Object.keys(this.transactionForm.controls).forEach(key => {
        this.transactionForm.get(key)?.disable({ emitEvent: false });
      });
    } else if (mode === 'edit') {
      // due_date cannot be changed via PATCH
      this.transactionForm.get('due_date')?.disable({ emitEvent: false });
    }

    try {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {}
  }

  private deleteTransaction(row: ContaPagar) {
    if (row.status === 'paid') {
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

    this.financial.updateTransaction(row.id_code, { is_deleted: true }).subscribe({
      next: () => {
        this.toastService.triggerToast('success', 'Lançamento excluído', 'O lançamento foi excluído com sucesso e não aparecerá mais na listagem nem nos KPIs.');
        if (this.selectedStore?.id_code) {
          this.loadTransactions();
        }
      },
      error: (err) => {
        console.error('Erro ao excluir lançamento', err);
        const msg = err?.error?.message || err?.message || 'Erro ao excluir lançamento. Verifique e tente novamente.';
        this.toastService.triggerToast('error', 'Erro na exclusão', msg);
      }
    });
  }

  saveTransaction() {
    // If canceling, skip validation since fields are disabled
    if (this.transactionForm.valid || this.formMode === 'cancel') {
      if (!this.selectedStore || !this.selectedStore.id_code) {
        this.toastService.triggerToast('warning', 'Empresa não selecionada', 'É obrigatório selecionar uma empresa para registrar o lançamento.');
        return;
      }

      const formValue = this.transactionForm.getRawValue();
      
      const payload: any = {
        type: formValue.type,
        description: formValue.description,
        amount: formValue.amount,
        due_date: new Date(formValue.due_date).toISOString().split('T')[0],
        is_paid: formValue.is_paid,
        status: formValue.is_paid ? 'paid' : 'pending',
        store_id: this.selectedStore.id_code
      };

      if (formValue.nf) payload.nf = formValue.nf;
      if (formValue.party_id) payload.party_id = formValue.party_id;
      if (formValue.cost_center) payload.cost_center = formValue.cost_center;
      if (formValue.category) payload.category = formValue.category;
      if (formValue.attachment_url) payload.attachment_url = formValue.attachment_url;

      if (formValue.is_paid) {
        payload.paid_at = new Date(formValue.paid_at).toISOString().split('T')[0];
        payload.payment_method = formValue.payment_method;
        
        if (['pix', 'bank_transfer', 'boleto'].includes(formValue.payment_method)) {
          payload.bank_account_id = formValue.bank_account_id;
        }
      }

      console.log('Enviando payload:', payload);

      const isEditMode = ['edit', 'pay', 'cancel'].includes(this.formMode) && this.editingTransaction?.id_code;

      const request$ = isEditMode
        ? (() => {
            const { due_date, ...updatePayload } = payload;

            if (this.formMode === 'cancel') {
              const cancelPayload: any = {
                is_paid: false,
                status: 'canceled',
                paid_at: null,
                payment_method: null,
                bank_account_id: null
              };
              return this.financial.updateTransaction(this.editingTransaction!.id_code, cancelPayload);
            }

            return this.financial.updateTransaction(this.editingTransaction!.id_code, updatePayload);
          })()
        : this.financial.createTransaction(payload);

      request$.subscribe({
        next: (response) => {
          const action = this.formMode === 'cancel' ? 'cancelado' : (['edit', 'pay'].includes(this.formMode) ? 'atualizado' : 'criado');
          console.log('[FINANCIAL] Resposta da API do lançamento', response);
          console.log(`Transação ${action} com sucesso`);

          const wasCreate = !isEditMode;
          const hasEvidence = this.evidenceFiles.length > 0;
          console.log('[FINANCIAL] Pós-processamento lançamento', {
            wasCreate,
            evidenceFilesCount: this.evidenceFiles.length
          });

          this.toggleForm();
          this.initForm();
          
          if (this.selectedStore?.id_code) {
            this.loadTransactions();
          }

          if (wasCreate && this.evidenceFiles.length > 0) {
            this.toastService.triggerToast(
              'info',
              '1/2 Lançamento registrado',
              `O lançamento foi ${action} e as evidências serão enviadas em seguida. Não feche o navegador até concluir.`,
              5000
            );
            const createdId = this.extractTransactionIdFromResponse(response);
            console.log('[FINANCIAL] ID extraído para upload de evidências', createdId);
            if (createdId) {
              this.uploadEvidenceFilesForTransaction(createdId);
            } else {
              this.toastService.triggerToast(
                'warning',
                'Evidências não anexadas',
                'O lançamento foi criado, mas não foi possível identificar o ID para anexar os arquivos.'
              );
              this.clearEvidenceFiles();
            }
          } else if (!wasCreate && this.evidenceFiles.length > 0) {
            this.toastService.triggerToast(
              'info',
              '1/2 Lançamento atualizado',
              'As evidências deste lançamento serão enviadas em seguida. Não feche o navegador até concluir.',
              5000
            );
            // Incremental upload for edit/pay
            if (this.editingTransaction?.id_code) {
              this.uploadEvidenceFilesForTransaction(this.editingTransaction.id_code);
            }
          }

          if (!hasEvidence) {
            this.toastService.triggerToast(
              'success',
              'Lançamento processado',
              `O lançamento financeiro foi ${action} com sucesso no sistema.`
            );
          }
        },
        error: (err) => {
          console.error('Erro ao processar transação', err);
          const msg = err?.error?.message || err?.message || 'Erro ao processar lançamento. Verifique os dados e tente novamente.';
          this.toastService.triggerToast('error', 'Erro no lançamento', 'Não foi possível registrar o lançamento. ' + msg);
        }
      });
    } else {
      Object.keys(this.transactionForm.controls).forEach(key => {
        this.transactionForm.get(key)?.markAsTouched();
      });
      this.toastService.triggerToast('warning', 'Dados incompletos', 'Por favor, preencha todos os campos obrigatórios corretamente para continuar.');
    }
  }

  ngOnInit() {
    this.selectedStore = this.localStorageService.getData<Store>(this.STORE_KEY);

    if (this.selectedStore && this.selectedStore.id_code) {
      this.loadTransactions();
    } else {
      this.allData = [];
      this.paginatedData = [];
      this.totalItems = 0;
      this.totalPages = 1;
      this.summary = null;
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
    const normalized = (status || 'pending').toString().toLowerCase() as StatusConta;
    const translationKey = this.statusLabelMap[normalized];
    if (translationKey) {
      return this.translate.instant(translationKey);
    }
    return status ? status.toString() : '';
  }

  exportToCsv() {
    const rows = this.filteredData;

    if (!rows.length) {
      this.toastService.triggerToast(
        'info',
        this.translate.instant('financial.transactions.csv.nothingToExportTitle'),
        this.translate.instant('financial.transactions.csv.nothingToExportMessage')
      );
      return;
    }

    const headers = [
      this.translate.instant('financial.transactions.csv.headers.id'),
      this.translate.instant('financial.transactions.csv.headers.type'),
      this.translate.instant('financial.transactions.csv.headers.nf'),
      this.translate.instant('financial.transactions.csv.headers.description'),
      this.translate.instant('financial.transactions.csv.headers.amount'),
      this.translate.instant('financial.transactions.csv.headers.dueDate'),
      this.translate.instant('financial.transactions.csv.headers.status'),
      this.translate.instant('financial.transactions.csv.headers.category'),
      this.translate.instant('financial.transactions.csv.headers.costCenter'),
      this.translate.instant('financial.transactions.csv.headers.paidAt'),
      this.translate.instant('financial.transactions.csv.headers.paymentMethod'),
      this.translate.instant('financial.transactions.csv.headers.bankAccountId')
    ];

    const lines = rows.map(row => {
      const typeLabelKey =
        row.type === 'PAYABLE'
          ? 'financial.transactions.type.payable'
          : row.type === 'RECEIVABLE'
          ? 'financial.transactions.type.receivable'
          : row.type === 'TRANSFER'
          ? 'financial.transactions.type.transfer'
          : row.type === 'ADJUSTMENT'
          ? 'financial.transactions.type.adjustment'
          : '';

      const typeLabel = typeLabelKey ? this.translate.instant(typeLabelKey) : '';

      const amount =
        typeof row.amount === 'number'
          ? row.amount.toFixed(2)
          : row.amount;

      const dueDate = row.due_date
        ? new Date(row.due_date).toISOString().split('T')[0]
        : '';

      const statusLabel = this.getStatusLabel(row.status);

      const paidDate = row.paid_at
        ? new Date(row.paid_at as any).toISOString().split('T')[0]
        : '';

      const paymentMethodRaw = (row as any).payment_method as string | undefined;
      const paymentMethodLabelKey =
        this.paymentMethods.find(m => m.value === paymentMethodRaw)?.labelKey || '';

      const paymentMethodLabel =
        (paymentMethodLabelKey && this.translate.instant(paymentMethodLabelKey)) ||
        paymentMethodRaw ||
        '';

      const bankAccountId = (row as any).bank_account_id || '';

      const values = [
        row.id_code || '',
        typeLabel,
        (row as any).nf || '',
        row.description || '',
        amount || '',
        dueDate,
        statusLabel,
        row.category || '',
        row.cost_center || '',
        paidDate,
        paymentMethodLabel,
        bankAccountId
      ];

      return values
        .map(value => {
          const str = value != null ? String(value) : '';
          const escaped = str.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(';');
    });

    const csvContent = [headers.join(';'), ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const storeCode = this.selectedStore?.id_code || 'empresa';
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `lancamentos_${storeCode}_${timestamp}.csv`;

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

    this.toastService.triggerToast(
      'success',
      'Exportação iniciada',
      'O arquivo CSV foi gerado com os lançamentos filtrados.'
    );
  }

  // Pagination Logic
  updatePagination() {
    let data = this.filteredData;

    if (this.sortKey) {
      data = this.sortData(data, this.sortKey, this.sortOrder);
    }

    this.totalItems = data.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalItems / this.itemsPerPage));

    // Ensure current page is valid
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;

    this.paginatedData = data.slice(startIndex, endIndex);
  }

  onItemsPerPageChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  onPageChange(page: number) {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
    this.updatePagination();
  }
  
  onSearchChange() {
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

  private clearEvidenceFiles() {
    this.evidenceFiles.forEach(file => {
      URL.revokeObjectURL(file.url);
    });
    this.evidenceFiles = [];
  }

  private extractTransactionIdFromResponse(response: any): string | null {
    if (!response) {
      return null;
    }

    const candidateFromData = response.data || response.transaction || response.item;

    if (candidateFromData) {
      if (typeof candidateFromData.id_code === 'string') {
        return candidateFromData.id_code;
      }
      if (typeof candidateFromData.id === 'string') {
        return candidateFromData.id;
      }
      if (typeof candidateFromData.id === 'number') {
        return String(candidateFromData.id);
      }
    }

    if (typeof response.id_code === 'string') {
      return response.id_code;
    }
    if (typeof response.id === 'string') {
      return response.id;
    }
    if (typeof response.id === 'number') {
      return String(response.id);
    }

    return null;
  }

  private uploadEvidenceFilesForTransaction(transactionId: string) {
    if (!this.selectedStore || !this.selectedStore.id_code) {
      this.toastService.triggerToast(
        'warning',
        'Empresa não selecionada',
        'É obrigatório selecionar uma empresa para anexar evidências ao lançamento.'
      );
      this.clearEvidenceFiles();
      return;
    }

    if (!this.evidenceFiles.length) {
      return;
    }

    const folder = `FINANCIAL/${this.selectedStore.id_code}`;

    console.log('[FINANCIAL] Iniciando upload de evidências', {
      transactionId,
      folder,
      files: this.evidenceFiles.map(f => f.name)
    });

    this.toastService.triggerToast(
      'info',
      '2/2 Enviando evidências',
      'Estamos enviando as evidências deste lançamento. Não feche o navegador até concluir.'
    );

    const uploads$ = this.evidenceFiles.map(wrapper =>
      this.uploadService.uploadImage(wrapper.file, {
        folder,
        type: 'financial-evidence',
        entityId: transactionId
      })
    );

    forkJoin(uploads$).subscribe({
      next: (results) => {
        console.log('[FINANCIAL] Resultado upload evidências', results);
        const newAttachments = results
          .filter(result => result.success && result.url)
          .map(result => {
            const url = result.url as string;
            const filename =
              result.filename ||
              url.split('/').pop() ||
              'Evidência';
            return { url, filename };
          });

        this.clearEvidenceFiles();

        if (!newAttachments.length) {
          this.toastService.triggerToast(
            'error',
            'Erro no upload de evidências',
            'Não foi possível enviar as evidências do lançamento.'
          );
          return;
        }

        const existingAttachments = this.existingEvidenceFiles.map(file => ({
          url: file.url,
          filename: file.name
        }));

        const merged = [...existingAttachments, ...newAttachments];
        const byUrl = new Map<string, { url: string; filename: string }>();

        merged.forEach(att => {
          if (!att.url) {
            return;
          }
          if (!byUrl.has(att.url)) {
            byUrl.set(att.url, att);
          }
        });

        const attachments = Array.from(byUrl.values());

        this.financial.updateTransaction(transactionId, { attachments }).subscribe({
          next: () => {
            if (this.selectedStore?.id_code) {
              this.loadTransactions();
            }
            this.toastService.triggerToast(
              'success',
              '2/2 Evidências anexadas',
              'As evidências foram anexadas ao lançamento com sucesso.'
            );
          },
          error: (err) => {
            console.error('Erro ao atualizar lançamento com evidências', err);
            const msg = err?.error?.message || err?.message || 'Erro ao atualizar o lançamento com as evidências enviadas.';
            this.toastService.triggerToast(
              'error',
              'Erro ao salvar evidências',
              msg
            );
          }
        });
      },
      error: (error) => {
        console.error('Erro no upload de evidências', error);
        this.clearEvidenceFiles();
        this.toastService.triggerToast(
          'error',
          'Erro no upload de evidências',
          'Não foi possível enviar as evidências do lançamento.'
        );
      }
    });
  }
}
