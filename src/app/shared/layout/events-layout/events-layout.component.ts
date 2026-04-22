import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { AppHeaderComponent } from '../app-header/app-header.component';
import { MobileFooterComponent } from '../mobile-footer/mobile-footer.component';
import { AuthService } from '../../services/auth.service';
import { inject, OnInit } from '@angular/core';

@Component({
  selector: 'app-events-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, AppHeaderComponent, MobileFooterComponent],
  template: `
    <div class="min-h-screen">
      <app-header [showSidebarToggle]="false" />
      <div class="pb-24 overflow-x-hidden">
        <router-outlet></router-outlet>
      </div>
      <app-mobile-footer />
    </div>
  `,
})
export class EventsLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
    }
  }
}

