import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../../../shared/services/auth.service';
import { Store, StoreService } from '../../../admin/stores/store.service';
import { LocalStorageService } from '../../../../shared/services/local-storage.service';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home-admin',
  imports: [RouterModule, CommonModule, TranslateModule],
  templateUrl: './home-admin.component.html',
  styleUrl: './home-admin.component.css'
})
export class HomeAdminComponent implements OnInit {
  currentUser: User | null = null;

  // Propriedades para o modal de lojas
  availableStores: Store[] = [];
  selectedStore: Store | null = null;
  showStoreModal = false;
  isLoadingStores = false;
  private readonly STORE_KEY = 'selectedStore';
  showOnboardingModal = false;

  private authService = inject(AuthService);
  private storeService = inject(StoreService);
  private localStorageService = inject(LocalStorageService);
  private router = inject(Router);

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    const owned = (this.currentUser as any)?.ownedOrganizations;
    if (this.currentUser?.role === 'admin' && (!Array.isArray(owned) || owned.length === 0)) {
      this.showOnboardingModal = true;
    }
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

  goToOnboarding(): void {
    this.router.navigate(['/admin/organizations'], { queryParams: { onboarding: '1', returnUrl: '/pub/admin' } });
    this.showOnboardingModal = false;
  }

  // Sem helper: o template usa diretamente store.logo_url (URL completa)
}
