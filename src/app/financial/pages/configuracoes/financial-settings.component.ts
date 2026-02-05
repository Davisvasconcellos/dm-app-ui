import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StoreService, Store } from '../../../pages/pub/admin/home-admin/store.service';
import { LocalStorageService } from '../../../shared/services/local-storage.service';
import { FinancialService } from '../../financial.service';
import { ViaCepService } from '../../../shared/services/viacep.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FinancialToastService } from '../../financial-toast.service';
import { InputFieldComponent } from '../../../shared/components/form/input/input-field.component';
import { SelectComponent } from '../../../shared/components/form/select/select.component';
import { LabelComponent } from '../../../shared/components/form/label/label.component';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';
import { CheckboxComponent } from '../../../shared/components/form/input/checkbox.component';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { AlertComponent } from '../../../shared/components/ui/alert/alert.component';
import { FinancialCategory, CostCenter, FinancialTag } from '../../models/financial-settings.models';

@Component({
  selector: 'app-financial-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    InputFieldComponent,
    SelectComponent,
    LabelComponent,
    ButtonComponent,
    CheckboxComponent,
    ModalComponent,
    AlertComponent
  ],
  templateUrl: './financial-settings.component.html',
})
export class FinancialSettingsComponent implements OnInit {
  activeTab: string = 'stores';
  storeForm: FormGroup;
  bankAccountForm: FormGroup;
  categoryForm: FormGroup;
  costCenterForm: FormGroup;
  tagForm: FormGroup;
  isSubmitting = false;
  isLoading = false;
  isCreatingStore = false;

  banner_url: string = '';
  logo_url: string | null = null;
  
  private readonly STORE_KEY = 'selectedStore';
  selectedStore: Store | null = null;

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

