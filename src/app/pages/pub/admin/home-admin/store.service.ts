import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators'; 
import { AuthService } from '../../../../shared/services/auth.service';
import { environment } from '../../../../../environments/environment';

// Interfaces para tipagem forte
export interface Store {
  id_code: string;
  id: number;
  name: string;
  logo_url: string | null;
}

export interface StoresResponse {
  success: boolean;
  data: {
    stores: Store[];
  };
}

export interface CreateStoreDto {
  name: string;
  email: string;
  cnpj: string;
  logo_url?: string;
  instagram_handle?: string;
  facebook_handle?: string;
  capacity?: number;
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
  banner_url?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
}

export interface StoreScheduleEntry {
  day_of_week: number;
  is_open: boolean;
  opening_time: string;
  closing_time: string;
}

@Injectable({
  providedIn: 'root'
})
export class StoreService {
  private readonly API_BASE_URL = `${environment.apiUrl}/api/v1`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  getStores(): Observable<Store[]> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.get<StoresResponse>(`${this.API_BASE_URL}/stores`, { headers })
      .pipe(map(response => response.data.stores));
  }

  getStoreById(idCode: string): Observable<any> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.get<{ data: any }>(`${this.API_BASE_URL}/stores/${idCode}`, { headers })
      .pipe(map(response => response.data));
  }

  createStore(storeData: CreateStoreDto): Observable<any> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.post(`${this.API_BASE_URL}/stores`, storeData, { headers });
  }

  updateStore(idCode: string, storeData: Partial<CreateStoreDto>): Observable<any> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.put(`${this.API_BASE_URL}/stores/${idCode}`, storeData, { headers });
  }

  deleteStore(idCode: string): Observable<any> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.delete(`${this.API_BASE_URL}/stores/${idCode}`, { headers });
  }

  updateStoreSchedule(idCode: string, schedule: StoreScheduleEntry[]): Observable<any> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.put(`${this.API_BASE_URL}/stores/${idCode}/schedule`, schedule, { headers });
  }
}
