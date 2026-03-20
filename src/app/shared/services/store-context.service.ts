import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LocalStorageService } from './local-storage.service';

export interface Store {
    id_code: string;
    id: number;
    name: string;
    logo_url: string | null;
    banner_url?: string | null;
    organization?: {
        id_code: string;
        name: string;
        logo_url?: string | null;
    };
}

@Injectable({
    providedIn: 'root'
})
export class StoreContextService {
    private localStorage = inject(LocalStorageService);
    private readonly STORE_KEY = 'selectedStore';

    private activeStoreSubject = new BehaviorSubject<Store | null>(null);
    public activeStore$ = this.activeStoreSubject.asObservable();

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage(): void {
        const saved = this.localStorage.getData<Store>(this.STORE_KEY);
        if (saved) {
            this.activeStoreSubject.next(saved);
        }
    }

    setActiveStore(store: Store | null): void {
        if (store) {
            this.localStorage.saveData(this.STORE_KEY, store);
        } else {
            this.localStorage.removeData(this.STORE_KEY);
        }
        this.activeStoreSubject.next(store);
    }

    getActiveStore(): Store | null {
        return this.activeStoreSubject.value;
    }

    clearContext(): void {
        this.setActiveStore(null);
    }
}
