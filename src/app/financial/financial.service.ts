import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from '../shared/services/auth.service';
import { ContaPagar } from './models/conta-pagar';
import { ContaReceber } from './models/conta-receber';
import { Fornecedor } from './models/fornecedor';
import { Cliente } from './models/cliente';
import { Pagamento } from './models/pagamento';
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

  getCategorias(): Observable<{ id: string; name: string }[]> {
    return of([
      { id: 'cat-vendas', name: 'Vendas' },
      { id: 'cat-servicos', name: 'Serviços' },
      { id: 'cat-aluguel', name: 'Aluguel' },
      { id: 'cat-fornecedores', name: 'Fornecedores' },
      { id: 'cat-marketing', name: 'Marketing' },
    ]);
  }

  getCentrosDeCusto(): Observable<{ id: string; name: string }[]> {
    return of([
      { id: 'cc-escritorio', name: 'Escritório' },
      { id: 'cc-manutencao', name: 'Manutenção' },
      { id: 'cc-operacional', name: 'Operacional' },
    ]);
  }

  getContasPagar(storeId?: string): Observable<ContaPagar[]> {
    if (!storeId) {
      // Fallback para mock se não tiver storeId (comportamento legado para evitar quebra imediata, ou retornar vazio)
      // Por enquanto, retornando vazio para forçar o uso do storeId
      return of([]);
    }

    const headers = { 'Authorization': `Bearer ${this.authService.getAuthToken()}` };
    return this.http.get<any>(`${this.API_BASE_URL}/financial/transactions`, { 
      headers,
      params: { store_id: storeId }
    }).pipe(
      map(response => {
        // Tenta extrair de response.data.transactions ou response.data ou retorna array vazio
        return (response.data?.transactions || response.data || []) as ContaPagar[];
      })
    );
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
