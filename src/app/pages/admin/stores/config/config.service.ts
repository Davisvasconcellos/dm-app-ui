import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../../../../shared/services/auth.service';
import { environment } from '../../../../../environments/environment';

export interface StoreDetails {
  name: string;
  email: string;
  cnpj: string;
  slug?: string;
  logo_url: string;
  instagram_handle: string;
  facebook_handle: string;
  capacity: number;
  type?: string;
  legal_name?: string;
  phone?: string;
  zip_code?: string;
  address_street?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_number?: string;
  address_complement?: string;
  banner_url: string;
  website: string;
  latitude: number;
  longitude: number;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly API_BASE_URL = `${environment.apiUrl}/api/v1`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  getStoreById(storeId: string): Observable<StoreDetails> {
    const token = this.authService.getAuthToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get<{ data: StoreDetails }>(`${this.API_BASE_URL}/stores/${storeId}`, { headers }).pipe(
      map(response => response.data),
      catchError(error => {
        return throwError(() => new Error('Não foi possível carregar os dados da loja.'));
      })
    );
  }

  updateStore(storeId: string, storeData: Partial<StoreDetails>): Observable<any> {
    const token = this.authService.getAuthToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.put(`${this.API_BASE_URL}/stores/${storeId}`, storeData, { headers }).pipe(
      catchError(error => {
        return throwError(() => new Error('Não foi possível atualizar os dados da loja.'));
      })
    );
  }
}
