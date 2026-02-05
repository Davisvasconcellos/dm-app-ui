import { Injectable, Injector } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { LocalStorageService } from '../shared/services/local-storage.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private redirecting = false;
  constructor(private localStorageService: LocalStorageService, private injector: Injector) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.localStorageService.getAuthToken();
    const cloned = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

    return next.handle(cloned).pipe(
      catchError((err: HttpErrorResponse) => {
        if (!this.redirecting) {
          if (err.status === 401) {
            this.redirecting = true;
            try { 
              const router = this.injector.get(Router);
              router.navigate(['/signout']); 
            } catch {}
          } else if (err.status === 403) {
            this.redirecting = true;
            const message = err.error?.message || 'Acesso negado.';
            try { 
              const router = this.injector.get(Router);
              router.navigate(['/no-permission'], { queryParams: { message } }); 
            } catch {}
          }
        }
        return throwError(() => err);
      })
    );
  }
}
