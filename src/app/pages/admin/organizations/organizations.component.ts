import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { OrganizationService } from './organization.service';
import { ImageUploadService } from '../../../shared/services/image-upload.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService, User } from '../../../shared/services/auth.service';
import { OrganizationStore } from './organization.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LocalStorageService } from '../../../shared/services/local-storage.service';

@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Organizations</h1>
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
        <div class="relative h-35 md:h-45 rounded-2xl bg-gray-200 dark:bg-gray-800">
          <img [src]="bannerPreview || '/images/stores/default-store-banner.jpg'" alt="Banner" class="w-full h-full object-cover rounded-t-2xl">
          <div class="absolute bottom-0 left-6 transform translate-y-1/2">
            <div class="relative h-20 w-20 rounded-full border-4 border-white dark:border-gray-900 md:h-25 md:w-25">
              <img [src]="logoPreview || '/images/stores/default-store-logo.png'" alt="Logo" class="w-full h-full object-cover rounded-full">
              <button type="button" (click)="triggerLogoInput()" class="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 6H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </button>
              <input type="file" id="logoInput" class="hidden" (change)="onLogoSelected($event)" accept="image/png, image/jpeg">
            </div>
          </div>
          <button type="button" (click)="triggerBannerInput()" class="absolute top-3 right-3 rounded-lg bg-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
            Alterar Banner
          </button>
          <input type="file" id="bannerInput" class="hidden" (change)="onBannerSelected($event)" accept="image/png, image/jpeg">
        </div>

        <div class="border-b border-gray-200 px-2 pt-2 pb-2 mt-10 md:mt-12 dark:border-gray-800">
          <nav class="flex space-x-8" aria-label="Tabs">
            <button
              (click)="setActiveTab('data')"
              [class.border-brand-500]="activeTab === 'data'"
              [class.text-brand-500]="activeTab === 'data'"
              [class.border-transparent]="activeTab !== 'data'"
              [class.text-gray-500]="activeTab !== 'data'"
              class="whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Dados
            </button>
            <button
              (click)="setActiveTab('stores')"
              [class.border-brand-500]="activeTab === 'stores'"
              [class.text-brand-500]="activeTab === 'stores'"
              [class.border-transparent]="activeTab !== 'stores'"
              [class.text-gray-500]="activeTab !== 'stores'"
              class="whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Stores
            </button>
            <button
              (click)="setActiveTab('users')"
              [class.border-brand-500]="activeTab === 'users'"
              [class.text-brand-500]="activeTab === 'users'"
              [class.border-transparent]="activeTab !== 'users'"
              [class.text-gray-500]="activeTab !== 'users'"
              class="whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Users
            </button>
          </nav>
        </div>
        @if (activeTab === 'data') {
        <form [formGroup]="orgForm" (ngSubmit)="onSubmit()">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label for="orgName" class="mb-2.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Nome da Organização *</label>
              <input id="orgName" formControlName="name" type="text" class="w-full rounded-lg border border-gray-300 bg-transparent py-3 px-5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            </div>
            <div>
              <label for="orgDocument" class="mb-2.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Documento (CNPJ)</label>
              <input id="orgDocument" formControlName="document" type="text" class="w-full rounded-lg border border-gray-300 bg-transparent py-3 px-5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            </div>
          </div>
          <div class="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-800">
            <button type="submit" [disabled]="isSubmitting" class="flex justify-center rounded-lg bg-brand-500 py-2 px-6 font-medium text-white hover:bg-opacity-90">
              {{
                isSubmitting
                  ? (existingOrgId ? 'Atualizando...' : 'Criando...')
                  : (existingOrgId ? 'Atualizar Organização' : 'Criar Organização')
              }}
            </button>
          </div>
        </form>
        @if (showOnboardingModal) {
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div class="max-w-xl w-full p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-lg">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Bem-vindo ao Admin</h3>
              <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Crie sua Organização para iniciar. Isso criará a loja Matriz automaticamente e permitirá configurar sua operação.
              </p>
              <div class="flex justify-end">
                <button type="button" (click)="dismissOnboarding()" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700">
                  Entendi
                </button>
              </div>
            </div>
          </div>
        }
        }
        @if (activeTab === 'stores') {
        <div class="px-1 py-3 space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg shrink-0">
              <button
                (click)="storeViewMode = 'grid'"
                [class.bg-white]="storeViewMode === 'grid'"
                [class.dark:bg-gray-600]="storeViewMode === 'grid'"
                [class.shadow-sm]="storeViewMode === 'grid'"
                [class.text-gray-900]="storeViewMode === 'grid'"
                [class.dark:text-white]="storeViewMode === 'grid'"
                [class.text-gray-500]="storeViewMode !== 'grid'"
                [class.dark:text-gray-400]="storeViewMode !== 'grid'"
                class="px-4 py-1.5 text-xs font-semibold rounded-md transition-all"
              >
                Cards
              </button>
              <button
                (click)="storeViewMode = 'list'"
                [class.bg-white]="storeViewMode === 'list'"
                [class.dark:bg-gray-600]="storeViewMode === 'list'"
                [class.shadow-sm]="storeViewMode === 'list'"
                [class.text-gray-900]="storeViewMode === 'list'"
                [class.dark:text-white]="storeViewMode === 'list'"
                [class.text-gray-500]="storeViewMode !== 'list'"
                [class.dark:text-gray-400]="storeViewMode !== 'list'"
                class="px-4 py-1.5 text-xs font-semibold rounded-md transition-all"
              >
                Lista
              </button>
            </div>
            <a [routerLink]="['/admin/stores/create']" [queryParams]="{ org: existingOrgId }" class="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600">
              Adicionar Loja
            </a>
          </div>
          @if (storeViewMode === 'grid') {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            @for (st of stores; track $index) {
            <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden group hover:shadow-md transition-all duration-200">
              <div class="h-32 relative flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                <img [src]="st.banner_url || '/images/stores/default-store-banner.jpg'" class="w-full h-full object-cover" alt="Banner da loja">
                <div class="absolute -bottom-6 left-4 w-12 h-12 rounded-full overflow-hidden border-2 border-white dark:border-gray-700 bg-white dark:bg-gray-800">
                  <img [src]="st.logo_url || '/images/stores/default-store-logo.png'" class="w-full h-full object-cover" alt="Logo da loja">
                </div>
              </div>
              <div class="px-4 pt-8 pb-4 flex-1">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">{{ st.name }}</h3>
                <p class="text-xs text-gray-600 dark:text-gray-400">{{ st.city || '-' }}</p>
                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Status: {{ st.status }}</p>
              </div>
              <div class="px-4 pb-4 flex items-center gap-2">
                <a [routerLink]="['/admin/stores', st.id_code, 'config']" class="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white">Abrir</a>
                <a [routerLink]="['/admin/stores', st.id_code, 'config']" class="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300">Gerenciar</a>
              </div>
            </div>
            }
            @if (!isLoadingStores && stores.length === 0) {
            <div class="col-span-full">
              <div class="p-8 rounded-xl bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Nenhuma loja encontrada</h4>
                <p class="text-xs text-gray-500 dark:text-gray-400">Crie sua organização para gerar a loja Matriz ou adicione novas lojas.</p>
              </div>
            </div>
            }
          </div>
          }
          @if (storeViewMode === 'list') {
          <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr class="bg-gray-50 dark:bg-gray-700/50">
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Loja</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cidade</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                @for (st of stores; track $index) {
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td class="px-6 py-3">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600">
                        <img [src]="st.logo_url || '/images/stores/default-store-logo.png'" class="w-full h-full object-cover" alt="Logo">
                      </div>
                      <div>
                        <div class="text-sm font-medium text-gray-900 dark:text-white">{{ st.name }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">{{ st.city || '-' }}</td>
                  <td class="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">{{ st.status }}</td>
                  <td class="px-6 py-3 text-right">
                    <a [routerLink]="['/admin/stores', st.id_code, 'config']" class="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white">Abrir</a>
                  </td>
                </tr>
                }
                @if (!isLoadingStores && stores.length === 0) {
                <tr>
                  <td colspan="3" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Nenhuma loja encontrada.
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
          }
          @if (isLoadingStores) {
          <div class="grid place-items-center py-10">
            <div class="h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand-500 border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
              <span class="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
            </div>
          </div>
          }
        </div>
        }
        @if (activeTab === 'users') {
        <div class="px-1 py-3">
          <p class="text-sm text-gray-600 dark:text-gray-300">Convites e usuários da organização (em breve).</p>
        </div>
        }
      </div>
    </div>
  `
})
export class OrganizationsComponent implements OnInit {
  orgForm: FormGroup;
  isSubmitting = false;
  logoPreview: string | null = null;
  bannerPreview: string | null = null;
  pendingLogoFile: File | null = null;
  pendingBannerFile: File | null = null;
  activeTab = 'data';
  existingOrgId: string | null = null;
  storeViewMode: 'grid' | 'list' = 'grid';
  stores: OrganizationStore[] = [];
  isLoadingStores = false;
  showOnboardingModal = false;

  private fb = inject(FormBuilder);
  private orgService = inject(OrganizationService);
  private imageUpload = inject(ImageUploadService);
  private toast = inject(ToastService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private localStorage = inject(LocalStorageService);

  ngOnInit(): void {
    this.orgForm = this.fb.group({
      name: ['', Validators.required],
      document: ['']
    });
    const qpOnboarding = this.route.snapshot.queryParamMap.get('onboarding') === '1';
    this.showOnboardingModal = qpOnboarding;
    this.authService.currentUser$.subscribe((user: User | null) => {
      const owned = (user as any)?.ownedOrganizations;
      const first = Array.isArray(owned) && owned.length > 0 ? owned[0] : null;
      this.existingOrgId = first?.id || first?.id_code || null;
      const isAdmin = (user?.role || '') === 'admin';
      if (isAdmin && !this.existingOrgId) {
        this.showOnboardingModal = true;
        this.activeTab = 'data';
      }
      if (first) {
        const name = first.name || '';
        const document = first.document || '';
        const logo = typeof first.logo_url === 'string' ? first.logo_url.replace(/`/g, '').trim() : first.logo_url;
        const banner = typeof first.banner_url === 'string' ? first.banner_url.replace(/`/g, '').trim() : first.banner_url;
        this.orgForm.patchValue({ name, document });
        this.logoPreview = logo || this.logoPreview;
        this.bannerPreview = banner || this.bannerPreview;
      }
      if (this.activeTab === 'stores' && this.existingOrgId) {
        this.loadOrganizationStores();
      }
    });
  }

  dismissOnboarding(): void {
    this.showOnboardingModal = false;
    setTimeout(() => {
      const el = document.getElementById('orgName') as HTMLInputElement | null;
      el?.focus();
    }, 0);
  }

  triggerLogoInput() {
    document.getElementById('logoInput')?.click();
  }
  triggerBannerInput() {
    document.getElementById('bannerInput')?.click();
  }

  onLogoSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    this.pendingLogoFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => this.logoPreview = e.target.result;
    reader.readAsDataURL(file);
  }

  onBannerSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    this.pendingBannerFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => this.bannerPreview = e.target.result;
    reader.readAsDataURL(file);
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'stores' && this.existingOrgId) {
      this.loadOrganizationStores();
    }
  }

  private loadOrganizationStores() {
    if (!this.existingOrgId) return;
    this.isLoadingStores = true;
    this.orgService.getOrganizationStores(this.existingOrgId).subscribe({
      next: (data) => {
        this.stores = (data || []).map(s => ({
          ...s,
          logo_url: typeof s.logo_url === 'string' ? s.logo_url.replace(/`/g, '').trim() : s.logo_url,
          banner_url: typeof s.banner_url === 'string' ? s.banner_url.replace(/`/g, '').trim() : s.banner_url,
          city: s.city || ''
        }));
        this.isLoadingStores = false;
      },
      error: () => {
        this.isLoadingStores = false;
      }
    });
  }

  async onSubmit() {
    if (this.orgForm.invalid) {
      this.orgForm.markAllAsTouched();
      this.toast.triggerToast('warning', 'Atenção', 'Preencha os campos obrigatórios.');
      return;
    }
    this.isSubmitting = true;
    const payload = this.orgForm.value;
    const creating = !this.existingOrgId;
    this.toast.triggerToast('info', creating ? 'Criando organização' : 'Atualizando organização', 'Aguarde enquanto processamos sua solicitação...');
    try {
      let orgId = this.existingOrgId;
      if (creating) {
        const resp = await this.orgService.createOrganization(payload).toPromise();
        orgId = resp?.data?.organization?.id || null;
        if (!orgId) {
          this.toast.triggerToast('error', 'Erro', 'Organização não retornou ID válido.');
          this.isSubmitting = false;
          return;
        }
        this.existingOrgId = orgId;
        this.toast.triggerToast('success', 'Sucesso', 'Organização criada com sucesso.');
      } else {
        await this.orgService.updateOrganization(orgId!, payload).toPromise();
        this.toast.triggerToast('success', 'Sucesso', 'Organização atualizada com sucesso.');
      }
      let logoUrl: string | undefined;
      let bannerUrl: string | undefined;
      if (this.pendingLogoFile) {
        const upload = await this.imageUpload.uploadImage(this.pendingLogoFile, 'org-logo', orgId!, { maxWidth: 300, maxHeight: 300, quality: 0.9 }, `organizations/${orgId}/branding`);
        if (upload.success && upload.filePath) {
          logoUrl = upload.filePath;
          this.toast.triggerToast('success', 'Logo atualizado', 'O logo foi enviado e aplicado.');
        } else {
          this.toast.triggerToast('error', 'Erro no upload', upload.error || 'Falha ao enviar o logo.');
        }
      }
      if (this.pendingBannerFile) {
        const upload = await this.imageUpload.uploadImage(this.pendingBannerFile, 'org-banner', orgId!, { maxWidth: 1200, maxHeight: 400, quality: 0.9 }, `organizations/${orgId}/branding`);
        if (upload.success && upload.filePath) {
          bannerUrl = upload.filePath;
          this.toast.triggerToast('success', 'Banner atualizado', 'O banner foi enviado e aplicado.');
        } else {
          this.toast.triggerToast('error', 'Erro no upload', upload.error || 'Falha ao enviar o banner.');
        }
      }
      if (logoUrl || bannerUrl) {
        await this.orgService.updateOrganization(orgId!, { logo_url: logoUrl, banner_url: bannerUrl }).toPromise();
        this.toast.triggerToast('success', 'Dados atualizados', 'Imagens aplicadas à organização.');
      }
      // Após criar/atualizar, se acabou de criar e tem orgId, levar direto para configuração da loja Matriz
      if (creating && orgId) {
        this.toast.triggerToast('info', 'Redirecionando', 'Vamos configurar a loja Matriz.');
        this.orgService.getOrganizationStores(orgId).subscribe({
          next: (stores) => {
            const firstStore = (stores || [])[0];
            if (firstStore?.id_code || (firstStore as any)?.id) {
              const idParam = firstStore.id_code || (firstStore as any).id;
              // Salva a loja selecionada para consistência em outras telas
              this.localStorage.saveData('selectedStore', firstStore);
              this.router.navigate(['/admin/stores', idParam, 'config']);
            } else {
              // Se não veio store, recarrega aba para tentar novamente
              this.loadOrganizationStores();
            }
          },
          error: () => {
            this.loadOrganizationStores();
          }
        });
      } else if (this.activeTab === 'stores' && orgId) {
        this.loadOrganizationStores();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido ao criar organização.';
      this.toast.triggerToast('error', 'Erro', msg);
    } finally {
      this.isSubmitting = false;
    }
  }
}
