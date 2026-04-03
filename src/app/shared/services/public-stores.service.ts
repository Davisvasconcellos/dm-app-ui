import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PublicStoreResolveResponse {
  success: true;
  data: {
    store: {
      id_code: string;
      name: string;
      slug: string;
      status: string;
      logo_url: string | null;
      banner_url: string | null;
    };
    organization: {
      id_code: string;
      name: string;
      status: string;
      logo_url: string | null;
      banner_url: string | null;
    };
  };
}

export interface PublicStoreCheckSlugResponse {
  success: true;
  data: {
    slug: string;
    available: boolean;
    reason?: string;
  };
}

@Injectable({ providedIn: 'root' })
export class PublicStoresService {
  private http = inject(HttpClient);
  private readonly API_BASE_URL = `${environment.apiUrl}/api/v1`;

  resolve(params: { subdomain?: string; slug?: string }): Observable<PublicStoreResolveResponse> {
    let httpParams = new HttpParams();
    if (params.subdomain) httpParams = httpParams.set('subdomain', params.subdomain);
    if (params.slug) httpParams = httpParams.set('slug', params.slug);
    return this.http.get<PublicStoreResolveResponse>(`${this.API_BASE_URL}/stores/resolve`, { params: httpParams });
  }

  checkSlug(slug: string): Observable<PublicStoreCheckSlugResponse> {
    const params = new HttpParams().set('slug', slug);
    return this.http.get<PublicStoreCheckSlugResponse>(`${this.API_BASE_URL}/stores/check-slug`, { params });
  }
}
