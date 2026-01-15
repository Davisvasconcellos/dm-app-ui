import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StoreService, Store } from '../../../pages/pub/admin/home-admin/store.service';
import { LocalStorageService } from '../../../shared/services/local-storage.service';

@Component({
  selector: 'app-financial-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './financial-settings.component.html',
})
export class FinancialSettingsComponent implements OnInit {
  activeTab: string = 'stores';
  storeForm: FormGroup;
  isSubmitting = false;

  banner_url: string = '';
  logo_url: string | null = null;
  
  private readonly STORE_KEY = 'selectedStore';

  categories = [
    { name: 'Vendas', type: 'Receita' },
    { name: 'Serviços', type: 'Receita' },
    { name: 'Aluguel', type: 'Despesa' },
    { name: 'Fornecedores', type: 'Despesa' },
    { name: 'Marketing', type: 'Despesa' }
  ];

  tags = ['Urgente', 'Recorrente', 'Projeto X', 'Impostos'];

  bankAccounts = [
    { bank: 'Banco do Brasil', agency: '1234-5', account: '99999-9', balance: 5000.00 },
    { bank: 'Nubank', agency: '0001', account: '123456-7', balance: 1250.50 }
  ];

  constructor(
    private fb: FormBuilder,
    private storeService: StoreService,
    private localStorageService: LocalStorageService
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
  }

  ngOnInit() {
    this.loadStoreData();
  }

  loadStoreData() {
    const selectedStore = this.localStorageService.getData<Store>(this.STORE_KEY);
    if (selectedStore && selectedStore.id_code) {
      this.fetchStoreById(selectedStore.id_code);
    } else {
      this.storeService.getStores().subscribe({
        next: (stores) => {
          if (stores && stores.length > 0) {
            this.fetchStoreById(stores[0].id_code);
          }
        },
        error: (err) => console.error('Error fetching stores', err)
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
    this.banner_url = data.banner_url || '';
    this.logo_url = data.logo_url || null;
  }

  onAddNewStore() {
    this.storeForm.reset();
    this.banner_url = '';
    this.logo_url = null;
    this.setActiveTab('stores');
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  triggerLogoInput() {
    document.getElementById('logoInput')?.click();
  }

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => this.logo_url = e.target.result;
      reader.readAsDataURL(file);
    }
  }

  onSubmitStore() {
            if (this.storeForm.valid) {
              this.isSubmitting = true;
              this.storeService.createStore(this.storeForm.value).subscribe({
                next: () => {
                  alert('Empresa salva com sucesso!');
                  this.storeForm.reset();
                  this.isSubmitting = false;
                },
                error: (err) => {
                  console.error(err);
                  alert('Erro ao salvar empresa.');
                  this.isSubmitting = false;
                }
              });
            }
          }

  addCategory() {
    console.log('Add category clicked');
  }

  addTag() {
    console.log('Add tag clicked');
  }

  addAccount() {
    console.log('Add account clicked');
  }
}
