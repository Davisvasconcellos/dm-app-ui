export type StatusConta = 'pending' | 'approved' | 'scheduled' | 'paid' | 'overdue' | 'canceled';

export interface Attachment {
  url: string;
  filename: string;
}

export interface ContaPagar {
  id_code: string;
  vendor_id: string;
  nf?: string;
  description?: string;
  amount: number;
  currency?: string;
  issue_date?: Date | string;
  due_date: Date | string;
  paid_at?: Date | string;
  status: StatusConta;
  category?: string;
  cost_center?: string;
  created_by?: string;
  approved_by?: string;
  attachment_url?: string;
  attachments?: Attachment[];
  type?: 'PAYABLE' | 'RECEIVABLE' | 'TRANSFER' | 'ADJUSTMENT';
}

export interface TransactionsSummary {
  payable: {
    pending: number;
    paid: number;
  };
  receivable: {
    pending: number;
    paid: number;
  };
  overdue: number;
  total_paid: number;
}

export interface TransactionsMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface TransactionsListResponse {
  transactions: ContaPagar[];
  summary?: TransactionsSummary;
  meta?: TransactionsMeta;
}
