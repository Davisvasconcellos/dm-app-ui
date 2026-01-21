import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StoreService, Store } from '../../../pages/pub/admin/home-admin/store.service';
import { LocalStorageService } from '../../../shared/services/local-storage.service';
import { FinancialService } from '../../financial.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FinancialToastService } from '../../financial-toast.service';
import { InputFieldComponent } from '../../../shared/components/form/input/input-field.component';
import { LabelComponent } from '../../../shared/components/form/label/label.component';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';
import { CheckboxComponent } from '../../../shared/components/form/input/checkbox.component';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { Party } from '../../models/party';
import { ViaCepService, AddressData } from '../../../shared/services/viacep.service';
import { PaginationButtonComponent } from '../../../shared/components/tables/data-tables/table-two/pagination-with-button/pagination-with-button.component';

type SortKey = 'name' | 'document' | 'email' | 'phone' | 'type';
type SortOrder = 'asc' | 'desc';

@Component({
  selector: 'app-financial-parties',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    InputFieldComponent,
    LabelComponent,
    ButtonComponent,
    CheckboxComponent,
    ModalComponent,
    PaginationButtonComponent
  ],
  templateUrl: './financial-parties.component.html',
})
export class FinancialPartiesComponent implements OnInit {
  partyForm: FormGroup;
  isSubmitting = false;
  
  // CEP Lookup
  isLoadingCep = false;
  cepError = '';

  private readonly STORE_KEY = 'selectedStore';
  selectedStore: Store | null = null;

  parties: Party[] = [];
  showPartyForm = false;
  isDeletePartyModalOpen = false;
  editingParty: Party | null = null;
  partyToDelete: Party | null = null;

  // DataTable Properties
  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortKey: SortKey = 'name';
  sortOrder: SortOrder = 'asc';
  selectedType: string = '';
  searchTerm: string = '';
  filteredAndSortedData: Party[] = [];
  currentData: Party[] = [];
  totalItems: number = 0;
  totalPages: number = 0;
  startIndex: number = 0;
  endIndex: number = 0;

  headers = [
    { key: 'name', label: 'Nome / Razão Social' },
    { key: 'document', label: 'CPF / CNPJ' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Telefone' },
    { key: 'type', label: 'Tipo' }
  ];

  constructor(
    private fb: FormBuilder,
    private storeService: StoreService,
    private localStorageService: LocalStorageService,
    private financialService: FinancialService,
    private translate: TranslateService,
    private toastService: FinancialToastService,
    private viaCepService: ViaCepService
  ) {
    this.partyForm = this.fb.group({
      name: ['', Validators.required],
      trade_name: [''],
      document: ['', Validators.required],
      email: ['', [Validators.email]],
      phone: [''],
      mobile: [''],
      is_customer: [false],
      is_supplier: [false],
      is_employee: [false],
      is_salesperson: [false],
      zip_code: [''],
      address_street: [''],
      address_number: [''],
      address_complement: [''],
      address_neighborhood: [''],
      address_city: [''],
      address_state: [''],
      notes: ['']
    });
  }

  ngOnInit() {
    this.loadStoreData();
  }

  loadStoreData() {
    const selectedStore = this.localStorageService.getData<Store>(this.STORE_KEY);
    this.selectedStore = selectedStore;
    if (selectedStore && selectedStore.id_code) {
      this.loadParties();
    } else {
      this.storeService.getStores().subscribe({
        next: (stores) => {
          if (stores && stores.length > 0) {
            this.selectedStore = stores[0];
            this.loadParties();
          }
        },
        error: (err) => console.error('Error fetching stores', err)
      });
    }
  }

  loadParties() {
    if (!this.selectedStore?.id_code) return;
    this.financialService.getParties(this.selectedStore.id_code).subscribe({
      next: (data) => {
        this.parties = data;
        this.applyFilterAndSort();
      },
      error: (err) => console.error('Error fetching parties', err)
    });
  }

  // DataTable Methods
  onFilterChange() {
    this.currentPage = 1;
    this.applyFilterAndSort();
  }

  applyFilterAndSort() {
    let data = [...this.parties];

    // Filter by Type
    if (this.selectedType) {
      if (this.selectedType === 'customer') data = data.filter(p => p.is_customer);
      else if (this.selectedType === 'supplier') data = data.filter(p => p.is_supplier);
      else if (this.selectedType === 'employee') data = data.filter(p => p.is_employee);
      else if (this.selectedType === 'salesperson') data = data.filter(p => p.is_salesperson);
    }

    // Filter by Search Term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter(item => 
        item.name.toLowerCase().includes(term) ||
        (item.document && item.document.includes(term)) ||
        (item.email && item.email.toLowerCase().includes(term)) ||
        (item.phone && item.phone.includes(term)) ||
        (item.mobile && item.mobile.includes(term)) ||
        (item.trade_name && item.trade_name.toLowerCase().includes(term))
      );
    }

    // Sort
    data.sort((a, b) => {
      let valueA: any = a[this.sortKey as keyof Party];
      let valueB: any = b[this.sortKey as keyof Party];

      // Handle custom sort keys
      if (this.sortKey === 'type') {
        valueA = this.getPartyTypeLabel(a);
        valueB = this.getPartyTypeLabel(b);
      }

      // Handle null/undefined values
      if (valueA == null) valueA = '';
      if (valueB == null) valueB = '';

      if (valueA < valueB) return this.sortOrder === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    this.filteredAndSortedData = data;
    this.updatePagination();
  }

  updatePagination() {
    this.totalItems = this.filteredAndSortedData.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    } else if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    this.startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.endIndex = Math.min(this.startIndex + this.itemsPerPage, this.totalItems);
    this.currentData = this.filteredAndSortedData.slice(this.startIndex, this.endIndex);
  }

