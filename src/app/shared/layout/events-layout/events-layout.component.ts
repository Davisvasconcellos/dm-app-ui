import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { MobileFooterComponent } from '../mobile-footer/mobile-footer.component';

@Component({
  selector: 'app-events-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, AppHeaderComponent, MobileFooterComponent],
  template: `
    <div class="min-h-screen">
      <app-header [showSidebarToggle]="false" />
      <div class="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6 pb-24">
        <router-outlet></router-outlet>
      </div>
      <app-mobile-footer />
    </div>
  `,
})
export class EventsLayoutComponent {}

