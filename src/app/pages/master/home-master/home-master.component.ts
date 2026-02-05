import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home-master',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Master Admin</h1>
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <p class="text-gray-600 dark:text-gray-300">Bem-vindo à área administrativa Master.</p>
      </div>
    </div>
  `
})
export class HomeMasterComponent {}
