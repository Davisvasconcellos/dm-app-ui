import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreLauncherComponent } from '../../shared/components/layout/store-launcher/store-launcher.component';
import { StoreContextService, Store } from '../../shared/services/store-context.service';
import { StoreService } from '../admin/stores/store.service';
import { AuthService, User } from '../../shared/services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { StoreInviteService, StoreInvite } from '../admin/stores/config/store-invite.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-hub',
  standalone: true,
  imports: [CommonModule, StoreLauncherComponent, RouterModule],
  template: `
    <div class="container mx-auto p-4 md:p-6">
      
      <!-- Invites Alert -->
      @if (pendingInvites.length > 0 && !activeStore) {
        <div class="max-w-6xl mx-auto mb-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div class="flex items-start gap-4 mb-8">
            <div class="w-12 h-12 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-xl flex items-center justify-center flex-shrink-0">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
               </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-1">Convites Pendentes</h3>
              <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Você recebeu novos convites para colaborar em outras unidades do ecossistema.</p>
            </div>
          </div>

          <div class="grid gap-3">
            @for (inv of pendingInvites; track inv.id_code) {
              <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors">
                 <div class="flex flex-col">
                   <span class="text-[10px] text-gray-400 uppercase font-black tracking-widest leading-none mb-1">Unidade</span>
                   <span class="font-bold text-gray-900 dark:text-white text-sm">{{ inv.store?.name }}</span>
                 </div>
                 
                 <div class="flex items-center gap-2">
                   <button (click)="acceptInvite(inv)" 
                           [disabled]="processingInvites.has(inv.id_code)"
                           class="w-10 h-10 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
                           [title]="'Aceitar ' + inv.store?.name">
                      @if (!processingInvites.has(inv.id_code)) {
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      } @else {
                        <div class="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></div>
                      }
                   </button>
                   <button (click)="rejectInvite(inv)" 
                           [disabled]="processingInvites.has(inv.id_code)"
                           class="w-10 h-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all flex items-center justify-center rounded-xl"
                           [title]="'Recusar ' + inv.store?.name">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                     </svg>
                   </button>
                 </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Loading State -->
      <div *ngIf="isLoading" class="flex flex-col items-center justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
        <p class="mt-4 text-gray-500 dark:text-gray-400">Carregando seus ambientes...</p>
      </div>

      <!-- STEP 1: No Store Selected (Welcome + Grid) -->
      <div *ngIf="!isLoading && !activeStore" class="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <!-- Welcome Card Style -->
        <div class="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-gray-800 p-8 mb-10">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Olá {{ currentUser?.name }},
          </h1>
          <p class="text-lg text-gray-500 dark:text-gray-400">Pronto para gerenciar seu ecossistema?</p>
        </div>

        <div class="mb-6 flex items-center justify-between">
          <h2 class="text-xl font-bold text-gray-800 dark:text-white/80">Selecione uma Unidade</h2>
          <p class="text-sm text-gray-400">{{ stores.length }} unidades disponíveis</p>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          @for (store of stores; track store.id_code) {
            <div (click)="selectStore(store)" 
                 class="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              
              <div class="h-28 relative flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                <img [src]="store.banner_url || '/images/stores/default-store-banner.jpg'" 
                     class="w-full h-full object-cover" 
                     alt="Banner"
                     onerror="this.src='/images/stores/default-store-banner.jpg'">
                
                <div class="absolute -bottom-6 left-4 w-12 h-12 rounded-full overflow-hidden border-2 border-white dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md transform group-hover:scale-110 transition-transform">
                  <img [src]="store.logo_url || '/images/stores/default-store-logo.png'" 
                       class="w-full h-full object-cover" 
                       [alt]="store.name"
                       onerror="this.src='/images/stores/default-store-logo.png'">
                </div>
              </div>

              <div class="px-4 pt-8 pb-5 flex-1">
                <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-1 group-hover:text-brand-600 transition-colors">
                  {{ store.name }}
                </h3>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 uppercase tracking-wider font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {{ store.city || 'Unidade' }}
                </p>
              </div>
            </div>
          }

          <!-- Create Store Button for Admins -->
          @if (canCreateStore) {
            <a routerLink="/admin/stores/create" 
               class="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800/20 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl hover:border-brand-500 hover:bg-white dark:hover:bg-white/5 transition-all group min-h-[200px]">
               <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4 text-gray-400 group-hover:text-brand-500 group-hover:scale-110 transition-all text-3xl font-light border-2 border-dashed border-gray-300 dark:border-gray-600 group-hover:border-brand-500">
                 +
               </div>
               <span class="text-xs font-bold text-gray-400 group-hover:text-brand-600 uppercase tracking-widest transition-colors text-center">Nova Unidade</span>
            </a>
          }
        </div>
        
        <!-- No Stores Empty State -->
        @if (stores.length === 0 && !isLoading && !canCreateStore) {
          <div class="text-center py-20 bg-white dark:bg-white/5 rounded-3xl border border-gray-200 dark:border-gray-800">
             <div class="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950/30 text-orange-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
             </div>
             <p class="text-gray-500 dark:text-gray-400 px-10">Você ainda não tem acesso a nenhuma unidade. Entre em contato com o administrador da sua organização.</p>
          </div>
        }
      </div>

      <!-- STEP 2: Store Selected (Modules Only) -->
      <div *ngIf="!isLoading && activeStore" class="max-w-6xl mx-auto py-10">
         <app-store-launcher />
         
         <div class="mt-20 text-center">
           <button (click)="changeStore()" class="text-sm font-medium text-gray-400 hover:text-brand-500 transition-colors flex items-center gap-2 mx-auto bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-full">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"></path><path d="M4 20L21 3"></path><path d="M21 16v5h-5"></path><path d="M15 15l6 6"></path><path d="M4 4l5 5"></path></svg>
             Trocar de Unidade / Sair do Ambiente
           </button>
         </div>
      </div>

    </div>
  `
})
export class HubComponent implements OnInit {
  private storeContext = inject(StoreContextService);
  private storeService = inject(StoreService);
  private authService = inject(AuthService);
  private inviteService = inject(StoreInviteService);
  private toast = inject(ToastService);
  private router = inject(Router);

