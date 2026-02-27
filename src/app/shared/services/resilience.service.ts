import { Injectable } from '@angular/core';
import { Observable, of, timer, BehaviorSubject, mergeMap, tap, retry, catchError, OperatorFunction } from 'rxjs';

export interface ResilienceState {
    status: 'stable' | 'unstable' | 'down';
    consecutiveErrors: number;
    lastError?: any;
}

@Injectable({
    providedIn: 'root'
})
export class ResilienceService {
    private state$ = new BehaviorSubject<ResilienceState>({
        status: 'stable',
        consecutiveErrors: 0
    });

    constructor() { }

    /**
     * Retorna o estado atual de resiliência (útil para exibir banners de erro)
     */
    getState(): Observable<ResilienceState> {
        return this.state$.asObservable();
    }

    /**
   * Operador para adicionar cache e failover a qualquer observable
   */
    withFailover<T>(cacheKey: string, maxRetries: number = 3): OperatorFunction<T, T> {
        return (source: Observable<T>) => source.pipe(
            tap((data) => {
                this.resetState();
                if (data) this.saveToCache(cacheKey, data);
            }),
            retry({
                count: maxRetries,
                delay: (error, retryCount) => {
                    const delay = Math.pow(2, retryCount) * 1000;
                    return timer(delay);
                }
            }),
            catchError(err => {
                console.error(`[Resilience] Error on ${cacheKey}. Checking cache...`, err);
                const cached = this.loadFromCache<T>(cacheKey);
                if (cached) {
                    this.state$.next({ ...this.state$.value, status: 'down', lastError: 'Offline' });
                    return of(cached);
                }
                this.handleError(err, maxRetries);
                return of(null as any);
            })
        );
    }

    pollWithResilience<T>(
        sourceFactory: () => Observable<T>,
        intervalMs: number = 60000,
        maxRetries: number = 3,
        cacheKey?: string
    ): Observable<T> {
        return timer(0, intervalMs).pipe(
            mergeMap(() => {
                const obs = sourceFactory();
                return cacheKey ? obs.pipe(this.withFailover(cacheKey, maxRetries)) : obs.pipe(
                    tap({
                        next: () => this.resetState(),
                        error: (err) => this.handleError(err, maxRetries)
                    }),
                    retry({
                        count: maxRetries,
                        delay: (_, i) => timer(Math.pow(2, i) * 1000)
                    }),
                    catchError(() => of(null as any))
                );
            }),
            mergeMap(val => val ? of(val) : [])
        );
    }

    saveToCache(key: string, data: any): void {
        try {
            const cacheObj = {
                data,
                timestamp: Date.now()
            };
            localStorage.setItem(`dm_cache_${key}`, JSON.stringify(cacheObj));
        } catch (e) {
            console.warn('[Resilience] Error saving to localStorage', e);
        }
    }

    loadFromCache<T>(key: string): T | null {
        try {
            const saved = localStorage.getItem(`dm_cache_${key}`);
            if (saved) {
                const cacheObj = JSON.parse(saved);
                return cacheObj.data as T;
            }
        } catch (e) {
            console.warn('[Resilience] Error loading from localStorage', e);
        }
        return null;
    }

    clearCache(key: string): void {
        try {
            localStorage.removeItem(`dm_cache_${key}`);
        } catch (e) {
            console.warn('[Resilience] Error clearing localStorage', e);
        }
    }

    private handleError(error: any, maxRetries: number) {
        const currentState = this.state$.value;
        const newErrors = currentState.consecutiveErrors + 1;

        let newStatus: ResilienceState['status'] = 'unstable';
        if (newErrors > maxRetries) {
            newStatus = 'down';
        }

        this.state$.next({
            status: newStatus,
            consecutiveErrors: newErrors,
            lastError: error
        });
    }

    private resetState() {
        if (this.state$.value.consecutiveErrors > 0) {
            this.state$.next({
                status: 'stable',
                consecutiveErrors: 0
            });
        }
    }
}
