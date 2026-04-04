import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';
import { CommonModule } from '@angular/common';
import { AppContextService } from '../../../shared/services/app-context.service';

@Component({
  selector: 'app-signout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div class="max-w-md w-full space-y-8">
        <div class="text-center">
          <div class="mx-auto h-12 w-12 text-gray-400">
            <svg class="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 class="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Saindo...
          </h2>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Aguarde enquanto processamos seu logout
          </p>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class SignoutComponent implements OnInit {
  private readonly LOGOUT_TIMEOUT = 5000; // 5 segundos

  constructor(
    private authService: AuthService,
    private appContext: AppContextService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.performLogout();
  }

  private performLogout(): void {
    // Configurar timeout para garantir redirecionamento mesmo se a API falhar
    const timeoutId = setTimeout(() => {
      this.redirectToLogin();
    }, this.LOGOUT_TIMEOUT);

    // Tentar fazer logout via API
    this.authService.logout().subscribe({
      next: () => {
        clearTimeout(timeoutId);
        this.redirectToLogin();
      },
      error: () => {
        // Em caso de erro, o timeout já vai redirecionar
        // Mas vamos limpar os dados locais mesmo assim
        clearTimeout(timeoutId);
        this.redirectToLogin();
      }
    });
  }

  private redirectToLogin(): void {
    const target = this.appContext.getContext() === 'events' ? '/login' : '/signin';
    this.router.navigate([target]);
  }
}