  constructor(
    private fb: FormBuilder,
    private storeService: StoreService,
    private localStorageService: LocalStorageService,
    private financialService: FinancialService,
    private viaCepService: ViaCepService,
    private translate: TranslateService,
    private toastService: FinancialToastService
  ) {
    this.storeForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      cnpj: ['', Validators.required],
      type: [''],
      phone: [''],
      address_street: [''],
      address_number: [''],
      address_neighborhood: [''],
      address_city: [''],
      address_state: [''],
      zip_code: [''],
      description: [''],
      website: [''],
      instagram_handle: [''],
      facebook_handle: ['']
    });

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
  }

  ngOnInit() {
    this.loadStoreData();
  }

  loadStoreData() {
    this.isLoading = true;
    const selectedStore = this.localStorageService.getData<Store>(this.STORE_KEY);
    this.selectedStore = selectedStore;
    
    if (selectedStore && selectedStore.id_code) {
      this.fetchStoreById(selectedStore.id_code);
      this.loadBankAccounts();
      this.loadCategories();
      this.loadCostCenters();
      this.loadTags();
      this.isLoading = false;
    } else {
      this.storeService.getStores().subscribe({
        next: (stores) => {
          if (stores && stores.length > 0) {
            this.selectedStore = stores[0];
            this.fetchStoreById(stores[0].id_code);
            this.loadBankAccounts();
            this.loadCategories();
            this.loadCostCenters();
            this.loadTags();
          } else {
            this.selectedStore = null;
          }
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error fetching stores', err);
          this.selectedStore = null;
          this.isLoading = false;
        }
      });
    }
  }

  fetchStoreById(idCode: string) {
    this.storeService.getStoreById(idCode).subscribe({
      next: (storeData) => {
        this.populateForm(storeData);
      },
      error: (err) => console.error('Error fetching store details', err)
    });
  }

  loadBankAccounts() {
    if (!this.selectedStore?.id_code) return;
    this.financialService.getBankAccounts(this.selectedStore.id_code).subscribe({
      next: (data) => {
        this.bankAccounts = data;
      },
      error: (err) => console.error('Error fetching bank accounts', err)
    });
  }

  populateForm(data: any) {
    this.storeForm.patchValue({
      name: data.name,
      email: data.email,
      cnpj: data.cnpj,
      type: data.type,
      phone: data.phone,
      address_street: data.address_street,
      address_number: data.address_number,
      address_neighborhood: data.address_neighborhood,
      address_city: data.address_city,
      address_state: data.address_state,
      zip_code: data.zip_code,
      description: data.description,
      website: data.website,
      instagram_handle: data.instagram_handle,
      facebook_handle: data.facebook_handle
    });
    this.banner_url = data.banner_url;
    this.logo_url = data.logo_url;
  }

  onCepBlur(event: any) {
    const cep = event.target.value;
    if (!cep) return;
    
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    this.viaCepService.getAddressByCep(cleanCep).subscribe({
      next: (data) => {
        this.storeForm.patchValue({
          address_street: data.street,
          address_neighborhood: data.neighborhood,
          address_city: data.city,
          address_state: data.state
        });
      },
      error: (err) => {
        this.toastService.triggerToast('error', 'Erro', 'CEP não encontrado.');
      }
    });
  }

  onCnpjInput(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 14) value = value.slice(0, 14);
    
    // Mask: 00.000.000/0000-00
    if (value.length > 12) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
    } else if (value.length > 8) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4}).*/, '$1.$2.$3/$4');
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{3})(\d{0,3}).*/, '$1.$2.$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,3}).*/, '$1.$2');
    }
    
    this.storeForm.get('cnpj')?.setValue(value, { emitEvent: false });
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  onAddNewStore() {
    this.isCreatingStore = true;
    this.selectedStore = null;
    this.activeTab = 'stores';
    this.storeForm.reset({
      name: '',
      email: '',
      cnpj: '',
      type: '',
      phone: '',
      address_street: '',
      address_number: '',
      address_neighborhood: '',
      address_city: '',
      address_state: '',
      zip_code: '',
      description: '',
      website: '',
      instagram_handle: '',
      facebook_handle: ''
    });
    this.banner_url = '';
    this.logo_url = null;
  }

  onSubmitStore() {
    if (this.storeForm.invalid) {
      this.storeForm.markAllAsTouched();
      this.toastService.triggerToast('warning', 'Atenção', 'Preencha todos os campos obrigatórios.');
      return;
    }

    this.isSubmitting = true;
    const payload = this.storeForm.value;

    if (this.isCreatingStore) {
      this.storeService.createStore(payload).subscribe({
        next: (response) => {
          this.toastService.triggerToast('success', 'Sucesso', 'Empresa criada com sucesso.');
          this.isSubmitting = false;
          this.isCreatingStore = false;
          const createdStore = response && response.data ? (response.data.store || response.data) : null;
          if (createdStore && createdStore.id_code) {
            this.selectedStore = createdStore;
            this.localStorageService.saveData(this.STORE_KEY, createdStore);
            this.populateForm(createdStore);
            this.loadBankAccounts();
            this.loadCategories();
            this.loadCostCenters();
            this.loadTags();
          } else {
            this.loadStoreData();
          }
        },
        error: (err) => {
          console.error('Error creating store', err);
          this.toastService.triggerToast('error', 'Erro', 'Erro ao criar a empresa.');
          this.isSubmitting = false;
        }
      });
    } else {
      if (!this.selectedStore?.id_code) {
        this.toastService.triggerToast('error', 'Erro', 'Nenhuma empresa selecionada para edição.');
        this.isSubmitting = false;
        return;
      }

      this.storeService.updateStore(this.selectedStore.id_code, payload).subscribe({
        next: (response) => {
          this.toastService.triggerToast('success', 'Sucesso', 'Dados da empresa atualizados.');
          this.isSubmitting = false;
          if (response && response.data) {
            this.populateForm(response.data);
          }
        },
        error: (err) => {
          console.error('Error updating store', err);
          this.toastService.triggerToast('error', 'Erro', 'Erro ao atualizar dados da empresa.');
          this.isSubmitting = false;
        }
      });
    }
  }

  triggerLogoInput() {
    document.getElementById('logoInput')?.click();
  }

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.logo_url = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // --- Bank Accounts Logic ---

  isPaymentMethodSelected(methodValue: string): boolean {
    const currentMethods = this.bankAccountForm.get('allowed_payment_methods')?.value || [];
    return Array.isArray(currentMethods) && currentMethods.includes(methodValue);
  }

  togglePaymentMethod(methodValue: string, isChecked: boolean) {
    const currentMethods = this.bankAccountForm.get('allowed_payment_methods')?.value || [];
    let updatedMethods = Array.isArray(currentMethods) ? [...currentMethods] : [];

    if (isChecked) {
      if (!updatedMethods.includes(methodValue)) {
        updatedMethods.push(methodValue);
      }
    } else {
      updatedMethods = updatedMethods.filter((m: string) => m !== methodValue);
    }

    this.bankAccountForm.patchValue({ allowed_payment_methods: updatedMethods });
    this.bankAccountForm.markAsDirty();
  }

  addAccount() {
    this.editingBankAccount = null;
    this.bankAccountForm.reset({
      type: 'checking',
      initial_balance: 0,
      is_default: false,
      allowed_payment_methods: []
    });
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

    if (!this.selectedStore?.id_code) {
      this.toastService.triggerToast('warning', 'Atenção', 'Nenhuma loja selecionada.');
      return;
    }

    this.isSubmitting = true;
    const formValue = this.bankAccountForm.value;
    const payload = { ...formValue, store_id: this.selectedStore.id_code };

    const request$ = this.editingBankAccount
      ? this.financialService.updateBankAccount(this.editingBankAccount.id_code, payload)
      : this.financialService.createBankAccount(payload);

    request$.subscribe({
      next: () => {
        this.toastService.triggerToast('success', 'Sucesso', 
          this.editingBankAccount ? 'Conta atualizada com sucesso.' : 'Conta criada com sucesso.');
        this.loadBankAccounts();
        this.cancelBankAccountForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error saving bank account', err);
        this.toastService.triggerToast('error', 'Erro', 'Erro ao salvar conta bancária.');
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

    this.isSubmitting = true;
    this.financialService.deleteBankAccount(this.bankAccountToDelete.id_code).subscribe({
      next: () => {
        this.toastService.triggerToast('success', 'Sucesso', 'Conta removida com sucesso.');
        this.loadBankAccounts();
        this.isDeleteBankAccountModalOpen = false;
        this.bankAccountToDelete = null;
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error deleting bank account', err);
        this.toastService.triggerToast('error', 'Erro', 'Erro ao excluir conta bancária.');
        this.isSubmitting = false;
      }
    });
  }
  
  cancelDeleteBankAccount() {
    this.isDeleteBankAccountModalOpen = false;
    this.bankAccountToDelete = null;
  }
  
  // --- Categories Logic ---

  loadCategories() {
    if (!this.selectedStore?.id_code) return;
    this.financialService.getCategorias(this.selectedStore.id_code).subscribe({
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
    this.categoryForm.patchValue({
      name: category.name,
      type: category.type
    });
    this.showCategoryForm = true;
  }

  cancelCategoryForm() {
    this.showCategoryForm = false;
    this.editingCategory = null;
  }

  saveCategory() {
    if (this.categoryForm.invalid || !this.selectedStore?.id_code) return;

    this.isSubmitting = true;
    const payload = { ...this.categoryForm.value, store_id: this.selectedStore.id_code };

    const categoryId = this.editingCategory ? (this.editingCategory.id || this.editingCategory.id_code) : null;

    const request$ = this.editingCategory && categoryId
      ? this.financialService.updateCategory(categoryId, payload)
      : this.financialService.createCategory(payload);

    request$.subscribe({
      next: () => {
        this.toastService.triggerToast('success', 'Sucesso', 
          this.editingCategory ? 'Categoria atualizada.' : 'Categoria criada.');
        this.loadCategories();
        this.cancelCategoryForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error saving category', err);
        this.toastService.triggerToast('error', 'Erro', 'Erro ao salvar categoria.');
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

    const categoryId = this.categoryToDelete.id || this.categoryToDelete.id_code;
    if (!categoryId) {
      this.toastService.triggerToast('error', 'Erro', 'ID da categoria não encontrado.');
      return;
    }

    this.isSubmitting = true;
    this.financialService.deleteCategory(categoryId).subscribe({
      next: () => {
        this.toastService.triggerToast('success', 'Sucesso', 'Categoria removida.');
        this.loadCategories();
        this.isDeleteCategoryModalOpen = false;
        this.categoryToDelete = null;
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error deleting category', err);
        this.toastService.triggerToast('error', 'Erro', 'Erro ao excluir categoria.');
        this.isSubmitting = false;
      }
    });
  }

  cancelDeleteCategory() {
    this.isDeleteCategoryModalOpen = false;
    this.categoryToDelete = null;
  }

  // --- Cost Centers Logic ---

  loadCostCenters() {
    if (!this.selectedStore?.id_code) return;
    this.financialService.getCentrosDeCusto(this.selectedStore.id_code).subscribe({
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
    this.costCenterForm.patchValue({
      name: cc.name,
      code: cc.code
    });
    this.showCostCenterForm = true;
  }

  cancelCostCenterForm() {
    this.showCostCenterForm = false;
    this.editingCostCenter = null;
  }

  saveCostCenter() {
    if (this.costCenterForm.invalid || !this.selectedStore?.id_code) return;

    this.isSubmitting = true;
    const payload = { ...this.costCenterForm.value, store_id: this.selectedStore.id_code };

    const ccId = this.editingCostCenter ? (this.editingCostCenter.id || this.editingCostCenter.id_code) : null;

    const request$ = this.editingCostCenter && ccId
      ? this.financialService.updateCostCenter(ccId, payload)
      : this.financialService.createCostCenter(payload);

    request$.subscribe({
      next: () => {
        this.toastService.triggerToast('success', 'Sucesso', 
          this.editingCostCenter ? 'Centro de custo atualizado.' : 'Centro de custo criado.');
        this.loadCostCenters();
        this.cancelCostCenterForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error saving cost center', err);
        this.toastService.triggerToast('error', 'Erro', 'Erro ao salvar centro de custo.');
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

    const ccId = this.costCenterToDelete.id || this.costCenterToDelete.id_code;
    if (!ccId) {
      this.toastService.triggerToast('error', 'Erro', 'ID do centro de custo não encontrado.');
      return;
    }

    this.isSubmitting = true;
    this.financialService.deleteCostCenter(ccId).subscribe({
      next: () => {
        this.toastService.triggerToast('success', 'Sucesso', 'Centro de custo removido.');
        this.loadCostCenters();
        this.isDeleteCostCenterModalOpen = false;
        this.costCenterToDelete = null;
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error deleting cost center', err);
        this.toastService.triggerToast('error', 'Erro', 'Erro ao excluir centro de custo.');
        this.isSubmitting = false;
      }
    });
  }

  cancelDeleteCostCenter() {
    this.isDeleteCostCenterModalOpen = false;
    this.costCenterToDelete = null;
  }

  // --- Tags Logic ---

  loadTags() {
    if (!this.selectedStore?.id_code) return;
    this.financialService.getTags(this.selectedStore.id_code).subscribe({
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
    this.tagForm.patchValue({
      name: tag.name,
      color: tag.color
    });
    this.showTagForm = true;
  }

  cancelTagForm() {
    this.showTagForm = false;
    this.editingTag = null;
  }

  saveTag() {
    if (this.tagForm.invalid || !this.selectedStore?.id_code) return;

    this.isSubmitting = true;
    const payload = { ...this.tagForm.value, store_id: this.selectedStore.id_code };

    const tagId = this.editingTag ? (this.editingTag.id || this.editingTag.id_code) : null;

    const request$ = this.editingTag && tagId
      ? this.financialService.updateTag(tagId, payload)
      : this.financialService.createTag(payload);

    request$.subscribe({
      next: () => {
        this.toastService.triggerToast('success', 'Sucesso', 
          this.editingTag ? 'Tag atualizada.' : 'Tag criada.');
        this.loadTags();
        this.cancelTagForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error saving tag', err);
        this.toastService.triggerToast('error', 'Erro', 'Erro ao salvar tag.');
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

    const tagId = this.tagToDelete.id || this.tagToDelete.id_code;
    if (!tagId) {
      this.toastService.triggerToast('error', 'Erro', 'ID da tag não encontrado.');
      return;
    }

    this.isSubmitting = true;
    this.financialService.deleteTag(tagId).subscribe({
      next: () => {
        this.toastService.triggerToast('success', 'Sucesso', 'Tag removida.');
        this.loadTags();
        this.isDeleteTagModalOpen = false;
        this.tagToDelete = null;
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error deleting tag', err);
        this.toastService.triggerToast('error', 'Erro', 'Erro ao excluir tag.');
        this.isSubmitting = false;
      }
    });
  }

  cancelDeleteTag() {
    this.isDeleteTagModalOpen = false;
    this.tagToDelete = null;
  }
}
