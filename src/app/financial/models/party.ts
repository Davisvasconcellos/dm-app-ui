export interface Party {
  id: number;
  id_code: string;
  store_id: string;
  name: string;
  trade_name?: string;
  document?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  is_customer: boolean;
  is_supplier: boolean;
  is_employee: boolean;
  is_salesperson: boolean;
  zip_code?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  notes?: string;
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
  updated_at: string;
}
