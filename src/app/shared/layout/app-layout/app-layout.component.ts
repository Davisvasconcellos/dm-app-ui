import { Component, ChangeDetectorRef, AfterViewInit, OnInit } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { AppSidebarComponent } from '../app-sidebar/app-sidebar.component';
import { BackdropComponent } from '../backdrop/backdrop.component';
import { RouterModule } from '@angular/router';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { MobileFooterComponent } from '../mobile-footer/mobile-footer.component';
import { ModalComponent } from '../../components/ui/modal/modal.component';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-layout',
  imports: [
    CommonModule,
    RouterModule,
    AppHeaderComponent,
    AppSidebarComponent,
    BackdropComponent,
    MobileFooterComponent,
    ModalComponent
  ],
  templateUrl: './app-layout.component.html',
})

export class AppLayoutComponent implements AfterViewInit, OnInit {
  readonly isExpanded$;
  readonly isHovered$;
  readonly isMobileOpen$;
  showOrgOnboarding = false;

  constructor(
    public sidebarService: SidebarService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
  ) {
    this.isExpanded$ = this.sidebarService.isExpanded$;
    this.isHovered$ = this.sidebarService.isHovered$;
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe((user: User | null) => {
      if (!user) {
        this.showOrgOnboarding = false;
        return;
      }
      const role = user.role;
      const isPrivileged = role === 'admin' || role === 'master';
      const hasOwned = Array.isArray((user as any).ownedOrganizations) && ((user as any).ownedOrganizations.length > 0);
      const dismissKey = `org_onboarding_dismissed_${user.id_code}`;
      const dismissed = localStorage.getItem(dismissKey) === '1';
      this.showOrgOnboarding = isPrivileged && !hasOwned && !dismissed;
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit() {
    // Forçar atualização do layout para garantir que as margens estejam corretas
    setTimeout(() => this.cdr.detectChanges(), 0);
  }

  get containerClasses() {
    return [
      'flex-1',
      'transition-all',
      'duration-300',
      'ease-in-out',
      (this.isExpanded$ || this.isHovered$) ? 'xl:ml-[290px]' : 'xl:ml-[90px]',
      this.isMobileOpen$ ? 'ml-0' : ''
    ];
  }

  dismissOrgOnboarding() {
    const user = this.authService.getCurrentUser();
    if (user?.id_code) {
      localStorage.setItem(`org_onboarding_dismissed_${user.id_code}`, '1');
    }
    this.showOrgOnboarding = false;
    this.cdr.detectChanges();
  }

}
