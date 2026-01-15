import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
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
  constructor() {}

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

  getContasPagar(): Observable<ContaPagar[]> {
    return of([
      {
        id_code: 'cp-001',
        vendor_id: 'forn-001',
        nf: 'NF-1234',
        description: 'Compra de papel A4',
        amount: 350.5,
        currency: 'BRL',
        issue_date: new Date(),
        due_date: new Date(),
        status: 'pending',
        category: 'Materiais',
        cost_center: 'Escritório',
        created_by: 'user-001',
        type: 'PAYABLE',
        attachment_url: 'https://via.placeholder.com/150/0000FF/FFFFFF?Text=Nota+Fiscal.png'
      },
      {
        id_code: 'cp-002',
        vendor_id: 'forn-002',
        nf: 'NF-5678',
        description: 'Produtos de limpeza',
        amount: 580.0,
        currency: 'BRL',
        issue_date: new Date(),
        due_date: new Date(),
        status: 'approved',
        category: 'Serviços',
        cost_center: 'Manutenção',
        created_by: 'user-002',
        type: 'PAYABLE',
        attachment_url: 'https://via.placeholder.com/150/FF0000/FFFFFF?Text=Recibo.jpg'
      },
      {
        id_code: 'cp-003',
        vendor_id: 'forn-001',
        nf: 'NF-9012',
        description: 'Compra de canetas',
        amount: 120.0,
        currency: 'BRL',
        issue_date: new Date('2024-10-01'),
        due_date: new Date('2024-10-15'),
        status: 'paid',
        category: 'Materiais',
        cost_center: 'Escritório',
        created_by: 'user-001',
        paid_at: new Date('2024-10-14'),
        type: 'PAYABLE',
        attachment_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        id_code: 'cp-004',
        vendor_id: 'cli-001',
        nf: 'NFS-e-202',
        description: 'Venda de pacote anual',
        amount: 2400.0,
        currency: 'BRL',
        issue_date: new Date('2024-09-01'),
        due_date: new Date('2024-09-30'),
        status: 'overdue',
        category: 'Vendas',
        cost_center: 'Operacional',
        created_by: 'user-002',
        type: 'RECEIVABLE',
        attachment_url: 'https://via.placeholder.com/150/00FF00/FFFFFF?Text=Contrato.png'
      },
      {
        id_code: 'cp-005',
        vendor_id: 'acc-bb',
        nf: 'TRF-5678',
        description: 'Transferência entre contas',
        amount: 5000.0,
        currency: 'BRL',
        issue_date: new Date('2024-10-05'),
        due_date: new Date('2024-10-05'),
        status: 'paid',
        category: 'Transferência',
        cost_center: 'Operacional',
        created_by: 'user-003',
        paid_at: new Date('2024-10-05'),
        type: 'TRANSFER',
        attachment_url: 'https://via.placeholder.com/150/FFFF00/000000?Text=Comprovante.jpg'
      }
    ]);
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
