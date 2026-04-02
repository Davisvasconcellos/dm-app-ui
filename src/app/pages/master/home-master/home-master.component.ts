import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home-master',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Master Admin</h1>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <a
          [routerLink]="['/master/modules']"
          class="block rounded-lg border border-gray-200 bg-white p-6 shadow hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750"
        >
          <h2 class="text-lg font-semibold text-gray-800 dark:text-white">User Management</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">Alterar role e habilitar módulos (somente admin).</p>
        </a>
      </div>
    </div>
  `
})
export class HomeMasterComponent {}
