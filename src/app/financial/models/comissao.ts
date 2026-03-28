export interface Commission {
  id_code: string;
  store_id: string;
  source_transaction_id_code: string;
  commission_seller_id: string;
  commission_type: 'percentage' | 'fixed';
  commission_rate: number | string;
  commission_amount: number | string;
  status: 'pending' | 'paid' | 'canceled';
  paid_transaction_id_code?: string | null;
  paid_bank_account_id?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
  commissionSeller?: {
    id_code: string;
    name: string;
    trade_name?: string;
    document?: string;
    email?: string;
  };
  sourceTransaction?: {
    id_code: string;
    type: string;
    description: string;
    amount: number | string;
    due_date: string;
    status: string;
    party_id: string;
    category_id: string;
    cost_center_id: string;
    nf: string;
  };
}

// Keep for legacy if needed or export both
export interface Comissao extends Commission { }
