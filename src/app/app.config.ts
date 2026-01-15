// app.config.ts (providers bootstrap)
import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { routes } from './app.routes';

// ngx-translate v17 providers
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

// Auth interceptor
import { AuthInterceptor } from './interceptors/auth.interceptor';

registerLocaleData(localePt);

// Remover o factory antigo do TranslateHttpLoader (v17 não aceita parâmetros no construtor)
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    // Configuração recomendada no v17: usar provider functions
    provideTranslateService({
      // Idioma de fallback (quando não encontrar uma chave)
      fallbackLang: 'pt-br',
      // Loader HTTP com prefix/suffix configurados para a pasta public/i18n
      loader: provideTranslateHttpLoader({
        prefix: 'i18n/lang-',
        suffix: '.json'
      })
    })
  ]
};
