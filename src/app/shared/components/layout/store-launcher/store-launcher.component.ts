import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StoreContextService, Store } from '../../../services/store-context.service';
import { AuthService, User } from '../../../services/auth.service';
import { TranslateModule } from '@ngx-translate/core';

interface ModuleCard {
    name: string;
    slug: string;
    icon: string;
    path: string;
    colorClass: string;
    bgClass: string;
    iconClass: string;
}

@Component({
    selector: 'app-store-launcher',
    standalone: true,
    imports: [CommonModule, RouterModule, TranslateModule],
    template: `
    <div class="container mx-auto p-4 animate-in fade-in duration-500">
      <!-- Welcome Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white/90" *ngIf="currentUser">
          Olá {{ currentUser.name }},
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">
          O que deseja gerenciar hoje na unidade <strong>{{ activeStore?.name }}</strong>?
        </p>
      </div>

      <!-- Modules Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        @for (module of allowedModules; track module.slug) {
          <a [routerLink]="module.path" 
             class="group relative flex flex-col items-center justify-center p-8 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl transition-all duration-300 hover:border-brand-500 dark:hover:border-brand-500 hover:shadow-xl hover:shadow-brand-500/10 hover:-translate-y-1">
            
            <div [class]="'w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110 ' + module.bgClass">
              <span [class]="'text-4xl ' + module.iconClass" [innerHTML]="module.icon"></span>
            </div>
            
            <h3 class="text-lg font-bold text-gray-800 dark:text-white/90 group-hover:text-brand-600 dark:group-hover:text-brand-400">
              {{ module.name }}
            </h3>
            
            <!-- Glow Effect -->
            <div class="absolute inset-0 rounded-2xl bg-brand-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          </a>
        }
      </div>

      <!-- No Access Message -->
      @if (allowedModules.length === 0) {
        <div class="text-center py-20 bg-gray-50 dark:bg-gray-800/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
          <p class="text-gray-500 dark:text-gray-400">Você não possui módulos habilitados para esta unidade.</p>
          <a routerLink="/admin/organizations" class="mt-4 inline-block text-brand-600 font-medium hover:underline">Ver minhas organizações</a>
        </div>
      }
    </div>
  `
})
export class StoreLauncherComponent implements OnInit {
    private storeContext = inject(StoreContextService);
    private authService = inject(AuthService);

    currentUser: User | null = null;
    activeStore: Store | null = null;

    modules: ModuleCard[] = [
        {
            name: 'Financeiro',
            slug: 'financial',
            path: '/financial',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
            colorClass: 'text-green-600',
            bgClass: 'bg-green-100 dark:bg-green-900/20',
            iconClass: 'text-green-600 dark:text-green-400'
        },
        {
            name: 'Eventos',
            slug: 'events',
            path: '/events/event-list-admin',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
            colorClass: 'text-purple-600',
            bgClass: 'bg-purple-100 dark:bg-purple-900/20',
            iconClass: 'text-purple-600 dark:text-purple-400'
        },
        {
            name: 'Pub / Operacional',
            slug: 'pub',
            path: '/pub/admin/admin-dashboard',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>',
            colorClass: 'text-orange-600',
            bgClass: 'bg-orange-100 dark:bg-orange-900/20',
            iconClass: 'text-orange-600 dark:text-orange-400'
        }
    ];

    allowedModules: ModuleCard[] = [];

    ngOnInit(): void {
        this.currentUser = this.authService.getCurrentUser();
        this.activeStore = this.storeContext.getActiveStore();
        this.filterModules();

        // React to store changes
        this.storeContext.activeStore$.subscribe(store => {
            this.activeStore = store;
            this.filterModules();
        });
    }

    private filterModules(): void {
        // Faked logic: Filter based on user permissions
        this.allowedModules = this.modules.filter(m => this.authService.hasModule(m.slug));
    }
}
