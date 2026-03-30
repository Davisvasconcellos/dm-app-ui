import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../shared/services/auth.service';
import { environment } from '../../environments/environment';

export interface FinancialAnalyticsDashboardV1 {
  scope: {
    store_ids: string[];
    start_date: string;
    end_date: string;
    date_mode: 'cash' | 'competence';
  };
  compare_to_previous?: {
    previous_scope: { start_date: string; end_date: string; date_mode: 'cash' | 'competence' };
    previous_kpis: any;
    delta: Partial<Record<string, number>>;
    delta_pct: Partial<Record<string, number | null>>;
  };
  kpis: {
    total_received: number;
    total_paid: number;
    balance: number;
    receivable_open: number;
    payable_open: number;
    overdue_total: number;
    overdue_receivable: number;
    overdue_payable: number;
  };
  timeseries: Array<{
    date: string;
    received?: number;
    paid?: number;
    received_actual?: number;
    paid_actual?: number;
    received_planned?: number;
    paid_planned?: number;
  }>;
  top_expense_categories: Array<{ category_id: string | null; category_name: string | null; total_paid: number }>;
  top_customers: Array<{ party_id: string | null; party_name: string | null; total_received: number }>;
  cost_centers?: Array<{
    cost_center_id: string | null;
    cost_center_name: string | null;
    totals: { received: number; paid: number; net: number };
    categories: Array<{
      category_id: string | null;
      category_name: string | null;
      totals: { received: number; paid: number; net: number };
    }>;
  }>;
  commissions: { pending_amount: number; pending_count: number; paid_amount: number; paid_count: number };
  commission_inconsistencies?: {
    sample_limit: number;
    counts: {
      missing_source_transaction: number;
      source_transaction_not_paid: number;
    };
    items: Array<{
      commission_id_code: string;
      store_id: string;
      paid_at: string | null;
      commission_amount: number;
      allow_advance_payment: boolean;
      seller: { id_code: string; name: string };
      source_transaction: { id_code: string; status: string; is_deleted: boolean; amount: string | number } | null;
      paid_transaction: { id_code: string; status: string; is_deleted: boolean; amount: string | number } | null;
      issues: string[];
    }>;
  };
  payment_methods?: {
    receivable: Array<{ method: string; total_amount: number; count: number }>;
    payable: Array<{ method: string; total_amount: number; count: number }>;
  };
  bank_accounts?: Array<{
    bank_account_id: string;
    bank_account_name: string;
    bank_name: string;
    totals: { received: number; paid: number; net: number };
    counts: { received: number; paid: number };
  }>;
  tags?: {
    coverage_pct: number;
    totals: { total_count: number; tagged_count: number; untagged_count: number; total_amount: number };
    top: Array<{ tag_id: string; tag_name: string; color: string | null; tx_count: number; total_amount: number }>;
    untagged: { tag_id: null; tag_name: string; color: string | null; tx_count: number; total_amount: number };
  };
  forecast_recurrences?: {
    totals: { receivable: number; payable: number; net: number };
    monthly: Array<{ month: string; receivable: number; payable: number; net: number }>;
  };
  upcoming: {
    receivable: Array<{
      id_code: string;
      due_date: string;
      description: string;
      amount: number;
      party_id: string | null;
      party_name: string | null;
      category_id: string | null;
      category_name: string | null;
    }>;
    payable: Array<{
      id_code: string;
      due_date: string;
      description: string;
      amount: number;
      party_id: string | null;
      party_name: string | null;
      category_id: string | null;
      category_name: string | null;
    }>;
  };
}

@Injectable({ providedIn: 'root' })
export class FinancialAnalyticsService {
  private readonly API_BASE_URL = `${environment.apiUrl}/api/v1`;
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  getDashboardV1(params: {
    start_date: string;
    end_date: string;
    date_mode: 'cash' | 'competence';
    store_ids_csv?: string;
    limit_top?: number;
  }): Observable<FinancialAnalyticsDashboardV1> {
    const token = this.auth.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});

    const query: any = {
      start_date: params.start_date,
      end_date: params.end_date,
      date_mode: params.date_mode,
    };
    if (params.store_ids_csv) query.store_ids = params.store_ids_csv;
    if (params.limit_top) query.limit_top = params.limit_top;

    return this.http.get<any>(
      `${this.API_BASE_URL}/financial/analytics/dashboard`,
      { headers, params: query }
    ).pipe(
      map((resp) => (resp?.data ? resp.data : resp) as FinancialAnalyticsDashboardV1)
    );
  }
}
