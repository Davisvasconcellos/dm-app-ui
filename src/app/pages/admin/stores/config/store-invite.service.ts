import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface StoreInvite {
    id_code: string;
    invited_email: string;
    role: string;
    permissions: string[];
    status: 'pending' | 'accepted' | 'revoked' | 'expired';
    expires_at: string;
    accepted_at: string | null;
    revoked_at: string | null;
    created_at: string;
    user_exists?: boolean; // De resolve (público)
    invited_user_exists?: boolean; // De list (admin)
    member_id_code?: string; // Deprecated
    store_member_id_code?: string; // ID do vínculo real
    store_member_status?: string;
    user_id_code?: string; // UUID do usuário (tabela users)
    store?: {
        id_code: string;
        name: string;
        slug: string;
    };
}

export interface CreateInvitePayload {
    email: string;
    role: string;
    permissions: string[];
    expires_in_days?: number;
}

export interface CreateInviteResponse {
    success: boolean;
    data: StoreInvite;
    invite_link: string;
}

@Injectable({
    providedIn: 'root'
})
export class StoreInviteService {
    private http = inject(HttpClient);
    private readonly API_BASE_URL = `${environment.apiUrl}/api/v1/store-invites`;
    private readonly PUBLIC_API_BASE_URL = `${environment.apiUrl}/api/public/v1/store-invites`;

    createInvite(storeId: string, payload: CreateInvitePayload): Observable<CreateInviteResponse> {
        const params = new HttpParams().set('store_id', storeId);
        return this.http.post<CreateInviteResponse>(this.API_BASE_URL, payload, { params });
    }

    listInvites(storeId: string, status?: string): Observable<{ success: boolean, data: StoreInvite[] }> {
        const time = new Date().getTime();
        let params = new HttpParams()
            .set('store_id', storeId)
            .set('_t', time.toString());
        if (status) {
            params = params.set('status', status);
        }
        return this.http.get<{ success: boolean, data: StoreInvite[] }>(this.API_BASE_URL, { params });
    }

    getMyInvites(status: string = 'pending'): Observable<{ success: boolean, data: StoreInvite[] }> {
        const params = new HttpParams().set('status', status);
        return this.http.get<{ success: boolean, data: StoreInvite[] }>(`${this.API_BASE_URL}/my`, { params });
    }

    regenerateInvite(idCode: string, storeId: string): Observable<CreateInviteResponse> {
        const params = new HttpParams().set('store_id', storeId);
        return this.http.post<CreateInviteResponse>(`${this.API_BASE_URL}/${idCode}/regenerate`, {}, { params });
    }

    revokeInvite(idCode: string, storeId: string): Observable<{ success: boolean, data: any }> {
        const params = new HttpParams().set('store_id', storeId);
        return this.http.post<{ success: boolean, data: any }>(`${this.API_BASE_URL}/${idCode}/revoke`, {}, { params });
    }

    revokeMyInvite(idCode: string): Observable<{ success: boolean, data: any }> {
        return this.http.post<{ success: boolean, data: any }>(`${this.API_BASE_URL}/${idCode}/revoke`, {});
    }

    resolveInvite(token: string): Observable<{ success: boolean, data: { invite: StoreInvite, store: { id_code: string, name: string } } }> {
        return this.http.post<{ success: boolean, data: { invite: StoreInvite, store: { id_code: string, name: string } } }>(`${this.PUBLIC_API_BASE_URL}/resolve`, { token });
    }

    acceptInvite(token: string): Observable<{ success: boolean, message: string }> {
        return this.http.post<{ success: boolean, message: string }>(`${this.API_BASE_URL}/accept`, { token });
    }

    acceptInviteById(idCode: string): Observable<{ success: boolean, message: string }> {
        return this.http.post<{ success: boolean, message: string }>(`${this.API_BASE_URL}/${idCode}/accept`, {});
    }
}
