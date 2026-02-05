import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MasterService {
  private readonly API_BASE_URL = `${environment.apiUrl}/api/v1`;

  constructor(private http: HttpClient) {}

  getModules(): Observable<any> {
    return this.http.get<any>(`${this.API_BASE_URL}/sys-modules`);
  }

  getUsers(): Observable<any> {
    return this.http.get<any>(`${this.API_BASE_URL}/users`);
  }

  updateUserModules(userIdOrCode: string | number, moduleIds: string[]): Observable<any> {
    return this.http.put(`${this.API_BASE_URL}/users/${userIdOrCode}`, { module_ids: moduleIds });
  }
}
