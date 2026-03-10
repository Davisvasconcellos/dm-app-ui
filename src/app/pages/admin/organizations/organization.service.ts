import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../../shared/services/auth.service';
import { environment } from '../../../../environments/environment';

export interface CreateOrganizationDto {
  name: string;
  document: string;
  logo_url?: string;
  banner_url?: string;
}

export interface OrganizationResponse {
  success: boolean;
  data: {
    organization: {
      id: string;
      name: string;
      logo_url?: string;
      banner_url?: string;
    };
    store?: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

export interface OrganizationStore {
  id_code: string;
  name: string;
  slug: string;
  city?: string | null;
  address?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly API_BASE_URL = `${environment.apiUrl}/api/v1`;

  private http = inject(HttpClient);
  private authService = inject(AuthService);

  createOrganization(body: CreateOrganizationDto): Observable<OrganizationResponse> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' });
    return this.http.post<OrganizationResponse>(`${this.API_BASE_URL}/organizations`, body, { headers });
  }

  updateOrganization(id: string, data: Partial<CreateOrganizationDto>): Observable<OrganizationResponse> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' });
    return this.http.put<OrganizationResponse>(`${this.API_BASE_URL}/organizations/${id}`, data, { headers });
  }

  getOrganizationStores(orgId: string): Observable<OrganizationStore[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' });
    return this.http.get<{ success: boolean; data: OrganizationStore[] }>(`${this.API_BASE_URL}/organizations/${orgId}/stores`, { headers })
      .pipe(map(resp => resp?.data || []));
  }

  createOrganizationStore(orgIdCode: string, payload: any): Observable<any> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' });
    return this.http.post<any>(`${this.API_BASE_URL}/organizations/${orgIdCode}/stores`, payload, { headers });
  }
}
