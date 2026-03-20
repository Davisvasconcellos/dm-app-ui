import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { LabelComponent } from '../../form/label/label.component';
import { CheckboxComponent } from '../../form/input/checkbox.component';
import { InputFieldComponent } from '../../form/input/input-field.component';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, RegisterRequest } from '../../../services/auth.service';


@Component({
  selector: 'app-signup-form',
  imports: [
    CommonModule,
    LabelComponent,
    CheckboxComponent,
    InputFieldComponent,
    RouterModule,
    FormsModule,
  ],
  templateUrl: './signup-form.component.html',
  styles: ``
})
export class SignupFormComponent implements OnInit {

  showPassword = false;
  showConfirmPassword = false;
  isChecked = false;
  isLoading = false;
  errorMessage = '';

  fname = '';
  lname = '';
  email = '';
  password = '';
  confirmPassword = '';
  currentReturnUrl: string | null = null;
  currentFlow: string | null = null;
  signinQueryParams: any = {};

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
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
      this.signinQueryParams = qp;
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  isPasswordValid(): boolean {
    return this.password.length >= 6 &&
      this.hasNumber(this.password) &&
      this.hasLetter(this.password);
  }

  hasNumber(str: string): boolean {
    return /\d/.test(str);
  }

  hasLetter(str: string): boolean {
    return /[a-zA-Z]/.test(str);
  }

  onSignUp() {
    // Reset error message
    this.errorMessage = '';

    // Basic validation
    if (!this.fname.trim() || !this.lname.trim() || !this.email.trim() || !this.password.trim() || !this.confirmPassword.trim()) {
      this.errorMessage = 'All fields are required';
      return;
    }

    // Password validation
    if (!this.isPasswordValid()) {
      this.errorMessage = 'Password must be at least 6 characters long and contain both numbers and letters';
      return;
    }

    // Password confirmation validation
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    // Checkbox validation
    if (!this.isChecked) {
      this.errorMessage = 'You must agree to the Terms and Conditions';
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMessage = 'Por favor, insira um email válido.';
      return;
    }

    this.isLoading = true;

    const registerData: RegisterRequest = {
      name: `${this.fname.trim()} ${this.lname.trim()}`,
      email: this.email.trim(),
      password: this.password
    };

    this.authService.register(registerData).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          // Se veio com returnUrl (p.ex. fluxo quiosque), priorizar retornar ao questionário
          if (this.currentReturnUrl) {
            this.router.navigateByUrl(this.currentReturnUrl);
            return;
          }

          // Caso contrário, redirecionar baseado no papel
          const user = response.data.user as any;
          const userRole = user.role;
          if (userRole === 'admin') {
            const owned = user?.ownedOrganizations;
            const hasOwned = Array.isArray(owned) && owned.length > 0;
            this.router.navigate([hasOwned ? '/admin/home' : '/admin/organizations'], { queryParams: hasOwned ? {} : { onboarding: '1', returnUrl: '/admin/home' } });
          } else if (userRole === 'master') {
            this.router.navigate(['/pub/master']);
          } else if (userRole === 'waiter') {
            this.router.navigate(['/pub/waiter']);
          } else {
            this.router.navigate(['/events/home-default']);
          }
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Erro ao criar conta. Tente novamente.';
      }
    });
  }
}
