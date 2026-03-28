import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../../shared/services/auth.service';
import { Store, StoreService } from '../../../pages/admin/stores/store.service';
import { LocalStorageService } from '../../../shared/services/local-storage.service';
import { StoreContextService } from '../../../shared/services/store-context.service';

@Component({
  selector: 'app-home-financial',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './home-financial.component.html',
})
export class HomeFinancialComponent implements OnInit {
  currentUser: User | null = null;

  // Propriedades para o modal de lojas
  availableStores: Store[] = [];
  selectedStore: Store | null = null;
  showStoreModal = false;
  isLoadingStores = false;
  private readonly STORE_KEY = 'selectedStore';

  constructor(
    private authService: AuthService,
    private storeService: StoreService,
    private localStorageService: LocalStorageService,
    private storeContext: StoreContextService
  ) { }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadStores();

    this.storeContext.activeStore$.subscribe(store => {
      this.selectedStore = store;
    });
  }

  get isAdmin(): boolean {
    const role = this.currentUser?.role;
    return role === 'admin' || role === 'master' || role === 'manager';
  }

  private loadStores(): void {
    this.isLoadingStores = true;
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

        this.availableStores = Array.from(uniqueStoresMap.values());
        this.isLoadingStores = false;
      },
      error: (err) => {
        console.error('Erro ao carregar lojas no financial:', err);
        const memberships = (user as any)?.storeMemberships || [];
        this.availableStores = memberships
          .filter((m: any) => m.store)
          .map((m: any) => m.store);
        this.isLoadingStores = false;
      }
    });
  }

  openStoreModal(): void { this.showStoreModal = true; }
  closeStoreModal(): void { this.showStoreModal = false; }

  selectStore(store: Store): void {
    this.storeContext.setActiveStore(store);
    this.closeStoreModal();
  }
}
