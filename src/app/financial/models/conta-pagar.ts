export type StatusConta = 'pending' | 'approved' | 'scheduled' | 'paid' | 'overdue' | 'canceled';

export interface ContaPagar {
  id_code: string;
  vendor_id: string; // Fornecedor
  nf?: string; // Nota Fiscal
  description?: string;
  amount: number;
  currency?: string; // 'BRL' default
  issue_date?: Date | string;
  due_date: Date | string;
  paid_at?: Date | string;
  status: StatusConta;
  category?: string;
  cost_center?: string;
  created_by?: string; // user id
  approved_by?: string; // user id
  attachment_url?: string;
  type?: 'PAYABLE' | 'RECEIVABLE' | 'TRANSFER' | 'ADJUSTMENT';
}

