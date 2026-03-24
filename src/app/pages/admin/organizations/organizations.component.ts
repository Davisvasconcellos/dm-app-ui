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
import { StoreInviteService, StoreInvite, CreateInvitePayload } from '../stores/config/store-invite.service';
import { LabelComponent } from '../../../shared/components/form/label/label.component';
import { InputFieldComponent } from '../../../shared/components/form/input/input-field.component';
import { SelectComponent } from '../../../shared/components/form/select/select.component';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';
import { CheckboxComponent } from '../../../shared/components/form/input/checkbox.component';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    LabelComponent,
    InputFieldComponent,
    SelectComponent,
    ButtonComponent,
    CheckboxComponent,
    ModalComponent,
    NgClass
  ],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Unidades</h1>
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
              Unidades
            </button>
            <button
              (click)="setActiveTab('users')"
              [class.border-brand-500]="activeTab === 'users'"
              [class.text-brand-500]="activeTab === 'users'"
              [class.border-transparent]="activeTab !== 'users'"
              [class.text-gray-500]="activeTab !== 'users'"
              class="whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Colaboradores
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
              Adicionar Unidade
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
                <a [routerLink]="['/admin/stores', st.id_code, 'config']" class="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white">Gerenciar</a>
              </div>
            </div>
            }
            @if (!isLoadingStores && stores.length === 0) {
            <div class="col-span-full">
              <div class="p-8 rounded-xl bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Nenhuma unidade encontrada</h4>
                <p class="text-xs text-gray-500 dark:text-gray-400">Crie sua organização para gerar a unidade Matriz ou adicione novas unidades.</p>
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
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unidade</th>
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
                    <a [routerLink]="['/admin/stores', st.id_code, 'config']" class="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white">Gerenciar</a>
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
        <div class="px-1 py-3 space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-xl font-semibold text-gray-800 dark:text-white/90">
              Gestão Central de Colaboradores
            </h2>
            <app-button *ngIf="!showCollaboratorForm" (click)="addCollaborator()">
              Convidar Novo
            </app-button>
          </div>

          @if (showCollaboratorForm) {
          <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <h4 class="text-base font-semibold text-gray-800 dark:text-white mb-4">
              Enviar Convite de Colaborador
            </h4>
            <form [formGroup]="collaboratorForm" (ngSubmit)="sendInvitation()">
              <div class="grid gap-6 sm:grid-cols-2 mb-6">
                <div class="sm:col-span-2">
                  <app-label>Ponto de Venda (Unidade) *</app-label>
                  <app-select [value]="collaboratorForm.get('store_id')?.value"
                    (valueChange)="collaboratorForm.get('store_id')?.setValue($event)"
                    [options]="storeOptions"
                    placeholder="Selecione a unidade para este convite" />
                </div>
                <div>
                  <app-label>Email do Usuário *</app-label>
                  <app-input-field type="email" formControlName="email" placeholder="Digite o email para convite" />
                </div>
                <div>
                  <app-label>Tipo de Usuário *</app-label>
                  <app-select [value]="collaboratorForm.get('role')?.value"
                    (valueChange)="collaboratorForm.get('role')?.setValue($event)"
                    [options]="[{value: 'manager', label: 'Gerente'}, {value: 'collaborator', label: 'Colaborador'}, {value: 'viewer', label: 'Observador'}]" />
                </div>
                <div class="sm:col-span-2">
                  <app-label>Módulos de Acesso *</app-label>
                  <div class="flex flex-wrap gap-4 mt-2">
                    @for (module of filteredModuleOptions; track module.value) {
                    <app-checkbox [id]="'mod_' + module.value" [label]="module.label"
                      [checked]="isModuleSelected(module.label)" (checkedChange)="toggleModule(module.label, $event)" />
                    }
                  </div>
                </div>
              </div>
              <div class="flex justify-end gap-3">
                <app-button type="button" variant="outline" (click)="cancelCollaboratorForm()">Cancelar</app-button>
                <app-button type="submit" [disabled]="isSubmitting || collaboratorForm.invalid || (collaboratorForm.get('modules')?.value || []).length === 0">Enviar Convite</app-button>
              </div>
            </form>
          </div>
          }

          <div class="space-y-4">
            @for (st of stores; track st.id_code) {
            <div class="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-white/[0.03] transition-all">
              <button (click)="toggleStore(st.id_code)" 
                class="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                    <img [src]="st.logo_url || '/images/stores/default-store-logo.png'" class="w-full h-full object-cover">
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-white">{{ st.name }}</h3>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-xs text-gray-500 dark:text-gray-400">{{ st.city || 'Local não definido' }}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
                        {{ storeUserGroups[st.id_code]?.collaborators?.length || 0 }} ativos · {{ storeUserGroups[st.id_code]?.pendingInvites?.length || 0 }} pendentes
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  @if (storeUserGroups[st.id_code]?.isLoading) {
                    <div class="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                  }
                  <svg [class.rotate-180]="storeUserGroups[st.id_code]?.expanded" class="w-5 h-5 text-gray-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </button>

              @if (storeUserGroups[st.id_code]?.expanded) {
              <div class="p-6 border-t border-gray-100 dark:border-white/[0.05] bg-gray-50/30 dark:bg-transparent space-y-6">
                <!-- Ativos -->
                <div>
                  <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span class="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                    Colaboradores Ativos
                  </h4>
                  <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/20">
                    <table class="w-full text-sm">
                      <thead class="bg-gray-50 dark:bg-white/[0.02]">
                        <tr>
                          <th class="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Usuário</th>
                          <th class="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Role</th>
                          <th class="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Ações</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                        @for (colab of storeUserGroups[st.id_code]?.collaborators; track colab.id) {
                        <tr>
                          <td class="px-4 py-3">
                            <div class="flex flex-col">
                              <span class="font-medium text-gray-900 dark:text-white">{{ colab.email }}</span>
                            </div>
                          </td>
                          <td class="px-4 py-3 capitalize text-gray-600 dark:text-gray-300">{{ colab.role }}</td>
                          <td class="px-4 py-3">
                             <a [routerLink]="['/admin/stores', st.id_code, 'config']" [queryParams]="{tab: 'collaborators'}" class="text-brand-500 hover:text-brand-600 text-xs font-medium">Gerenciar</a>
                          </td>
                        </tr>
                        }
                        @if ((storeUserGroups[st.id_code]?.collaborators?.length || 0) === 0) {
                        <tr>
                          <td colspan="3" class="px-4 py-6 text-center text-gray-500 italic">Nenhum colaborador ativo nesta unidade.</td>
                        </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Pendentes -->
                <div>
                  <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span class="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                    Convites em Aberto
                  </h4>
                  <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/20">
                    <table class="w-full text-sm">
                      <thead class="bg-gray-50 dark:bg-white/[0.02]">
                        <tr>
                          <th class="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Email</th>
                          <th class="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                          <th class="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Expira</th>
                          <th class="px-4 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Links</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                        @for (invite of storeUserGroups[st.id_code]?.pendingInvites; track invite.id_code) {
                        <tr>
                          <td class="px-4 py-3 text-gray-900 dark:text-white">{{ invite.invited_email }}</td>
                          <td class="px-4 py-3">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" [ngClass]="{
                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400': invite.status === 'revoked' || invite.status === 'expired' || (invite.status === 'pending' && isExpired(invite.expires_at)),
                              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400': invite.status === 'pending' && !isExpired(invite.expires_at)
                            }">
                              {{ invite.status === 'revoked' ? 'Revogado' : (isExpired(invite.expires_at) ? 'Expirado' : 'Pendente') }}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-xs text-gray-500">{{ invite.expires_at | date:'dd/MM HH:mm' }}</td>
                          <td class="px-4 py-3 text-right">
                            <button *ngIf="invite.status === 'pending' && !isExpired(invite.expires_at) && getInviteFromCache(invite.id_code)" 
                              (click)="copyInviteLink(getInviteFromCache(invite.id_code)!)"
                              class="text-gray-400 hover:text-brand-500">
                              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                            </button>
                          </td>
                        </tr>
                        }
                        @if ((storeUserGroups[st.id_code]?.pendingInvites?.length || 0) === 0) {
                        <tr>
                          <td colspan="4" class="px-4 py-6 text-center text-gray-500 italic">Nenhum convite pendente.</td>
                        </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              }
            </div>
            }
          </div>
        </div>
        }

        <!-- Invite Link Modal (Centralizado) -->
        <app-modal [isOpen]="showInviteLinkModal" (close)="closeInviteLinkModal()">
          <div class="p-6">
            <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-500">
              <svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826L10.242 9.172a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102 1.101"></path></svg>
            </div>
            <h3 class="text-lg font-semibold text-center text-gray-900 dark:text-white mb-2">Convite Gerado!</h3>
            <p class="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
              Copie o link abaixo e envie para o convidado. <br>
              <span class="text-xs font-medium text-warning-600 dark:text-warning-500">Por segurança, o token só é visível agora.</span>
            </p>

            <div class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 mb-6 group">
              <input type="text" [value]="generatedInviteLink" readonly
                class="flex-1 bg-transparent border-none outline-none text-xs text-gray-600 dark:text-gray-300 font-mono overflow-hidden text-ellipsis">
              <button (click)="copyInviteLink()" class="p-2 text-gray-400 hover:text-brand-500 transition-colors">
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
              </button>
            </div>

            <div class="flex justify-center">
              <app-button class="w-full sm:w-auto" (click)="closeInviteLinkModal()">Concluído</app-button>
            </div>
          </div>
        </app-modal>
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
  storeOptions: { value: string, label: string }[] = [];

  // Collaborator Management properties
  collaboratorForm: FormGroup;
  showCollaboratorForm = false;
  storeUserGroups: Record<string, {
    collaborators: any[],
    pendingInvites: StoreInvite[],
    isLoading: boolean,
    expanded: boolean,
    hasLoaded: boolean
  }> = {};

  moduleOptions = [
    { value: 'financial', label: 'Financeiro', slug: 'financial', permissions: ['financial:read', 'financial:write'] },
    { value: 'events', label: 'Eventos', slug: 'events', permissions: ['events:read', 'events:write'] },
    { value: 'pub', label: 'Pub', slug: 'pub', permissions: ['pub:read', 'pub:write'] }
  ];
  filteredModuleOptions: any[] = [];

  generatedInviteLink: string | null = null;
  showInviteLinkModal: boolean = false;
  private readonly INVITE_LINKS_CACHE_KEY = 'dm_invite_links_cache';

  private fb = inject(FormBuilder);
  private orgService = inject(OrganizationService);
  private storeInviteService = inject(StoreInviteService);
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

    this.collaboratorForm = this.fb.group({
      store_id: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: ['collaborator', Validators.required],
      modules: [[]],
      expires_in_days: [7]
    });

    // Filtra os módulos baseados nos módulos do usuário logado
    this.filteredModuleOptions = this.moduleOptions.filter(opt => this.authService.hasModule(opt.slug));
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

    const reader = new FileReader();
    reader.onload = (e: any) => this.logoPreview = e.target.result;
    reader.readAsDataURL(file);

    if (this.existingOrgId) {
      this.uploadLogo(file, this.existingOrgId);
    } else {
      this.pendingLogoFile = file;
    }
  }

  async uploadLogo(file: File, orgId: string) {
    try {
      const upload = await this.imageUpload.uploadImage(
        file,
        'org-logo',
        orgId,
        { maxWidth: 300, maxHeight: 300, quality: 0.9 },
        `organizations/${orgId}/branding`
      );
      if (upload.success) {
        this.pendingLogoFile = null;
        this.toast.triggerToast('success', 'Sucesso', 'Logo atualizado com sucesso.');
      }
    } catch (e) {
      this.toast.triggerToast('error', 'Erro', 'Falha ao enviar o logo.');
    }
  }

  onBannerSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => this.bannerPreview = e.target.result;
    reader.readAsDataURL(file);

    if (this.existingOrgId) {
      this.uploadBanner(file, this.existingOrgId);
    } else {
      this.pendingBannerFile = file;
    }
  }

  async uploadBanner(file: File, orgId: string) {
    try {
      const upload = await this.imageUpload.uploadImage(
        file,
        'org-banner',
        orgId,
        { maxWidth: 1200, maxHeight: 400, quality: 0.9 },
        `organizations/${orgId}/branding`
      );
      if (upload.success) {
        this.pendingBannerFile = null;
        this.toast.triggerToast('success', 'Sucesso', 'Banner atualizado com sucesso.');
      }
    } catch (e) {
      this.toast.triggerToast('error', 'Erro', 'Falha ao enviar o banner.');
    }
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    if ((tab === 'stores' || tab === 'users') && this.existingOrgId) {
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
        this.storeOptions = this.stores.map(s => ({ value: s.id_code, label: s.name }));
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

  // --- Collaborator Management Methods ---

  addCollaborator() {
    this.showCollaboratorForm = true;
    this.collaboratorForm.reset({ role: 'collaborator', modules: [], expires_in_days: 7 });
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
    this.isSubmitting = true;
    const formValue = this.collaboratorForm.value;
    const storeId = formValue.store_id;

    const selectedPermissions: string[] = [];
    formValue.modules.forEach((modLabel: string) => {
      const mod = this.moduleOptions.find(m => m.label === modLabel);
      if (mod) selectedPermissions.push(...mod.permissions);
    });

    const payload: CreateInvitePayload = {
      email: formValue.email,
      role: formValue.role,
      permissions: selectedPermissions,
      expires_in_days: formValue.expires_in_days || 7
    };

    this.storeInviteService.createInvite(storeId, payload).subscribe({
      next: (res) => {
        const token = this.getInviteTokenFromLink(res.invite_link);
        this.generatedInviteLink = `${window.location.origin}/invite/accept?token=${token}`;
        if (token) this.saveInviteToCache(res.data.id_code, token);
        this.showInviteLinkModal = true;
        this.fetchStoreUsers(storeId, true);
        this.toast.triggerToast('success', 'Sucesso', 'Convite criado com sucesso.');
        this.cancelCollaboratorForm();
        this.isSubmitting = false;
      },
      error: () => {
        this.toast.triggerToast('error', 'Erro', 'Erro ao criar convite.');
        this.isSubmitting = false;
      }
    });
  }

  toggleStore(storeId: string) {
    if (!this.storeUserGroups[storeId]) {
      this.storeUserGroups[storeId] = {
        collaborators: [],
        pendingInvites: [],
        isLoading: false,
        expanded: false,
        hasLoaded: false
      };
    }

    this.storeUserGroups[storeId].expanded = !this.storeUserGroups[storeId].expanded;

    if (this.storeUserGroups[storeId].expanded && !this.storeUserGroups[storeId].hasLoaded) {
      this.fetchStoreUsers(storeId);
    }
  }

  fetchStoreUsers(storeId: string, force = false) {
    if (!this.storeUserGroups[storeId]) return;
    if (this.storeUserGroups[storeId].isLoading && !force) return;

    this.storeUserGroups[storeId].isLoading = true;
    this.storeInviteService.listInvites(storeId).subscribe({
      next: (res) => {
        const allInvites = (res.data || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        this.storeUserGroups[storeId].pendingInvites = allInvites.filter(i => i.status !== 'accepted');
        this.storeUserGroups[storeId].collaborators = allInvites.filter(i => i.status === 'accepted').map(i => ({
          id: i.id_code,
          name: i.invited_email.split('@')[0],
          email: i.invited_email,
          role: i.role,
          permissions: i.permissions
        }));

        this.storeUserGroups[storeId].isLoading = false;
        this.storeUserGroups[storeId].hasLoaded = true;
      },
      error: () => {
        this.storeUserGroups[storeId].isLoading = false;
        this.toast.triggerToast('error', 'Erro', 'Falha ao carregar usuários da loja.');
      }
    });
  }

  // --- Invite Helpers ---

  getInviteTokenFromLink(link: string): string {
    if (!link) return '';
    try {
      const url = new URL(link);
      return url.searchParams.get('token') || link;
    } catch {
      if (link.includes('token=')) {
        return link.split('token=')[1].split('&')[0];
      }
      return link;
    }
  }

  saveInviteToCache(idCode: string, value: string) {
    const cache = this.localStorage.getData<Record<string, string>>(this.INVITE_LINKS_CACHE_KEY) || {};
    cache[idCode] = value;
    this.localStorage.saveData(this.INVITE_LINKS_CACHE_KEY, cache);
  }

  getInviteFromCache(idCode: string): string | null {
    const cache = this.localStorage.getData<Record<string, string>>(this.INVITE_LINKS_CACHE_KEY) || {};
    const value = cache[idCode];
    if (!value) return null;

    const token = this.getInviteTokenFromLink(value);
    return `${window.location.origin}/invite/accept?token=${token}`;
  }

  copyInviteLink(link?: string) {
    const linkToCopy = link || this.generatedInviteLink;
    if (linkToCopy) {
      navigator.clipboard.writeText(linkToCopy);
      this.toast.triggerToast('success', 'Sucesso', 'Link copiado para a área de transferência.');
    }
  }

  closeInviteLinkModal() {
    this.showInviteLinkModal = false;
    this.generatedInviteLink = null;
  }

  isExpired(date: string): boolean {
    return new Date(date) < new Date();
  }
}
