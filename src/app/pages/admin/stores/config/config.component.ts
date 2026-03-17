import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpErrorResponse } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LabelComponent } from '../../../../shared/components/form/label/label.component';
import { ConfigService, StoreDetails } from './config.service';
import { StoreService } from '../store.service';
import { OrganizationService } from '../../organizations/organization.service';
import { LocalStorageService } from '../../../../shared/services/local-storage.service';
import { Store } from '../store.service';
import { ImageUploadService } from '../../../../shared/services/image-upload.service';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../shared/services/auth.service';
import { ToastService } from '../../../../shared/services/toast.service';
import * as L from 'leaflet';
import { formatToCNPJ } from 'brazilian-values';
import { FinancialService } from '../../../../financial/financial.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InputFieldComponent } from '../../../../shared/components/form/input/input-field.component';
import { SelectComponent } from '../../../../shared/components/form/select/select.component';
import { ButtonComponent } from '../../../../shared/components/ui/button/button.component';
import { CheckboxComponent } from '../../../../shared/components/form/input/checkbox.component';
import { ModalComponent } from '../../../../shared/components/ui/modal/modal.component';
import { FinancialCategory, CostCenter, FinancialTag } from '../../../../financial/models/financial-settings.models';

const iconRetinaUrl = 'images/leaflet/marker-icon-2x.png';
const iconUrl = 'images/leaflet/marker-icon.png';
const shadowUrl = 'images/leaflet/marker-shadow.png';
const iconDefault = L.icon({ iconRetinaUrl, iconUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], tooltipAnchor: [16, -28], shadowSize: [41, 41] });
L.Marker.prototype.options.icon = iconDefault;

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LabelComponent,
    HttpClientModule,
    TranslateModule,
    InputFieldComponent,
    SelectComponent,
    ButtonComponent,
    CheckboxComponent,
    ModalComponent
  ],
  templateUrl: './config.component.html',
  styleUrls: []
})
export class ConfigComponent implements OnInit, AfterViewInit, OnDestroy {
  activeTab: string = 'establishment';
  isLoading: boolean = false;
  error: string | null = null;
  cnpjReadonly: boolean = false;
  isCreate: boolean = false;
  cnpjValid: boolean = true;
  cnpjComplete: boolean = false;
  isSubmitting: boolean = false;

