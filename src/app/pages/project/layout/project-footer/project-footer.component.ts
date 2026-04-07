import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-project-footer',
  standalone: false,
  templateUrl: './project-footer.component.html',
  styleUrls: ['./project-footer.component.css'],
})
export class ProjectFooterComponent implements OnInit, OnDestroy {
  router = inject(Router);
  private sub = new Subscription();

  readonly items = [
    { key: 'home', label: 'Home', link: '/project' },
    { key: 'timesheet', label: 'Timesheet', link: '/project/history' },
    { key: 'timeline', label: 'Timeline', link: '/project/me' },
  ] as const;

  activeIndex = 0;

  get indicatorLeftPercent(): number {
    return (this.activeIndex + 0.5) * (100 / this.items.length);
  }

  ngOnInit(): void {
    this.updateActiveFromUrl(this.router.url);
    this.sub.add(
      this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
        this.updateActiveFromUrl(e.urlAfterRedirects);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private updateActiveFromUrl(url: string): void {
    const hashIndex = url.indexOf('#');
    const path = (hashIndex >= 0 ? url.slice(0, hashIndex) : url).split('?')[0] || '/';
    const idx = this.items.findIndex((it) => it.link === path);
    this.activeIndex = idx >= 0 ? idx : 0;
  }
}
