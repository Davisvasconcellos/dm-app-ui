import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    // eslint-disable-next-line @angular-eslint/prefer-inject
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    // Suporta ambas as chaves: 'roles' e 'expectedRoles'
    const requiredRoles = (route.data['roles'] || route.data['expectedRoles']) as string[];

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (!user) {
          this.router.navigate(['/signin']);
          return false;
        }

        // Tratar equivalências: 'customer' => 'user'
        const normalizedRole = user.role === 'customer' ? 'user' : user.role;

        // Hierarquia de acesso: roles superiores acessam áreas de roles inferiores
        const hierarchyMap: Record<string, string[]> = {
          user: ['user', 'manager', 'waiter', 'admin', 'master'],
          waiter: ['waiter', 'admin', 'master'],
          admin: ['admin', 'master'],
          master: ['master'],
          manager: ['manager']
        };

        const normalize = (r: string) => (r === 'customer' ? 'user' : r);
        const requiredNormalized = requiredRoles.map(normalize);

        const allowedSet = new Set<string>();
        requiredNormalized.forEach(r => {
          const allowed = hierarchyMap[r] || [r];
          allowed.forEach(ar => allowedSet.add(ar));
        });

        const hasRequiredRole = allowedSet.has(normalizedRole);

        if (!hasRequiredRole) {
          // Redireciona para página apropriada baseada no role do usuário
          this.redirectToUserHome(user.role);
          return false;
        }

        return true;
      })
    );
  }

  private redirectToUserHome(role: string): void {
    const roleRoutes: Record<string, string> = {
      admin: '/admin/home',
      master: '/pub/master',
      manager: '/events/home-default',
      waiter: '/pub/waiter',
      customer: '/events/home-default',
      user: '/events/home-default'
    };

    const redirectRoute = roleRoutes[role] || '/';
    this.router.navigate([redirectRoute]);
  }
}