  activeStore: Store | null = null;
  currentUser: User | null = null;
  stores: Store[] = [];
  pendingInvites: StoreInvite[] = [];
  processingInvites = new Set<string>();
  isLoading = true;
  canCreateStore = false;

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.checkRoles();

    // Subscribe to context changes
    this.storeContext.activeStore$.subscribe(store => {
      this.activeStore = store;
      if (!store) {
        if (this.authService.getCurrentUser()) {
          this.loadStores();
          this.loadPendingInvites();
        } else {
          this.isLoading = false;
        }
      } else {
        this.isLoading = false;
      }
    });
  }

  checkRoles(): void {
    const user = this.authService.getCurrentUser();
    this.canCreateStore = user?.role === 'admin' || user?.role === 'master';
  }

  loadPendingInvites(): void {
    this.inviteService.getMyInvites().subscribe({
      next: (res) => {
        this.pendingInvites = res.data || [];
      },
      error: (err) => console.error('Erro ao carregar convites:', err)
    });
  }

  acceptInvite(invite: StoreInvite): void {
    this.processingInvites.add(invite.id_code);
    this.inviteService.acceptInviteById(invite.id_code).subscribe({
      next: () => {
        this.toast.triggerToast('success', 'Sucesso', 'Convite aceito com sucesso!');
        this.pendingInvites = this.pendingInvites.filter(i => i.id_code !== invite.id_code);
        this.processingInvites.delete(invite.id_code);

        // Refresh user profile to get the new store memberships
        this.authService.getUserMe().subscribe({
          next: () => {
            this.currentUser = this.authService.getCurrentUser();
            this.loadStores();
          },
          error: (err) => {
            console.error('Erro ao atualizar perfil após aceitar convite:', err);
            this.loadStores();
          }
        });
      },
      error: () => {
        this.toast.triggerToast('error', 'Erro', 'Não foi possível aceitar o convite.');
        this.processingInvites.delete(invite.id_code);
      }
    });
  }

  rejectInvite(invite: StoreInvite): void {
    if (confirm(`Tem certeza que deseja recusar o convite para a unidade ${invite.store?.name}?`)) {
      this.processingInvites.add(invite.id_code);
      this.inviteService.revokeMyInvite(invite.id_code).subscribe({
        next: () => {
          this.toast.triggerToast('success', 'Sucesso', 'Convite recusado.');
          this.pendingInvites = this.pendingInvites.filter(i => i.id_code !== invite.id_code);
          this.processingInvites.delete(invite.id_code);
        },
        error: () => {
          this.toast.triggerToast('error', 'Erro', 'Não foi possível recusar o convite.');
          this.processingInvites.delete(invite.id_code);
        }
      });
    }
  }

  loadStores(): void {
    this.isLoading = true;
    const user = this.authService.getCurrentUser();

    this.storeService.getStores().subscribe({
      next: (apiStores = []) => {
        // Capturar lojas onde o usuário é membro (colaborador/customer)
        const memberships = (user as any)?.storeMemberships || [];
        const memberStores = memberships
          .filter((m: any) => m.store && (m.status === 'active' || m.status === 'accepted'))
          .map((m: any) => ({
            ...m.store,
            logo_url: m.store.logo_url || null
          }));

        // Mesclar e remover duplicatas pelo id_code
        const allStoresCombined = [...apiStores, ...memberStores];
        const uniqueStoresMap = new Map<string, Store>();

        allStoresCombined.forEach(s => {
          if (s && s.id_code) {
            uniqueStoresMap.set(s.id_code, s);
          }
        });

        this.stores = Array.from(uniqueStoresMap.values());

        // Seleção automática se houver apenas uma loja
        if (this.stores.length === 1 && !this.activeStore) {
          this.selectStore(this.stores[0]);
        }

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erro ao carregar lojas da API:', err);
        const memberships = (user as any)?.storeMemberships || [];
        this.stores = memberships
          .filter((m: any) => m.store)
          .map((m: any) => m.store);

        if (this.stores.length === 1 && !this.activeStore) {
          this.selectStore(this.stores[0]);
        }
        this.isLoading = false;
      }
    });
  }

  selectStore(store: Store): void {
    this.storeContext.setActiveStore(store);
  }

  changeStore(): void {
    this.storeContext.setActiveStore(null);
  }
}
