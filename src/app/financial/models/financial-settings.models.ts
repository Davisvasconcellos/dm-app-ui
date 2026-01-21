export interface FinancialCategory {
  id?: string;
  id_code?: string;
  store_id: string;
  name: string;
  type: 'payable' | 'receivable';
  created_at?: string;
  updated_at?: string;
}

export interface CostCenter {
  id?: string;
  id_code?: string;
  store_id: string;
  name: string;
  code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FinancialTag {
  id?: string;
  id_code?: string;
  store_id: string;
  name: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
}
