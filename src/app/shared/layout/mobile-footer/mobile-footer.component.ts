import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-mobile-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mobile-footer.component.html',
  styleUrls: ['./mobile-footer.component.css'],
})
export class MobileFooterComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private sub = new Subscription();

  readonly items = [
    { key: 'home', label: 'Home', link: '/', fragment: null as string | null },
    { key: 'checkin', label: 'Check-in', link: '/self-checkin', fragment: null as string | null },
    { key: 'profile', label: 'Perfil', link: '/profile-qr', fragment: null as string | null },
  ] as const;

  activeIndex = 0;

  get indicatorLeftPercent(): number {
    return (this.activeIndex + 0.5) * (100 / this.items.length);
  }

  ngOnInit(): void {
    this.updateActiveFromUrl(this.router.url);
    this.sub.add(
      this.router.events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd)
      ).subscribe((e) => this.updateActiveFromUrl(e.urlAfterRedirects))
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  isLoggedIn(): boolean {
    return !!this.authService.getAuthToken();
  }

  private updateActiveFromUrl(url: string): void {
    const hashIndex = url.indexOf('#');
    const path = (hashIndex >= 0 ? url.slice(0, hashIndex) : url).split('?')[0] || '/';

    const idx = this.items.findIndex((it) => {
      return it.link === path;
    });

    this.activeIndex = idx >= 0 ? idx : 0;
  }
}

