import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
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
    LabelComponent,
    HttpClientModule,
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
    const routePath = this.route.snapshot.routeConfig?.path || '';
    if (routePath.includes('stores/create')) {
      this.isCreate = true;
      this.error = null;
      this.cnpjReadonly = false;
      return;
    }
    this.loadStoreDetails();
  }

  ngAfterViewInit(): void {}

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
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.error = err.message || 'Falha ao carregar os dados da loja.';
        this.isLoading = false;
      }
    });
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

  onCancel(): void {}

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
    }, () => {});
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
    }, () => {});
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
    const dv1 = calcDV(c.substring(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
    if (dv1 !== Number(c[12])) return false;
    const dv2 = calcDV(c.substring(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
    return dv2 === Number(c[13]);
  }
}
