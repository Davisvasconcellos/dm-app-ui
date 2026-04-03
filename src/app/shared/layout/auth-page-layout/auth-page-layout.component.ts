import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { GridShapeComponent } from '../../components/common/grid-shape/grid-shape.component';
import { RouterModule } from '@angular/router';
import { ThemeToggleTwoComponent } from '../../components/common/theme-toggle-two/theme-toggle-two.component';
import { AppContextService } from '../../services/app-context.service';
import { StoreContextService, Store } from '../../services/store-context.service';

@Component({
  selector: 'app-auth-page-layout',
  imports: [
    GridShapeComponent,
    RouterModule,
    ThemeToggleTwoComponent,
  ],
  templateUrl: './auth-page-layout.component.html',
  styles: ``
})
export class AuthPageLayoutComponent {
  private authService = inject(AuthService);
  private appContext = inject(AppContextService);
  private storeContext = inject(StoreContextService);

  roleHomeLink = '/';
  orgName: string | null = null;
  orgLogoUrl: string | null = null;
  private isScopedHost = false;

  constructor() {
    this.isScopedHost = !!this.appContext.getTenant();

    this.authService.currentUser$.subscribe(user => {
      const role = user?.role ?? null;
      const normalized = role === 'customer' ? 'user' : role;
      switch (normalized) {
        case 'admin':
          this.roleHomeLink = '/pub/admin';
          break;
        case 'master':
          this.roleHomeLink = '/pub/master';
          break;
        case 'waiter':
          this.roleHomeLink = '/pub/waiter';
          break;
        case 'manager':
        case 'user':
          this.roleHomeLink = '/events/home-default';
          break;
        default:
          this.roleHomeLink = '/';
      }
    });

    this.storeContext.activeStore$.subscribe((store: Store | null) => {
      if (!this.isScopedHost) {
        this.orgName = null;
        this.orgLogoUrl = null;
        return;
      }
      const org = store?.organization;
      this.orgName = org?.name || null;
      this.orgLogoUrl = org?.logo_url || store?.logo_url || null;
    });
  }

  get rightPanelName(): string {
    return this.orgName || 'DM-APP';
  }

  get rightPanelLogoUrl(): string {
    return this.orgLogoUrl || '/images/logo/auth-logo.svg';
  }
}
