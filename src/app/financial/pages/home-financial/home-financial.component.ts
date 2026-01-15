import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../../shared/services/auth.service';
import { Store, StoreService } from '../../../pages/pub/admin/home-admin/store.service';
import { LocalStorageService } from '../../../shared/services/local-storage.service';

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
    private localStorageService: LocalStorageService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadStores();
    this.loadSelectedStore();
  }

  private loadStores(): void {
    this.isLoadingStores = true;
    this.storeService.getStores().subscribe({
      next: (stores: Store[]) => {
        this.availableStores = stores;
        this.loadSelectedStore(); // Mover para cá garante que as lojas estejam disponíveis
        this.isLoadingStores = false;
      },
      error: () => this.isLoadingStores = false
    });
  }

  /**
   * Carrega a loja selecionada do localStorage.
   */
  private loadSelectedStore(): void {
    const savedStore = this.localStorageService.getData<Store>(this.STORE_KEY);
    if (savedStore) {
      this.selectedStore = savedStore;
    }
  }

  openStoreModal(): void { this.showStoreModal = true; }
  closeStoreModal(): void { this.showStoreModal = false; }

  selectStore(store: Store): void {
    this.selectedStore = store;
    this.localStorageService.saveData(this.STORE_KEY, store);
    this.closeStoreModal();
  }
}
