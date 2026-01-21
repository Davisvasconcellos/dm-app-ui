import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from '../shared/services/auth.service';
import { ContaPagar, TransactionsListResponse } from './models/conta-pagar';
import { ContaReceber } from './models/conta-receber';
import { Fornecedor } from './models/fornecedor';
import { Cliente } from './models/cliente';
import { Pagamento } from './models/pagamento';
import { Party } from './models/party';
import { FinancialCategory, CostCenter, FinancialTag } from './models/financial-settings.models';
// import { DespesaMenor } from './models/despesa-menor';
// import { Comissao } from './models/comissao';
// import { SaldoBancarioDiario } from './models/saldo-bancario';

@Injectable({ providedIn: 'root' })
export class FinancialService {
  private readonly API_BASE_URL = `${environment.apiUrl}/api/v1`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  createTransaction(transactionData: any): Observable<any> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.post(`${this.API_BASE_URL}/financial/transactions`, transactionData, { headers });
  }

  updateTransaction(id: string, transactionData: any): Observable<any> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.patch(`${this.API_BASE_URL}/financial/transactions/${id}`, transactionData, { headers });
  }

  // Mocked data
  getFornecedores(): Observable<Fornecedor[]> {
    return of([
      { id_code: 'forn-001', name: 'Papelaria Alpha', cnpj: '12.345.678/0001-90', email: 'contato@alpha.com', phone: '(11) 99999-0001' },
      { id_code: 'forn-002', name: 'Limpeza Beta', cnpj: '98.765.432/0001-10', email: 'vendas@beta.com', phone: '(11) 99999-0002' },
    ]);
  }

  getClientes(): Observable<Cliente[]> {
    return of([
      { id_code: 'cli-001', name: 'Cliente Um', cpf_cnpj: '123.456.789-00', email: 'um@client.com', phone: '(11) 11111-1111' },
      { id_code: 'cli-002', name: 'Cliente Dois', cpf_cnpj: '987.654.321-00', email: 'dois@client.com', phone: '(11) 22222-2222' },
    ]);
  }

  getCategorias(storeId?: string, type?: 'payable' | 'receivable'): Observable<FinancialCategory[]> {
    if (!storeId) {
      // Return mock for compatibility if no storeId provided (or change to return empty)
      return of([
        { id: '1', id_code: 'cat-vendas', name: 'Vendas', type: 'receivable', store_id: 'mock' },
        { id: '2', id_code: 'cat-servicos', name: 'Serviços', type: 'receivable', store_id: 'mock' },
        { id: '3', id_code: 'cat-aluguel', name: 'Aluguel', type: 'payable', store_id: 'mock' },
        { id: '4', id_code: 'cat-fornecedores', name: 'Fornecedores', type: 'payable', store_id: 'mock' },
        { id: '5', id_code: 'cat-marketing', name: 'Marketing', type: 'payable', store_id: 'mock' },
      ]);
    }
    
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    const params: any = { store_id: storeId };
    if (type) params.type = type;

    return this.http.get<any>(`${this.API_BASE_URL}/financial/categories`, { headers, params })
      .pipe(map(response => response.data || response || []));
  }

  createCategory(data: Partial<FinancialCategory>): Observable<FinancialCategory> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.post<any>(`${this.API_BASE_URL}/financial/categories`, data, { headers })
      .pipe(map(response => response.data || response));
  }

  updateCategory(id: string, data: Partial<FinancialCategory>): Observable<FinancialCategory> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.put<any>(`${this.API_BASE_URL}/financial/categories/${id}`, data, { headers })
      .pipe(map(response => response.data || response));
  }

  deleteCategory(id: string): Observable<void> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.delete<any>(`${this.API_BASE_URL}/financial/categories/${id}`, { headers });
  }

  getCentrosDeCusto(storeId?: string): Observable<CostCenter[]> {
    if (!storeId) {
      return of([
        { id: 'cc-escritorio', name: 'Escritório', store_id: 'mock' },
        { id: 'cc-manutencao', name: 'Manutenção', store_id: 'mock' },
        { id: 'cc-operacional', name: 'Operacional', store_id: 'mock' },
      ]);
    }

    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    const params: any = { store_id: storeId };

    return this.http.get<any>(`${this.API_BASE_URL}/financial/cost-centers`, { headers, params })
      .pipe(map(response => response.data || response || []));
  }

  createCostCenter(data: Partial<CostCenter>): Observable<CostCenter> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.post<any>(`${this.API_BASE_URL}/financial/cost-centers`, data, { headers })
      .pipe(map(response => response.data || response));
  }

  updateCostCenter(id: string, data: Partial<CostCenter>): Observable<CostCenter> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.put<any>(`${this.API_BASE_URL}/financial/cost-centers/${id}`, data, { headers })
      .pipe(map(response => response.data || response));
  }

  deleteCostCenter(id: string): Observable<void> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.delete<any>(`${this.API_BASE_URL}/financial/cost-centers/${id}`, { headers });
  }

  getTags(storeId: string): Observable<FinancialTag[]> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    const params: any = { store_id: storeId };

    return this.http.get<any>(`${this.API_BASE_URL}/financial/tags`, { headers, params })
      .pipe(map(response => response.data || response || []));
  }

  createTag(data: Partial<FinancialTag>): Observable<FinancialTag> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.post<any>(`${this.API_BASE_URL}/financial/tags`, data, { headers })
      .pipe(map(response => response.data || response));
  }

  updateTag(idCode: string, data: Partial<FinancialTag>): Observable<FinancialTag> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.put<any>(`${this.API_BASE_URL}/financial/tags/${idCode}`, data, { headers })
      .pipe(map(response => response.data || response));
  }

  deleteTag(idCode: string): Observable<void> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.delete<any>(`${this.API_BASE_URL}/financial/tags/${idCode}`, { headers });
  }

  getContasPagar(storeId?: string, page?: number, limit?: number, kpiLinked?: boolean): Observable<TransactionsListResponse> {
    if (!storeId) {
      return of({
        transactions: [],
        summary: undefined,
        meta: undefined
      });
    }

    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    const params: any = { store_id: storeId };
    if (page != null) {
      params.page = page;
    }
    if (limit != null) {
      params.limit = limit;
    }
    if (kpiLinked !== undefined) {
      params.kpi_linked = kpiLinked;
    }

    return this.http.get<any>(`${this.API_BASE_URL}/financial/transactions`, { 
      headers,
      params
    }).pipe(
      map(response => {
        const data = response?.data || {};
        const transactions = (data.transactions || data || []) as ContaPagar[];
        const summary = data.summary;
        const meta = response.meta;

        return {
          transactions,
          summary,
          meta
        } as TransactionsListResponse;
      })
    );
  }

  // Bank Accounts Methods
  getBankAccounts(storeId: string): Observable<any[]> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.get<any>(`${this.API_BASE_URL}/financial/bank-accounts`, { 
      headers,
      params: { store_id: storeId }
    }).pipe(
      map(response => response.data || response || [])
    );
  }

  // Parties Methods
  getParties(storeId: string, type?: 'customer' | 'supplier' | 'employee' | 'salesperson'): Observable<Party[]> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    const params: any = { store_id: storeId };
    if (type) {
      params.type = type;
    }
    
    return this.http.get<any>(`${this.API_BASE_URL}/financial/parties`, { 
      headers,
      params
    }).pipe(
      map(response => response.data || response || [])
    );
  }

  createParty(data: Partial<Party>): Observable<Party> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.post<any>(`${this.API_BASE_URL}/financial/parties`, data, { headers })
      .pipe(map(response => response.data || response));
  }

  updateParty(idCode: string, data: Partial<Party>): Observable<Party> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.put<any>(`${this.API_BASE_URL}/financial/parties/${idCode}`, data, { headers })
      .pipe(map(response => response.data || response));
  }

  deleteParty(idCode: string): Observable<void> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.delete<any>(`${this.API_BASE_URL}/financial/parties/${idCode}`, { headers });
  }

  getBankAccountById(idCode: string): Observable<any> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.get<any>(`${this.API_BASE_URL}/financial/bank-accounts/${idCode}`, { headers })
      .pipe(map(response => response.data || response));
  }

  createBankAccount(data: any): Observable<any> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.post<any>(`${this.API_BASE_URL}/financial/bank-accounts`, data, { headers });
  }

  updateBankAccount(idCode: string, data: any): Observable<any> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.put<any>(`${this.API_BASE_URL}/financial/bank-accounts/${idCode}`, data, { headers });
  }

  deleteBankAccount(idCode: string): Observable<any> {
    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.delete<any>(`${this.API_BASE_URL}/financial/bank-accounts/${idCode}`, { headers });
  }

  getContasReceber(): Observable<ContaReceber[]> {
    return of([
      {
        id_code: 'cr-001',
        client_id: 'cli-001',
        vendor_id: 'user-005',
        nf: 'NFS-e-101',
        description: 'Venda de pacote mensal',
        sale_total: 1200,
        parcelas: [
          { number: 1, total: 3, value: 400, due_date: new Date() },
          { number: 2, total: 3, value: 400, due_date: new Date() },
          { number: 3, total: 3, value: 400, due_date: new Date() },
        ],
        commission_rate: 5,
        due_date: new Date(),
        status: 'pending',
      },
    ]);
  }

  getPagamentos(): Observable<Pagamento[]> {
    return of([
      { id: 'pg-001', related_account_id_code: 'cp-001', type: 'pagar', amount: 200, partial: true, method: 'pix', date: new Date(), notes: 'Parcial' },
      { id: 'pg-002', related_account_id_code: 'cr-001', type: 'receber', amount: 400, method: 'bank_transfer', date: new Date(), notes: 'Parcela 1/3' },
    ]);
  }

  // getDespesasMenores(): Observable<DespesaMenor[]> {
  //   return of([
  //     { id: 'dm-001', type: 'vale', description: 'Vale transporte', amount: 50, date: new Date(), employee_id: 'user-010' },
  //     { id: 'dm-002', type: 'caixa', description: 'Compra emergencial', amount: 120, date: new Date(), employee_id: 'user-003' },
  //   ]);
  // }

  // getComissoes(): Observable<Comissao[]> {
  //   return of([
  //     { id: 'cm-001', vendor_id: 'user-005', value: 60, payment_date: undefined, status_paid: false, period: { start: new Date(), end: new Date() } },
  //   ]);
  // }

  // getSaldosBancarios(): Observable<SaldoBancarioDiario[]> {
  //   return of([
  //     { id: 'sb-001', date: new Date(), bank: 'Banco A', balance: 10500, notes: 'Depósito de cliente' },
  //     { id: 'sb-002', date: new Date(), bank: 'Banco B', balance: 8200, notes: 'Pagamento de fornecedor' },
  //   ]);
  // }
}