  handleSort(key: string) {
    const typedKey = key as SortKey;
    if (this.sortKey === typedKey) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = typedKey;
      this.sortOrder = 'asc';
    }
    this.applyFilterAndSort();
  }

  handlePageChange(page: number) {
    this.currentPage = page;
    this.updatePagination();
  }

  getPartyTypeLabel(party: Party): string {
    const types = [];
    if (party.is_customer) types.push('Cliente');
    if (party.is_supplier) types.push('Fornecedor');
    if (party.is_employee) types.push('Funcionário');
    if (party.is_salesperson) types.push('Vendedor');
    return types.join(', ');
  }

  addParty() {
    this.editingParty = null;
    this.partyForm.reset({
      is_customer: false,
      is_supplier: false,
      is_employee: false,
      is_salesperson: false
    });
    this.enableAddressFields();
    this.showPartyForm = true;
  }

  editParty(party: Party) {
    this.editingParty = party;
    this.partyForm.patchValue({
      name: party.name,
      trade_name: party.trade_name,
      document: party.document,
      email: party.email,
      phone: party.phone,
      mobile: party.mobile,
      is_customer: party.is_customer,
      is_supplier: party.is_supplier,
      is_employee: party.is_employee,
      is_salesperson: party.is_salesperson,
      zip_code: party.zip_code,
      address_street: party.address_street,
      address_number: party.address_number,
      address_neighborhood: party.address_neighborhood,
      address_city: party.address_city,
      address_state: party.address_state,
      notes: party.notes
    });
    this.enableAddressFields();
    this.showPartyForm = true;
  }

  cancelPartyForm() {
    this.showPartyForm = false;
    this.editingParty = null;
    this.cepError = '';
    this.isLoadingCep = false;
  }

  saveParty() {
    if (this.partyForm.invalid) {
      this.partyForm.markAllAsTouched();
      return;
    }

    if (!this.selectedStore?.id_code) {
      this.toastService.triggerToast('warning', 'Atenção', 'Nenhuma loja selecionada.');
      return;
    }

    this.isSubmitting = true;
    // Use getRawValue() to include disabled fields
    const formValue = this.partyForm.getRawValue();
    const payload = { ...formValue, store_id: this.selectedStore.id_code };

    const request$ = this.editingParty
      ? this.financialService.updateParty(this.editingParty.id_code, payload)
      : this.financialService.createParty(payload);

    request$.subscribe({
      next: () => {
        this.toastService.triggerToast('success', 'Sucesso', 
          this.editingParty ? 'Parceiro atualizado com sucesso.' : 'Parceiro criado com sucesso.');
        this.loadParties();
        this.cancelPartyForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error saving party', err);
        this.toastService.triggerToast('error', 'Erro', 'Erro ao salvar parceiro.');
        this.isSubmitting = false;
      }
    });
  }

  // CEP Logic
  onCepInput(event: any) {
    const input = event.target as HTMLInputElement;
    let cep = input.value.replace(/\D/g, '');
    
    if (cep.length > 5) {
      cep = `${cep.slice(0, 5)}-${cep.slice(5, 8)}`;
    }
    
    this.partyForm.patchValue({ zip_code: cep }, { emitEvent: false });
    this.cepError = '';
    
    if (cep.replace(/\D/g, '').length === 8) {
      this.searchAddressByCep(cep);
    }
  }

  searchAddressByCep(cep: string) {
    const cleanCep = cep.replace(/\D/g, '');
    
    if (!this.viaCepService.isValidCep(cleanCep)) {
      this.cepError = 'CEP inválido';
      return;
    }

    this.isLoadingCep = true;
    this.cepError = '';

    this.viaCepService.getAddressByCep(cleanCep).subscribe({
      next: (addressData: AddressData) => {
        this.partyForm.patchValue({
          address_street: addressData.street,
          address_complement: addressData.complement,
          address_neighborhood: addressData.neighborhood,
          address_city: addressData.city,
          address_state: addressData.state,
          zip_code: this.viaCepService.formatCep(addressData.zipCode)
        });
        
        this.disableAddressFields();
        this.isLoadingCep = false;
      },
      error: (error) => {
        this.cepError = error.message;
        this.isLoadingCep = false;
        this.enableAddressFields();
      }
    });
  }

  disableAddressFields() {
    this.partyForm.get('address_street')?.disable();
    this.partyForm.get('address_neighborhood')?.disable();
    this.partyForm.get('address_city')?.disable();
    this.partyForm.get('address_state')?.disable();
  }

  enableAddressFields() {
    this.partyForm.get('address_street')?.enable();
    this.partyForm.get('address_neighborhood')?.enable();
    this.partyForm.get('address_city')?.enable();
    this.partyForm.get('address_state')?.enable();
  }

  confirmDeleteParty(party: Party) {
    this.partyToDelete = party;
    this.isDeletePartyModalOpen = true;
  }

  deleteParty() {
    if (!this.partyToDelete) return;

    this.isSubmitting = true;
    this.financialService.deleteParty(this.partyToDelete.id_code).subscribe({
      next: () => {
        this.toastService.triggerToast('success', 'Sucesso', 'Parceiro removido com sucesso.');
        this.loadParties();
        this.isDeletePartyModalOpen = false;
        this.partyToDelete = null;
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error deleting party', err);
        this.toastService.triggerToast('error', 'Erro', 'Erro ao excluir parceiro.');
        this.isSubmitting = false;
      }
    });
  }

  cancelDeleteParty() {
    this.isDeletePartyModalOpen = false;
    this.partyToDelete = null;
  }
}
