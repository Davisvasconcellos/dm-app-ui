// AppHeaderComponent
import { Component, ElementRef, ViewChild, Input, ChangeDetectorRef, OnInit, AfterViewInit } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
// import { NotificationDropdownComponent } from '../../components/header/notification-dropdown/notification-dropdown.component';
import { UserDropdownComponent } from '../../components/header/user-dropdown/user-dropdown.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DropdownComponent } from '../../components/ui/dropdown/dropdown.component';
import { DropdownItemComponent } from '../../components/ui/dropdown/dropdown-item/dropdown-item.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    // NotificationDropdownComponent,
    UserDropdownComponent,
    TranslateModule,
    DropdownComponent,
    DropdownItemComponent,
  ],
  templateUrl: './app-header.component.html',
})
export class AppHeaderComponent implements OnInit, AfterViewInit {
  readonly isMobileOpen$;

  roleHomeLink: string = '/';

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  @Input() showSidebarToggle = true;

  currentLang: 'pt-br' | 'en' = 'pt-br';

  isLangOpen = false;

  languages: Array<{ code: 'pt-br' | 'en'; label: string; flag: string }> = [
    { code: 'pt-br', label: 'Português (Brasil)', flag: 'https://flagcdn.com/w40/br.png' },
    { code: 'en', label: 'English (US)', flag: 'https://flagcdn.com/w40/us.png' },
  ];

  get currentFlag(): string {
    return this.languages.find(l => l.code === this.currentLang)?.flag ?? 'https://flagcdn.com/w40/br.png';
  }

  constructor(
    public sidebarService: SidebarService,
    private translate: TranslateService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
    this.currentLang = (localStorage.getItem('lang') as 'pt-br' | 'en') || 'pt-br';

    // Definir link de home conforme a role atual
    this.authService.currentUser$.subscribe(user => {
      const role = user?.role ?? null;
      const normalized = role === 'customer' ? 'user' : role;
      switch (normalized) {
        case 'admin':
          this.roleHomeLink = '/pub/admin';
          break;
        case 'master':
          this.roleHomeLink = '/pub/master';
          break;
        case 'waiter':
          this.roleHomeLink = '/pub/waiter';
          break;
        case 'manager':
        case 'user':
          this.roleHomeLink = '/events/home-default';
          break;
        default:
          this.roleHomeLink = '/';
      }
      // Forçar atualização da view quando o usuário/role mudar
      this.cdr.detectChanges();
    });
  }

  ngOnInit() {
    // Inscrever-se nas mudanças de estado do sidebar para forçar atualização
    this.sidebarService.isMobileOpen$.subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  handleToggle() {
    if (window.innerWidth >= 1280) {
      this.sidebarService.toggleExpanded();
    } else {
      this.sidebarService.toggleMobileOpen();
    }
  }

  ngAfterViewInit() {
    document.addEventListener('keydown', this.handleKeyDown);
    // Forçar verificação após inicialização da view para garantir que ícones e estado inicial sejam renderizados
    setTimeout(() => this.cdr.detectChanges(), 0);
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.searchInput?.nativeElement.focus();
    }
  };

  toggleLangDropdown(): void {
    this.isLangOpen = !this.isLangOpen;
  }

  closeLangDropdown(): void {
    this.isLangOpen = false;
  }

  changeLanguage(lang: 'pt-br' | 'en'): void {
    this.currentLang = lang;
    localStorage.setItem('lang', lang);
    this.translate.use(lang);
    this.isLangOpen = false;
  }
}
