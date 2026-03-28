export type StatusConta = 'pending' | 'approved' | 'scheduled' | 'paid' | 'overdue' | 'canceled' | 'provisioned';

export interface Attachment {
  url: string;
  filename: string;
}

export interface ContaPagar {
  id_code: string;
  vendor_id: string;
  party_id?: string;
  recurrence_id?: string;
  nf?: string;
  description?: string;
  amount: number;
  currency?: string;
  issue_date?: Date | string;
  due_date: Date | string;
  paid_at?: Date | string;
  status: StatusConta;
  category?: string;
  category_id?: string;
  category_data?: { id: string; name: string;[key: string]: any };
  cost_center?: string;
  cost_center_id?: string;
  cost_center_data?: { id: string; name: string;[key: string]: any };
  created_by?: string;
  approved_by?: string;
  attachment_url?: string;
  attachments?: Attachment[];
  type?: 'PAYABLE' | 'RECEIVABLE' | 'TRANSFER' | 'ADJUSTMENT';
  tag?: string;
  tags?: { id: string; name: string; color: string }[];
  commission_origin_metadata?: {
    commission_id_code: string;
    source_transaction_id_code: string;
    original_amount: string | number;
  };
  commission?: any;
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
