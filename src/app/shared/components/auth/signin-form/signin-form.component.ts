import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { LabelComponent } from '../../form/label/label.component';
import { CheckboxComponent } from '../../form/input/checkbox.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { InputFieldComponent } from '../../form/input/input-field.component';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { switchMap } from 'rxjs/operators';

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

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const returnUrl = params.get('returnUrl');
      const flow = params.get('flow');

      this.currentReturnUrl = returnUrl && returnUrl.startsWith('/') && !returnUrl.includes('://') ? returnUrl : null;
      this.currentFlow = flow;

      const qp: any = {};
      if (this.currentReturnUrl) qp.returnUrl = this.currentReturnUrl;
      if (this.currentFlow) qp.flow = this.currentFlow;
      this.signupQueryParams = qp;
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onSignIn() {
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
        const returnUrl = this.getReturnUrl();
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

        // Caso não seja fluxo de quiosque, redireciona baseado no papel do usuário
        const user = this.authService.getCurrentUser();
        if (user) {
          switch (user.role) {
            case 'admin':
              this.router.navigate(['/pub/admin']);
              break;
            case 'master':
              this.router.navigate(['/pub/master']);
              break;
            case 'waiter':
              this.router.navigate(['/pub/waiter']);
              break;
            case 'customer':
              this.router.navigate(['/events/home-default']); // Customer usa home-default
              break;
            case 'manager':
              this.router.navigate(['/events/home-default']); // Manager usa home-default
              break;
            default:
              this.router.navigate(['/']);
              break;
          }
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (error) => {
        console.error('Erro ao fazer login:', error);
        this.isLoading = false;
        this.errorMessage = 'Email ou senha incorretos. Tente novamente.';
      }
    });
  }

  async loginWithGoogle() {
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
          const returnUrl = this.getReturnUrl();
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

          // Caso não seja fluxo de quiosque, redireciona baseado no papel do usuário, igual ao login tradicional
          const user = this.authService.getCurrentUser();
          if (user) {
            switch (user.role) {
              case 'admin':
                this.router.navigate(['/pub/admin']);
                break;
              case 'master':
                this.router.navigate(['/pub/master']);
                break;
              case 'waiter':
                this.router.navigate(['/pub/waiter']);
                break;
              case 'customer':
              case 'manager':
                this.router.navigate(['/events/home-default']);
                break;
              default:
                this.router.navigate(['/']);
                break;
            }
          } else {
            this.router.navigate(['/']);
          }
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
