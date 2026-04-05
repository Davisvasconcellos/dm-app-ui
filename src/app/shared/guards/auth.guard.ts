import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { AppContextService } from '../services/app-context.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private appContext: AppContextService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    return this.authService.isAuthenticated$.pipe(
      take(1),
      map(isAuthenticated => {
        if (isAuthenticated) {
          return true;
        } else {
          // Redireciona para login se não estiver autenticado
          const isKioskFlow = state.url.startsWith('/events/answer/') || state.url.startsWith('/events/answer-plain/');
          const queryParams: { [key: string]: string } = { returnUrl: state.url };
          if (isKioskFlow) {
            queryParams['flow'] = 'kiosk';
          }
          const ctx = this.appContext.getContext();
          const target = ctx === 'events' || ctx === 'project' ? '/login' : '/signin';
          this.router.navigate([target], { 
            queryParams
          });
          return false;
        }
      })
    );
  }
}
