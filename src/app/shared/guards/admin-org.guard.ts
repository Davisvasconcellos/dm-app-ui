import { Injectable, inject } from '@angular/core';
import { CanActivate, CanActivateChild, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService, User } from '../services/auth.service';
import { map, take, switchMap, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AdminOrgGuard implements CanActivate, CanActivateChild {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.check(state.url);
  }

  canActivateChild(childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.check(state.url);
  }

  private check(url: string): Observable<boolean> {
    return this.authService.currentUser$.pipe(
      take(1),
      switchMap((user: User | null) => {
        if (!user) return of(true);
        const role = user.role === 'customer' ? 'user' : user.role;
        if (role !== 'admin') return of(true);
        return this.authService.getUserMe().pipe(
          map(() => {
            const updated = this.authService.getCurrentUser();
            const owned = (updated as any)?.ownedOrganizations;
            const hasOwned = Array.isArray(owned) && owned.length > 0;
            if (!hasOwned) {
              const allowed = url.startsWith('/admin/organizations') || url.startsWith('/signin') || url.startsWith('/signout') || url.startsWith('/logout');
              if (allowed) return true;
              this.router.navigate(['/admin/organizations'], { queryParams: { onboarding: '1', returnUrl: url } });
              return false;
            }
            return true;
          }),
          catchError(() => of(true))
        );
      })
    );
  }
}
