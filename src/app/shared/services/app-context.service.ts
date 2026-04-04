import { Injectable } from '@angular/core';

export type AppContext = 'main' | 'app' | 'events';

@Injectable({ providedIn: 'root' })
export class AppContextService {
  getHostname(): string {
    if (typeof window === 'undefined') return '';
    return window.location.hostname || '';
  }

  getContext(): AppContext {
    const host = this.getHostname().toLowerCase();
    if (!host) return 'main';
    if (host.startsWith('events.')) return 'events';
    if (host.startsWith('app.')) return 'app';
    if (host.includes('.app.')) return 'app';
    return 'main';
  }

  getTenant(): string | null {
    const host = this.getHostname().toLowerCase();
    if (!host) return null;

    const parts = host.split('.').filter(Boolean);
    if (parts.length < 2) return null;

    const reserved = new Set(['www', 'app', 'events', 'localhost']);

    if (parts.length >= 2 && parts[1] === 'app') {
      const t = parts[0];
      return t && !reserved.has(t) ? t : null;
    }

    const first = parts[0];
    if (reserved.has(first)) return null;

    const knownBases = [
      'dmedia.com.br',
      'dmedia.com',
      'vibe.com.br',
      'vibe.com',
      'local.dmedia',
      'local',
    ];
    const hostLower = host.toLowerCase();
    if (knownBases.some((b) => hostLower.endsWith(b))) return first;

    return null;
  }

  getEventsOrigin(): string {
    if (typeof window === 'undefined' || !window.location) return '';
    const protocol = window.location.protocol || 'https:';
    const port = window.location.port ? `:${window.location.port}` : '';
    const hostname = (window.location.hostname || '').toLowerCase();
    if (!hostname) return '';
    if (hostname.startsWith('events.')) return `${protocol}//${hostname}${port}`;

    const parts = hostname.split('.').filter(Boolean);
    const baseParts = (() => {
      if (hostname === 'localhost' || parts[parts.length - 1] === 'localhost') return ['localhost'];
      const lastTwo = parts.slice(-2).join('.');
      if (lastTwo === 'com.br' && parts.length >= 3) return parts.slice(-3);
      return parts.slice(-2);
    })();

    return `${protocol}//events.${baseParts.join('.')}${port}`;
  }
}
