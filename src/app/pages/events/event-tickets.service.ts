import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TicketStatus = 'reserved' | 'checked_in' | 'canceled' | 'expired';

export interface MyTicketEvent {
  id: string;
  name: string;
  slug?: string;
  banner_url?: string | null;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  public_url?: string | null;
  place?: string | null;
  status?: string;
}

export interface MyTicketType {
  id: string;
  name: string;
  price_amount?: string;
  currency?: string;
}

export interface MyTicket {
  id: string;
  id_code: string;
  qr_token?: string | null;
  status: TicketStatus;
  reserved_at?: string | null;
  expires_at?: string | null;
  checked_in_at?: string | null;
  price_amount?: string | null;
  currency?: string | null;
  event: MyTicketEvent;
  ticket_type?: MyTicketType;
}

export interface PagedMeta {
  total?: number;
  page?: number;
  limit?: number;
  pages?: number;
}

export interface MyTicketsResponse {
  success: boolean;
  data: MyTicket[];
  meta?: PagedMeta;
}

export interface ReserveTicketResponse {
  success: boolean;
  data: {
    ticket_id: string;
    qr_token?: string | null;
    status: TicketStatus;
    expires_at?: string | null;
    already_reserved?: boolean;
    ticket_type?: {
      id: string;
      name: string;
      price_amount?: string;
      currency?: string;
    };
  };
}

export interface SelfCheckinSuccessResponse {
  success: boolean;
  data?: {
    already_checked_in?: boolean;
    ticket_id?: string;
    event_id?: string;
  };
  message?: string;
}

export interface SelfCheckinNeedTicketError {
  error: string;
  code: 'need_ticket';
  message?: string;
  reserve_endpoint?: string;
}

@Injectable({ providedIn: 'root' })
export class EventTicketsService {
  private http = inject(HttpClient);
  private readonly API_BASE_URL = `${environment.apiUrl}`;

  reserveTicket(eventIdOrCode: string, payload?: { ticket_type_id?: string }): Observable<ReserveTicketResponse> {
    const url = `${this.API_BASE_URL}/api/public/v1/events/${encodeURIComponent(eventIdOrCode)}/tickets/reserve`;
    return this.http.post<ReserveTicketResponse>(url, { ticket_type_id: payload?.ticket_type_id ?? null });
  }

  getMyTickets(params?: { page?: number; limit?: number; status?: TicketStatus }): Observable<MyTicketsResponse> {
    const url = `${this.API_BASE_URL}/api/v1/users/me/tickets`;
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params?.status) httpParams = httpParams.set('status', String(params.status));
    return this.http.get<MyTicketsResponse>(url, { params: httpParams });
  }

  selfCheckin(eventIdOrCode: string): Observable<SelfCheckinSuccessResponse> {
    const url = `${this.API_BASE_URL}/api/public/v1/events/${encodeURIComponent(eventIdOrCode)}/self-checkin`;
    return this.http.post<SelfCheckinSuccessResponse>(url, {});
  }
}
