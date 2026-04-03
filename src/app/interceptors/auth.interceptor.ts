import { Injectable, Injector } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { LocalStorageService } from '../shared/services/local-storage.service';
import { Router } from '@angular/router';
import { AppContextService } from '../shared/services/app-context.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private redirecting = false;
  constructor(
    private localStorageService: LocalStorageService,
    private appContext: AppContextService,
    private injector: Injector
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.localStorageService.getAuthToken();
    
    // Check if the request is for an external domain that shouldn't receive our API token
    const isExternalApi = req.url.includes('api.discogs.com') || req.url.includes('viacep.com.br') || req.url.includes('/discogs-api');

    const tenant = this.appContext.getTenant();
    const context = this.appContext.getContext();

    const headers: Record<string, string> = {};
    if (token && !isExternalApi) headers['Authorization'] = `Bearer ${token}`;
    if (tenant && !isExternalApi) headers['X-Tenant'] = tenant;
    if (!isExternalApi) headers['X-App-Context'] = context;

    const cloned = Object.keys(headers).length ? req.clone({ setHeaders: headers }) : req;

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