  // Financial Injections
  private financialService = inject(FinancialService);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);

  // Financial Tabs State
  bankAccountForm!: FormGroup;
  categoryForm!: FormGroup;
  costCenterForm!: FormGroup;
  tagForm!: FormGroup;

  categories: FinancialCategory[] = [];
  showCategoryForm = false;
  editingCategory: FinancialCategory | null = null;
  categoryToDelete: FinancialCategory | null = null;
  isDeleteCategoryModalOpen = false;

  costCenters: CostCenter[] = [];
  showCostCenterForm = false;
  editingCostCenter: CostCenter | null = null;
  costCenterToDelete: CostCenter | null = null;
  isDeleteCostCenterModalOpen = false;

  tags: FinancialTag[] = [];
  showTagForm = false;
  editingTag: FinancialTag | null = null;
  tagToDelete: FinancialTag | null = null;
  isDeleteTagModalOpen = false;

  collaboratorForm!: FormGroup;
  collaborators: any[] = [
    { id: '1', name: 'João Silva', email: 'joao@example.com', role: 'admin', status: 'approved', modules: ['Vendas', 'Financeiro'] },
    { id: '2', name: 'Maria Souza', email: 'maria@example.com', role: 'user', status: 'pending', modules: ['Estoque'] },
    { id: '3', name: 'Carlos Oliveira', email: 'carlos@example.com', role: 'user', status: 'approved', modules: ['Vendas'] }
  ];
  showCollaboratorForm = false;
  isDeleteCollaboratorModalOpen = false;
  collaboratorToDelete: any | null = null;

  moduleOptions = [
    { value: 'vendas', label: 'Vendas' },
    { value: 'estoque', label: 'Estoque' },
    { value: 'financeiro', label: 'Financeiro' }
  ];

  bankAccounts: any[] = [];
  showBankAccountForm = false;
  isDeleteBankAccountModalOpen = false;
  editingBankAccount: any | null = null;
  bankAccountToDelete: any | null = null;

  accountTypes = [
    { value: 'checking', labelKey: 'financial.bankAccount.form.types.checking' },
    { value: 'savings', labelKey: 'financial.bankAccount.form.types.savings' },
    { value: 'investment', labelKey: 'financial.bankAccount.form.types.investment' },
    { value: 'payment', labelKey: 'financial.bankAccount.form.types.payment' },
    { value: 'other', labelKey: 'financial.bankAccount.form.types.other' }
  ];

  paymentMethodOptions = [
    { value: 'pix', labelKey: 'financial.transactions.form.payment.pix' },
    { value: 'credit_card', labelKey: 'financial.transactions.form.payment.creditCard' },
    { value: 'debit_card', labelKey: 'financial.transactions.form.payment.debitCard' },
    { value: 'cash', labelKey: 'financial.transactions.form.payment.cash' },
    { value: 'bank_transfer', labelKey: 'financial.transactions.form.payment.bankTransfer' },
    { value: 'boleto', labelKey: 'financial.transactions.form.payment.billet' }
  ];

  categoryTypes = [
    { value: 'receivable', label: 'Receita' },
    { value: 'payable', label: 'Despesa' }
  ];

  get typeOptions() {
    return this.accountTypes.map(type => ({
      value: type.value,
      label: this.translate.instant(type.labelKey)
    }));
  }

  private readonly STORE_KEY = 'selectedStore';

  establishmentName: string = '';
  capacity: string = '';
  establishmentType: string = '';
  banner_url: string = '';
  logo_url: string | null = '';
  originalBannerUrl: string | null = null;
  facebook_handle: string = '';
  instagram_handle: string = '';
  website: string = '';
  establishmentDescription: string = '';
  establishmentTypes = [
    { value: 'bar', label: 'Bar' },
    { value: 'restaurant', label: 'Restaurante' },
    { value: 'pub', label: 'Pub' },
    { value: 'brewery', label: 'Cervejaria' },
    { value: 'nightclub', label: 'Casa Noturna' }
  ];

  companyName: string = '';
  cnpj: string = '';
  phone: string = '';
  email: string = '';
  zip_code: string = '';
  address_street: string = '';
  address_number: string = '';
  address_complement: string = '';
  address_neighborhood: string = '';
  address_city: string = '';
  address_state: string = '';
  latitude: string = '-22.9068';
  longitude: string = '-43.1729';
  private map!: L.Map;
  private marker!: L.Marker;

  @ViewChild('logoFileInput') logoFileInput!: ElementRef<HTMLInputElement>;
  originalLogoUrl: string | null = null;

  mondayOpen: string = '';
  mondayClose: string = '';
  mondayEnabled: boolean = false;
  tuesdayEnabled: boolean = false;
  wednesdayEnabled: boolean = false;
  thursdayEnabled: boolean = false;
  fridayEnabled: boolean = false;
  saturdayEnabled: boolean = false;
  sundayEnabled: boolean = false;
  tuesdayOpen: string = '';
  tuesdayClose: string = '';
  wednesdayOpen: string = '';
  wednesdayClose: string = '';
  thursdayOpen: string = '';
  thursdayClose: string = '';
  fridayOpen: string = '';
  fridayClose: string = '';
  saturdayOpen: string = '';
  saturdayClose: string = '';
  sundayOpen: string = '';
  sundayClose: string = '';

  // Payment methods
  paymentDinheiro: boolean = false;
  paymentPix: boolean = false;
  paymentDebitoVisa: boolean = false;
  paymentDebitoMaster: boolean = false;
  paymentCreditoVisa: boolean = false;
  paymentCreditoMaster: boolean = false;
  paymentCreditoAmex: boolean = false;
  paymentCreditoElo: boolean = false;
  paymentValeRefeicao: boolean = false;
  paymentValeAlimentacao: boolean = false;
  paymentCheque: boolean = false;
  paymentTransferencia: boolean = false;

  // Delivery settings
  deliveryMode: string = 'none';
  deliveryRadiusKm: number | null = null;
  deliveryFee: number | null = null;
  deliveryMinOrder: number | null = null;
  deliveryEstimatedMinutes: number | null = null;
  deliveryFreeAbove: boolean = false;
  deliveryFreeAboveValue: number | null = null;
  pickupEnabled: boolean = false;
  pickupEstimatedMinutes: number | null = null;

  private configService = inject(ConfigService);
  private localStorageService = inject(LocalStorageService);
  private http = inject(HttpClient);
  private imageUploadService = inject(ImageUploadService);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private storeService = inject(StoreService);
  private orgService = inject(OrganizationService);
  private pendingLogoFile: File | null = null;
  private pendingBannerFile: File | null = null;

  ngOnInit(): void {
    this.initFinancialForms();
    const routePath = this.route.snapshot.routeConfig?.path || '';
    if (routePath.includes('stores/create')) {
      this.isCreate = true;
      this.error = null;
      this.cnpjReadonly = false;
      return;
    }
    this.loadStoreDetails();
  }

  private initFinancialForms(): void {
    this.bankAccountForm = this.fb.group({
      name: ['', Validators.required],
      bank_name: ['', Validators.required],
      agency: [''],
      account_number: [''],
      type: ['checking', Validators.required],
      initial_balance: [0, [Validators.required, Validators.min(0)]],
      is_default: [false],
      allowed_payment_methods: [[]],
    });

    this.categoryForm = this.fb.group({
      name: ['', Validators.required],
      type: ['payable', Validators.required]
    });

    this.costCenterForm = this.fb.group({
      name: ['', Validators.required],
      code: ['']
    });

    this.tagForm = this.fb.group({
      name: ['', Validators.required],
      color: ['#3B82F6'] // Default blue
    });

    this.collaboratorForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      role: ['user', Validators.required],
      modules: [[]]
    });
  }

  ngAfterViewInit(): void { }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private loadStoreDetails(): void {
    const idFromRoute = this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
    if (idFromRoute) {
      this.isLoading = true;
      this.error = null;
      this.configService.getStoreById(idFromRoute).subscribe({
        next: (storeDetails: StoreDetails) => {
          this.populateForm(storeDetails);
          this.loadFinancialData(idFromRoute);
          this.isLoading = false;
        },
        error: (err: HttpErrorResponse) => {
          this.error = err.message || 'Falha ao carregar os dados da loja.';
          this.isLoading = false;
        }
      });
      return;
    }

    const selectedStore = this.localStorageService.getData<Store>(this.STORE_KEY);
    if (!selectedStore) {
      this.error = 'Nenhuma loja selecionada. Por favor, selecione uma loja.';
      return;
    }

    this.isLoading = true;
    this.error = null;

    this.configService.getStoreById(selectedStore.id_code).subscribe({
      next: (storeDetails: StoreDetails) => {
        this.populateForm(storeDetails);
        this.loadFinancialData(selectedStore.id_code);
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.error = err.message || 'Falha ao carregar os dados da loja.';
        this.isLoading = false;
      }
    });
  }

  private loadFinancialData(storeId: string): void {
    this.loadBankAccounts(storeId);
    this.loadCategories(storeId);
    this.loadCostCenters(storeId);
    this.loadTags(storeId);
  }

  // --- Bank Accounts Logic ---
  loadBankAccounts(storeId: string) {
    this.financialService.getBankAccounts(storeId).subscribe({
      next: (data) => this.bankAccounts = data,
      error: (err) => console.error('Error fetching bank accounts', err)
    });
  }

  isPaymentMethodSelected(methodValue: string): boolean {
    const currentMethods = this.bankAccountForm.get('allowed_payment_methods')?.value || [];
    return Array.isArray(currentMethods) && currentMethods.includes(methodValue);
  }

  togglePaymentMethod(methodValue: string, isChecked: boolean) {
    const currentMethods = this.bankAccountForm.get('allowed_payment_methods')?.value || [];
    let updatedMethods = Array.isArray(currentMethods) ? [...currentMethods] : [];
    if (isChecked) {
      if (!updatedMethods.includes(methodValue)) updatedMethods.push(methodValue);
    } else {
      updatedMethods = updatedMethods.filter((m: string) => m !== methodValue);
    }
    this.bankAccountForm.patchValue({ allowed_payment_methods: updatedMethods });
    this.bankAccountForm.markAsDirty();
  }

  addAccount() {
    this.editingBankAccount = null;
    this.bankAccountForm.reset({ type: 'checking', initial_balance: 0, is_default: false, allowed_payment_methods: [] });
    this.showBankAccountForm = true;
  }

  editAccount(account: any) {
    this.editingBankAccount = account;
    this.bankAccountForm.patchValue({
      name: account.name,
      bank_name: account.bank_name,
      agency: account.agency,
      account_number: account.account_number,
      type: account.type || 'checking',
      initial_balance: account.initial_balance,
      is_default: account.is_default,
      allowed_payment_methods: account.allowed_payment_methods || []
    });
    this.showBankAccountForm = true;
  }

  cancelBankAccountForm() {
    this.showBankAccountForm = false;
    this.editingBankAccount = null;
  }

  saveBankAccount() {
    if (this.bankAccountForm.invalid) {
      this.bankAccountForm.markAllAsTouched();
      return;
    }
    const storeId = this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
    if (!storeId) return;
    this.isSubmitting = true;
    const formValue = this.bankAccountForm.value;
    const payload = { ...formValue, store_id: storeId };
    const request$ = this.editingBankAccount
      ? this.financialService.updateBankAccount(this.editingBankAccount.id_code, payload)
      : this.financialService.createBankAccount(payload);
    request$.subscribe({
      next: () => {
        this.toast.triggerToast('success', 'Sucesso', this.editingBankAccount ? 'Conta atualizada com sucesso.' : 'Conta criada com sucesso.');
        this.loadBankAccounts(storeId);
        this.cancelBankAccountForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error saving bank account', err);
        this.toast.triggerToast('error', 'Erro', 'Erro ao salvar conta bancária.');
        this.isSubmitting = false;
      }
    });
  }

  confirmDeleteAccount(account: any) {
    this.bankAccountToDelete = account;
    this.isDeleteBankAccountModalOpen = true;
  }

  deleteBankAccount() {
    if (!this.bankAccountToDelete) return;
    const storeId = this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
    this.isSubmitting = true;
    this.financialService.deleteBankAccount(this.bankAccountToDelete.id_code).subscribe({
      next: () => {
        this.toast.triggerToast('success', 'Sucesso', 'Conta removida com sucesso.');
        if (storeId) this.loadBankAccounts(storeId);
        this.isDeleteBankAccountModalOpen = false;
        this.bankAccountToDelete = null;
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error deleting bank account', err);
        this.toast.triggerToast('error', 'Erro', 'Erro ao excluir conta bancária.');
        this.isSubmitting = false;
      }
    });
  }

  cancelDeleteBankAccount() {
    this.isDeleteBankAccountModalOpen = false;
    this.bankAccountToDelete = null;
  }

  // --- Categories Logic ---
  loadCategories(storeId: string) {
    this.financialService.getCategorias(storeId).subscribe({
      next: (data) => this.categories = data,
      error: (err) => console.error('Error loading categories', err)
    });
  }

  addCategory() {
    this.editingCategory = null;
    this.categoryForm.reset({ type: 'payable' });
    this.showCategoryForm = true;
  }

  editCategory(category: FinancialCategory) {
    this.editingCategory = category;
    this.categoryForm.patchValue({ name: category.name, type: category.type });
    this.showCategoryForm = true;
  }

  cancelCategoryForm() {
    this.showCategoryForm = false;
    this.editingCategory = null;
  }

  saveCategory() {
    if (this.categoryForm.invalid) return;
    const storeId = this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
    if (!storeId) return;
    this.isSubmitting = true;
    const payload = { ...this.categoryForm.value, store_id: storeId };
    const categoryId = this.editingCategory ? (this.editingCategory.id || this.editingCategory.id_code) : null;
    const request$ = this.editingCategory && categoryId
      ? this.financialService.updateCategory(categoryId, payload)
      : this.financialService.createCategory(payload);
    request$.subscribe({
      next: () => {
        this.toast.triggerToast('success', 'Sucesso', this.editingCategory ? 'Categoria atualizada.' : 'Categoria criada.');
        this.loadCategories(storeId);
        this.cancelCategoryForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error saving category', err);
        this.toast.triggerToast('error', 'Erro', 'Erro ao salvar categoria.');
        this.isSubmitting = false;
      }
    });
  }

  confirmDeleteCategory(category: FinancialCategory) {
    this.categoryToDelete = category;
    this.isDeleteCategoryModalOpen = true;
  }

  deleteCategory() {
    if (!this.categoryToDelete) return;
    const storeId = this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
    const categoryId = this.categoryToDelete.id || this.categoryToDelete.id_code;
    if (!categoryId) return;
    this.isSubmitting = true;
    this.financialService.deleteCategory(categoryId).subscribe({
      next: () => {
        this.toast.triggerToast('success', 'Sucesso', 'Categoria removida.');
        if (storeId) this.loadCategories(storeId);
        this.isDeleteCategoryModalOpen = false;
        this.categoryToDelete = null;
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error deleting category', err);
        this.toast.triggerToast('error', 'Erro', 'Erro ao excluir categoria.');
        this.isSubmitting = false;
      }
    });
  }

  cancelDeleteCategory() {
    this.isDeleteCategoryModalOpen = false;
    this.categoryToDelete = null;
  }

  // --- Cost Centers Logic ---
  loadCostCenters(storeId: string) {
    this.financialService.getCentrosDeCusto(storeId).subscribe({
      next: (data) => this.costCenters = data,
      error: (err) => console.error('Error loading cost centers', err)
    });
  }

  addCostCenter() {
    this.editingCostCenter = null;
    this.costCenterForm.reset();
    this.showCostCenterForm = true;
  }

  editCostCenter(cc: CostCenter) {
    this.editingCostCenter = cc;
    this.costCenterForm.patchValue({ name: cc.name, code: cc.code });
    this.showCostCenterForm = true;
  }

  cancelCostCenterForm() {
    this.showCostCenterForm = false;
    this.editingCostCenter = null;
  }

  saveCostCenter() {
    if (this.costCenterForm.invalid) return;
    const storeId = this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
    if (!storeId) return;
    this.isSubmitting = true;
    const payload = { ...this.costCenterForm.value, store_id: storeId };
    const ccId = this.editingCostCenter ? (this.editingCostCenter.id || this.editingCostCenter.id_code) : null;
    const request$ = this.editingCostCenter && ccId
      ? this.financialService.updateCostCenter(ccId, payload)
      : this.financialService.createCostCenter(payload);
    request$.subscribe({
      next: () => {
        this.toast.triggerToast('success', 'Sucesso', this.editingCostCenter ? 'Centro de custo atualizado.' : 'Centro de custo criado.');
        this.loadCostCenters(storeId);
        this.cancelCostCenterForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error saving cost center', err);
        this.toast.triggerToast('error', 'Erro', 'Erro ao salvar centro de custo.');
        this.isSubmitting = false;
      }
    });
  }

  confirmDeleteCostCenter(cc: CostCenter) {
    this.costCenterToDelete = cc;
    this.isDeleteCostCenterModalOpen = true;
  }

  deleteCostCenter() {
    if (!this.costCenterToDelete) return;
    const storeId = this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
    const ccId = this.costCenterToDelete.id || this.costCenterToDelete.id_code;
    if (!ccId) return;
    this.isSubmitting = true;
    this.financialService.deleteCostCenter(ccId).subscribe({
      next: () => {
        this.toast.triggerToast('success', 'Sucesso', 'Centro de custo removido.');
        if (storeId) this.loadCostCenters(storeId);
        this.isDeleteCostCenterModalOpen = false;
        this.costCenterToDelete = null;
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error deleting cost center', err);
        this.toast.triggerToast('error', 'Erro', 'Erro ao excluir centro de custo.');
        this.isSubmitting = false;
      }
    });
  }

  cancelDeleteCostCenter() {
    this.isDeleteCostCenterModalOpen = false;
    this.costCenterToDelete = null;
  }

  // --- Tags Logic ---
  loadTags(storeId: string) {
    this.financialService.getTags(storeId).subscribe({
      next: (data) => this.tags = data,
      error: (err) => console.error('Error loading tags', err)
    });
  }

  addTag() {
    this.editingTag = null;
    this.tagForm.reset({ color: '#3B82F6' });
    this.showTagForm = true;
  }

  editTag(tag: FinancialTag) {
    this.editingTag = tag;
    this.tagForm.patchValue({ name: tag.name, color: tag.color });
    this.showTagForm = true;
  }

  cancelTagForm() {
    this.showTagForm = false;
    this.editingTag = null;
  }

  saveTag() {
    if (this.tagForm.invalid) return;
    const storeId = this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
    if (!storeId) return;
    this.isSubmitting = true;
    const payload = { ...this.tagForm.value, store_id: storeId };
    const tagId = this.editingTag ? (this.editingTag.id || this.editingTag.id_code) : null;
    const request$ = this.editingTag && tagId
      ? this.financialService.updateTag(tagId, payload)
      : this.financialService.createTag(payload);
    request$.subscribe({
      next: () => {
        this.toast.triggerToast('success', 'Sucesso', this.editingTag ? 'Tag atualizada.' : 'Tag criada.');
        this.loadTags(storeId);
        this.cancelTagForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error saving tag', err);
        this.toast.triggerToast('error', 'Erro', 'Erro ao salvar tag.');
        this.isSubmitting = false;
      }
    });
  }

  confirmDeleteTag(tag: FinancialTag) {
    this.tagToDelete = tag;
    this.isDeleteTagModalOpen = true;
  }

  deleteTag() {
    if (!this.tagToDelete) return;
    const storeId = this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
    const tagId = this.tagToDelete.id || this.tagToDelete.id_code;
    if (!tagId) return;
    this.isSubmitting = true;
    this.financialService.deleteTag(tagId).subscribe({
      next: () => {
        this.toast.triggerToast('success', 'Sucesso', 'Tag removida.');
        if (storeId) this.loadTags(storeId);
        this.isDeleteTagModalOpen = false;
        this.tagToDelete = null;
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error deleting tag', err);
        this.toast.triggerToast('error', 'Erro', 'Erro ao excluir tag.');
        this.isSubmitting = false;
      }
    });
  }

  cancelDeleteTag() {
    this.isDeleteTagModalOpen = false;
    this.tagToDelete = null;
  }

  // --- Collaborators Logic ---
  addCollaborator() {
    this.showCollaboratorForm = true;
    this.collaboratorForm.reset({ role: 'user', modules: [] });
  }

  cancelCollaboratorForm() {
    this.showCollaboratorForm = false;
  }

  toggleModule(moduleLabel: string, isChecked: boolean) {
    const currentModules = this.collaboratorForm.get('modules')?.value || [];
    let updatedModules = [...currentModules];
    if (isChecked) {
      if (!updatedModules.includes(moduleLabel)) updatedModules.push(moduleLabel);
    } else {
      updatedModules = updatedModules.filter(m => m !== moduleLabel);
    }
    this.collaboratorForm.patchValue({ modules: updatedModules });
  }

  isModuleSelected(moduleLabel: string): boolean {
    return (this.collaboratorForm.get('modules')?.value || []).includes(moduleLabel);
  }

  sendInvitation() {
    if (this.collaboratorForm.invalid) {
      this.collaboratorForm.markAllAsTouched();
      return;
    }
    const formValue = this.collaboratorForm.value;
    const newCollaborator = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Pendente',
      email: formValue.email,
      role: formValue.role,
      status: 'pending',
      modules: formValue.modules
    };
    this.collaborators.unshift(newCollaborator);
    this.toast.triggerToast('success', 'Sucesso', 'Convite enviado com sucesso.');
    this.cancelCollaboratorForm();
  }

  confirmDeleteCollaborator(collaborator: any) {
    this.collaboratorToDelete = collaborator;
    this.isDeleteCollaboratorModalOpen = true;
  }

  deleteCollaborator() {
    if (!this.collaboratorToDelete) return;
    this.collaborators = this.collaborators.filter(c => c.id !== this.collaboratorToDelete.id);
    this.toast.triggerToast('success', 'Sucesso', 'Colaborador removido.');
    this.isDeleteCollaboratorModalOpen = false;
    this.collaboratorToDelete = null;
  }

  cancelDeleteCollaborator() {
    this.isDeleteCollaboratorModalOpen = false;
    this.collaboratorToDelete = null;
  }

  private populateForm(data: StoreDetails): void {
    this.establishmentName = data.name || '';
    this.capacity = data.capacity?.toString() || '';
    this.establishmentType = data.type || '';
    this.banner_url = data.banner_url || '';
    this.logo_url = data.logo_url || '';
    this.originalLogoUrl = data.logo_url || null;
    this.originalBannerUrl = data.banner_url || null;
    this.facebook_handle = data.facebook_handle || '';
    this.instagram_handle = data.instagram_handle || '';
    this.website = data.website || '';
    this.establishmentDescription = data.description || '';

    this.companyName = data.legal_name || '';
    this.cnpj = data.cnpj ? formatToCNPJ(String(data.cnpj)) : '';
    const d = String(data.cnpj || '').replace(/\D/g, '');
    this.cnpjComplete = d.length === 14;
    this.cnpjValid = this.cnpjComplete ? this.isCNPJLocal(d) : true;
    const user = this.authService.getCurrentUser();
    const isMaster = user?.role === 'master';
    this.cnpjReadonly = !!data.cnpj && !isMaster;
    this.phone = data.phone || '';
    this.email = data.email || '';
    this.zip_code = data.zip_code || '';
    this.address_street = data.address_street || '';
    this.address_number = data.address_number || '';
    this.address_complement = data.address_complement || '';
    this.address_neighborhood = data.address_neighborhood || '';
    this.address_city = data.address_city || '';
    this.address_state = data.address_state || '';
    this.latitude = data.latitude?.toString() || '-22.9068';
    this.longitude = data.longitude?.toString() || '-43.1729';
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'company') {
      setTimeout(() => {
        const lat = parseFloat(this.latitude || '0');
        const lon = parseFloat(this.longitude || '0');
        this.initMap(lat, lon);
      }, 0);
    }
  }

  onSave(): void {
    const idFromRoute = this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
    const selectedStore = this.localStorageService.getData<Store>(this.STORE_KEY);
    const storeId = idFromRoute || selectedStore?.id_code;
    const creating = this.isCreate || !storeId;

    if (!this.cnpjReadonly && this.cnpj && !this.isCNPJLocal(this.cnpj.replace(/\D/g, ''))) {
      this.toast.triggerToast('error', 'CNPJ inválido', 'Verifique o CNPJ informado.');
      return;
    }
    this.isSubmitting = true;
    const storeData: Partial<StoreDetails> = {
      name: this.establishmentName,
      email: this.email,
      cnpj: this.cnpj.replace(/\D/g, ''),
      instagram_handle: this.instagram_handle,
      facebook_handle: this.facebook_handle,
      capacity: parseInt(this.capacity, 10),
      type: this.establishmentType,
      legal_name: this.companyName,
      phone: this.phone,
      zip_code: this.zip_code,
      address_street: this.address_street,
      address_neighborhood: this.address_neighborhood,
      address_city: this.address_city,
      address_state: this.address_state,
      address_number: this.address_number,
      address_complement: this.address_complement,
      website: this.website,
      latitude: parseFloat(this.latitude),
      longitude: parseFloat(this.longitude),
      description: this.establishmentDescription,
    };

    if (creating) {
      const orgIdCode = this.route.snapshot.queryParamMap.get('org');
      const create$ = orgIdCode
        ? this.orgService.createOrganizationStore(orgIdCode, storeData as any)
        : this.storeService.createStore(storeData as any);
      create$.subscribe({
        next: (resp: any) => {
          const created = resp?.data?.store || resp?.data;
          const newId = created?.id_code;
          if (newId) {
            this.localStorageService.saveData(this.STORE_KEY, created);
            this.isCreate = false;
            this.toast.triggerToast('success', 'Sucesso', 'Loja criada com sucesso.');
            const afterCreateUpload = [];
            if (this.pendingLogoFile) {
              afterCreateUpload.push(this.uploadLogo(this.pendingLogoFile, newId, true));
            }
            if (this.pendingBannerFile) {
              afterCreateUpload.push(this.uploadBanner(this.pendingBannerFile, newId, true));
            }
            if (afterCreateUpload.length === 0) {
              this.loadStoreDetails();
            } else {
              Promise.all(afterCreateUpload).then(() => this.loadStoreDetails());
            }
            this.isSubmitting = false;
          } else {
            this.toast.triggerToast('error', 'Erro', 'Falha ao criar a loja.');
            this.isSubmitting = false;
          }
        },
        error: () => {
          this.toast.triggerToast('error', 'Erro', 'Falha ao criar a loja.');
          this.isSubmitting = false;
        }
      });
    } else {
      // Update mode
      this.configService.updateStore(storeId!, storeData).subscribe({
        next: () => {
          this.toast.triggerToast('success', 'Sucesso', 'Dados atualizados.');
          this.isSubmitting = false;
        },
        error: () => {
          this.toast.triggerToast('error', 'Erro', 'Falha ao atualizar os dados.');
          this.isSubmitting = false;
        }
      });
    }
  }

  onCancel(): void { }

  onCepBlur(): void {
    const cep = this.zip_code.replace(/\D/g, '');
    if (cep.length !== 8) return;

    this.http.get(`https://viacep.com.br/ws/${cep}/json/`).subscribe((data: any) => {
      if (data.erro) {
        return;
      }
      this.address_street = data.logradouro;
      this.address_neighborhood = data.bairro;
      this.address_city = data.localidade;
      this.address_state = data.uf;
      this.geocodeAddress();
    }, () => { });
  }

  onAddressNumberChange(): void {
    this.geocodeAddress();
  }

  geocodeAddress(): void {
    const address = `${this.address_street}, ${this.address_number}, ${this.address_city}, ${this.address_state}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    if (!this.address_street || !this.address_city) return;

    this.http.get<any[]>(url).subscribe((data) => {
      if (data && data.length > 0) {
        this.latitude = data[0].lat;
        this.longitude = data[0].lon;
        this.updateMap(parseFloat(this.latitude), parseFloat(this.longitude));
      }
    }, () => { });
  }

  private initMap(lat: number, lon: number): void {
    if (!this.map && document.getElementById('map')) {
      this.map = L.map('map', { scrollWheelZoom: false }).setView([lat, lon], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this.map);
      this.marker = L.marker([lat, lon], { draggable: false }).addTo(this.map);
    } else if (this.map) {
      this.updateMap(lat, lon);
    }
  }

  private updateMap(lat: number, lon: number): void {
    this.map.setView([lat, lon], 15);
    this.marker.setLatLng([lat, lon]);
    setTimeout(() => this.map.invalidateSize(), 10);
  }

  triggerLogoInput(): void {
    this.logoFileInput.nativeElement.click();
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.logo_url = e.target?.result as string;
      };
      reader.readAsDataURL(file);

      const idFromRoute = this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
      const selectedStore = this.localStorageService.getData<Store>(this.STORE_KEY);
      const storeId = idFromRoute || selectedStore?.id_code;
      if (this.isCreate || !storeId) {
        this.pendingLogoFile = file;
      } else {
        this.uploadLogo(file, storeId);
      }
    }
  }

  uploadLogo(file: File, storeId?: string, silent?: boolean): Promise<void> | void {
    const idFromRoute = storeId || this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
    const finalId = idFromRoute || this.localStorageService.getData<Store>(this.STORE_KEY)?.id_code;
    if (!finalId) {
      this.revertLogoPreview();
      return;
    }
    this.imageUploadService.uploadImage(
      file,
      'store-logo',
      finalId,
      {
        maxWidth: 300,
        maxHeight: 300,
        quality: 0.9
      },
      `stores/${finalId}/branding`
    ).then(result => {
      if (result.success && result.filePath) {
        this.loadStoreDetails();
      } else {
        this.revertLogoPreview();
      }
    }).catch(() => {
      this.revertLogoPreview();
    });
    if (silent) return Promise.resolve();
  }

  private revertLogoPreview(): void {
    this.logo_url = this.originalLogoUrl;
  }

  onCnpjInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    this.cnpj = formatToCNPJ(digits);
    this.cnpjComplete = digits.length === 14;
    this.cnpjValid = this.cnpjComplete ? this.isCNPJLocal(digits) : true;
  }

  triggerBannerInput(): void {
    const input = document.getElementById('bannerFileInput') as HTMLInputElement | null;
    input?.click();
  }

  onBannerSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.banner_url = e.target?.result as string;
      };
      reader.readAsDataURL(file);

      const idFromRoute = this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
      const selectedStore = this.localStorageService.getData<Store>(this.STORE_KEY);
      const storeId = idFromRoute || selectedStore?.id_code;
      if (this.isCreate || !storeId) {
        this.pendingBannerFile = file;
      } else {
        this.uploadBanner(file, storeId);
      }
    }
  }

  uploadBanner(file: File, storeId?: string, silent?: boolean): Promise<void> | void {
    const idFromRoute = storeId || this.route.snapshot.paramMap.get('id_code') || this.route.snapshot.paramMap.get('id');
    const finalId = idFromRoute || this.localStorageService.getData<Store>(this.STORE_KEY)?.id_code;
    if (!finalId) {
      this.revertBannerPreview();
      return;
    }
    this.imageUploadService.uploadImage(
      file,
      'store-banner',
      finalId,
      {
        maxWidth: 1200,
        maxHeight: 400,
        quality: 0.9
      },
      `stores/${finalId}/branding`
    ).then(result => {
      if (result.success && result.filePath) {
        this.loadStoreDetails();
      } else {
        this.revertBannerPreview();
      }
    }).catch(() => {
      this.revertBannerPreview();
    });
    if (silent) return Promise.resolve();
  }

  private revertBannerPreview(): void {
    this.banner_url = this.originalBannerUrl || '';
  }

  private isCNPJLocal(value: string): boolean {
    const c = (value || '').replace(/\D/g, '');
    if (c.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(c)) return false;
    const calcDV = (base: string, weights: number[]) => {
      const sum = base.split('').reduce((acc, digit, idx) => acc + Number(digit) * weights[idx], 0);
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    const dv1 = calcDV(c.substring(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    if (dv1 !== Number(c[12])) return false;
    const dv2 = calcDV(c.substring(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return dv2 === Number(c[13]);
  }
}
