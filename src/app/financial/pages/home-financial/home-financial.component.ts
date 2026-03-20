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

  private loadStores(): void {
    this.isLoadingStores = true;
    this.storeService.getStores().subscribe({
      next: (stores: Store[]) => {
        this.availableStores = stores;
        this.isLoadingStores = false;
      },
      error: () => this.isLoadingStores = false
    });
  }



  openStoreModal(): void { this.showStoreModal = true; }
  closeStoreModal(): void { this.showStoreModal = false; }

  selectStore(store: Store): void {
    this.storeContext.setActiveStore(store);
    this.closeStoreModal();
  }
}
