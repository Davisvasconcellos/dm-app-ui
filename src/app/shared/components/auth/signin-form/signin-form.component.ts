import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { LabelComponent } from '../../form/label/label.component';
import { CheckboxComponent } from '../../form/input/checkbox.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { InputFieldComponent } from '../../form/input/input-field.component';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { switchMap } from 'rxjs/operators';
import { AppContextService } from '../../../services/app-context.service';
import { PublicStoresService } from '../../../services/public-stores.service';
import { StoreContextService, Store } from '../../../services/store-context.service';

@Component({
  selector: 'app-signin-form',
  imports: [
    CommonModule,
    LabelComponent,
    CheckboxComponent,
    ButtonComponent,
    InputFieldComponent,
    RouterModule,
    FormsModule,
  ],
  templateUrl: './signin-form.component.html',
  styles: ``
})
export class SigninFormComponent implements OnInit {
  private authService = inject(AuthService);
  private appContext = inject(AppContextService);
  private publicStores = inject(PublicStoresService);
  private storeContext = inject(StoreContextService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  showPassword = false;
  isChecked = false;
  isLoading = false;
  errorMessage = '';
  showKioskError = false;
  kioskErrorMessage = '';
  currentReturnUrl: string | null = null;
  currentFlow: string | null = null;
  signupQueryParams: any = {};

  email = '';
  password = '';
  storeScope: Store | null = null;
  storeScopeError = '';
  scopeLoading = false;

  ngOnInit(): void {
    this.resolveScopeFromHostname();
    this.route.queryParamMap.subscribe((params) => {
      const returnUrl = params.get('returnUrl');
      const flow = params.get('flow');

      this.currentReturnUrl = returnUrl && returnUrl.startsWith('/') && !returnUrl.includes('://') ? returnUrl : null;
      this.currentFlow = flow;

      const token = params.get('token');
      const emailParam = params.get('email');
      if (emailParam) this.email = emailParam;

      if (token && !this.currentReturnUrl) {
        this.currentReturnUrl = `/invite/accept?token=${token}`;
      }

      const qp: any = {};
      if (this.currentReturnUrl) qp.returnUrl = this.currentReturnUrl;
      if (this.currentFlow) qp.flow = this.currentFlow;
      if (token) qp.token = token;
      this.signupQueryParams = qp;
    });
  }

  private resolveScopeFromHostname(): void {
    const tenant = this.appContext.getTenant();
    if (!tenant) return;
    this.scopeLoading = true;
    this.storeScopeError = '';

    this.publicStores.resolve({ subdomain: tenant }).subscribe({
      next: (resp) => {
        const store = resp?.data?.store;
        const org = resp?.data?.organization;
        if (!store?.id_code) {
          this.storeScope = null;
          this.storeScopeError = 'Loja não encontrada.';
          this.scopeLoading = false;
          return;
        }
        this.storeScope = {
          id_code: store.id_code,
          id: 0,
          name: store.name,
          logo_url: store.logo_url,
          banner_url: store.banner_url,
          organization: org ? { id_code: org.id_code, name: org.name, logo_url: org.logo_url } : undefined
        };
        this.storeContext.setActiveStore(this.storeScope);
        this.scopeLoading = false;
      },
      error: (err) => {
        this.storeScope = null;
        this.storeContext.setActiveStore(null);
        this.storeScopeError = err?.error?.message || 'Loja não encontrada.';
        this.scopeLoading = false;
      },
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onSignIn() {
    if (this.storeScopeError) return;
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor, preencha todos os campos obrigatórios.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login({ email: this.email, password: this.password })
      .pipe(
        switchMap((loginResponse) => {
          console.log('Login inicial realizado:', loginResponse);
          // Busca dados completos do usuário (incluindo módulos)
          return this.authService.getUserMe();
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Dados do usuário atualizados:', response);
          this.isLoading = false;

          // 1) Sempre priorizar returnUrl quando presente (sobrepõe regras de role)
          const returnUrl = this.currentReturnUrl;
          if (returnUrl) {
            this.router.navigateByUrl(returnUrl);
            return;
          }

          // 2) Se for fluxo de quiosque e não há returnUrl, exibir erro específico
          const isKiosk = this.isKioskFlow();
          if (isKiosk && !returnUrl) {
            this.showKioskError = true;
            this.kioskErrorMessage = 'Não foi possível recuperar o questionário. Por favor, escaneie o QR Code novamente ou acesse o link de perguntas do evento.';
            return;
          }

          // Redireciona para o Hub Central, que decide o próximo passo
          this.router.navigate(['/']);
        },
        error: (error) => {
          console.error('Erro ao fazer login:', error);
          this.isLoading = false;
          this.errorMessage = 'Email ou senha incorretos. Tente novamente.';
        }
      });
  }

  async loginWithGoogle() {
    if (this.storeScopeError) return;
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();

      this.authService.loginWithGoogle(idToken)
        .pipe(
          switchMap((loginResponse) => {
            console.log('Login Google inicial realizado:', loginResponse);
            return this.authService.getUserMe();
          })
        )
        .subscribe({
          next: (response) => {
            console.log('Dados do usuário atualizados (Google):', response);
            this.isLoading = false;
            // 1) Sempre priorizar returnUrl quando presente (sobrepõe regras de role)
            const returnUrl = this.currentReturnUrl;
            if (returnUrl) {
              this.router.navigateByUrl(returnUrl);
              return;
            }

            // 2) Se for fluxo de quiosque e não há returnUrl, exibir erro específico
            const isKiosk = this.isKioskFlow();
            if (isKiosk && !returnUrl) {
              this.showKioskError = true;
              this.kioskErrorMessage = 'Não foi possível recuperar o questionário. Por favor, escaneie o QR Code novamente ou acesse o link de perguntas do evento.';
              return;
            }

            // Redireciona para o Hub Central
            this.router.navigate(['/']);
          },
          error: (err) => {
            console.error('Erro no login com Google (API):', err);
            this.isLoading = false;
            this.errorMessage = 'Falha no login com Google. Tente novamente.';
          }
        });
    } catch (err) {
      console.error('Erro no popup do Google:', err);
      this.isLoading = false;
      this.errorMessage = 'Não foi possível autenticar com Google.';
    }
  }

  private getReturnUrl(): string | null {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    if (url && url.startsWith('/') && !url.includes('://')) {
      return url;
    }
    return null;
  }

  private isKioskFlow(): boolean {
    return this.route.snapshot.queryParamMap.get('flow') === 'kiosk';
  }
}
