import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-financial-dashboard-loader-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/40">
      <div class="flex h-full w-full items-center justify-center">
        <div class="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-theme-lg dark:border-gray-800 dark:bg-[#1E2635]">
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-solid border-brand-500 border-r-transparent" role="status"></div>
          <div class="text-sm font-medium text-gray-800 dark:text-gray-200">Carregando dashboard...</div>
        </div>
      </div>
    </div>
  `
})
export class FinancialDashboardLoaderOverlayComponent {}

