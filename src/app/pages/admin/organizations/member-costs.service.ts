import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../shared/services/auth.service';

export interface MemberCost {
  id_code?: string;
  user_id: string;
  hourly_rate: number;
  overhead_multiplier?: number;
  start_date: string;
  end_date?: string | null;
  daily_auto_cutoff_time?: string | null;
  timezone?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class MemberCostsService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/api/v1/project/member-costs`;

  private getHeaders(storeId: string): HttpHeaders {
    let headers = new HttpHeaders({
      'Authorization': `Bearer ${this.auth.getAuthToken()}`
    });
    if (storeId) {
      headers = headers.set('x-store-id', storeId);
    }
    return headers;
  }

  getMemberCosts(storeId: string, userId?: string): Observable<any> {
    const time = new Date().getTime();
    const baseUrl = userId ? `${this.apiUrl}?user_id=${userId}` : this.apiUrl;
    const url = baseUrl.includes('?') ? `${baseUrl}&_t=${time}` : `${baseUrl}?_t=${time}`;
    
    return this.http.get(url, {
      headers: this.getHeaders(storeId)
    });
  }

  createMemberCost(storeId: string, data: MemberCost): Observable<any> {
    return this.http.post(this.apiUrl, data, {
      headers: this.getHeaders(storeId)
    });
  }

  updateMemberCost(storeId: string, costIdCode: string, data: Partial<MemberCost>): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${costIdCode}`, data, {
      headers: this.getHeaders(storeId)
    });
  }
}
