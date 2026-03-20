import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreLauncherComponent } from '../../shared/components/layout/store-launcher/store-launcher.component';
import { StoreContextService, Store } from '../../shared/services/store-context.service';
import { StoreService } from '../admin/stores/store.service';
import { AuthService, User } from '../../shared/services/auth.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-hub',
  standalone: true,
  imports: [CommonModule, StoreLauncherComponent, RouterModule],
  template: `
    <div class="container mx-auto p-4 md:p-6">
      
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
                 class="group flex flex-col items-center p-6 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer transition-all duration-300 hover:border-brand-500 hover:shadow-xl hover:-translate-y-1">
              
              <div class="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-gray-100 dark:border-gray-700 dark:bg-gray-800 mb-4 overflow-hidden group-hover:scale-110 transition-transform">
                <img [src]="store.logo_url || '/images/stores/default-store-logo.png'" 
                     [alt]="store.name"
                     class="w-full h-full object-cover"
                     onerror="this.src='/images/stores/default-store-logo.png'">
              </div>

              <h3 class="text-xs font-bold text-gray-900 dark:text-white text-center leading-tight group-hover:text-brand-600 transition-colors">
                {{ store.name }}
              </h3>
            </div>
          }

          <!-- Create Store Button for Admins -->
          @if (canCreateStore) {
            <a routerLink="/admin/stores/create" 
               class="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800/20 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl hover:border-brand-500 hover:bg-white dark:hover:bg-white/5 transition-all group">
               <div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-gray-400 group-hover:text-brand-500 transition-colors text-2xl font-bold">+</div>
               <span class="text-xs font-medium text-gray-500 group-hover:text-brand-500 uppercase tracking-wider">Nova Unidade</span>
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
  private router = inject(Router);

  activeStore: Store | null = null;
  currentUser: User | null = null;
  stores: Store[] = [];
  isLoading = true;
  canCreateStore = false;

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.checkRoles();

    // Subscribe to context changes
    this.storeContext.activeStore$.subscribe(store => {
      this.activeStore = store;
      if (!store) {
        // Só tenta carregar lojas se o usuário ainda estiver logado
        if (this.authService.getCurrentUser()) {
          this.loadStores();
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

  loadStores(): void {
    this.isLoading = true;
    const user = this.authService.getCurrentUser();

    this.storeService.getStores().subscribe({
      next: (apiStores = []) => {
        // Capturar lojas onde o usuário é membro (colaborador/customer)
        const memberships = (user as any)?.storeMemberships || [];
        const memberStores = memberships
          .filter((m: any) => m.store && m.status === 'active')
          .map((m: any) => ({
            ...m.store,
            // Garantir compatibilidade de campos se necessário
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

        // Fallback: Tentar carregar apenas das memberships se a API falhar
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
