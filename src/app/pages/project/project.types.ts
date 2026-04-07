export type ProjectStageCode = string;

export type ProjectStage = {
  id_code?: string;
  title: string;
  acronym?: string | null;
  order_index?: number;
  contract_value?: number | null;
  estimated_hours?: number | null;
  color_1?: string | null;
  color_2?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  status: 'planned' | 'active' | 'completed' | 'canceled';
  total_minutes?: number;
  total_amount?: number;
};

export type ProjectStatus = 'draft' | 'active' | 'paused' | 'canceled' | 'published';

export type Project = {
  id_code: string;
  name: string;
  description?: string | null;
  client_name?: string | null;
  client_party_id?: string | null;
  responsible_name?: string | null;
  logo_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  team_member_ids?: string[] | null;
  status?: ProjectStatus | null;
  current_stage?: ProjectStageCode | null;
  stages?: ProjectStage[] | null;
  contract_total?: number | null;
  burn_cost_total?: number | null;
  burn_minutes?: number | null;
  members?: ProjectMember[] | null;
  updated_at?: string | null;
};

export type ProjectInvoiceRow = {
  id_code: string;
  project_id_code: string;
  project_name: string;
  stage_code: ProjectStageCode;
  stage_name: string;
  month: string;
  expected_value: number;
  expected_date?: string | null;
  paid_value?: number | null;
  paid_date?: string | null;
};

export type ProjectSessionStatus = 'idle' | 'working' | 'break' | 'offline';

export type ProjectMember = {
  id_code: string;
  member_id_code?: string | null;
  name: string;
  email?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  cost_per_hour?: number | null;
  hourly_rate_override?: number | null;
  overhead_multiplier_override?: number | null;
  timezone_override?: string | null;
  status: 'active' | 'inactive' | ProjectSessionStatus;
  user?: {
    id: string;
    id_code: string;
    name: string;
    email: string;
    avatar_url?: string | null;
  };
  today_project_pct: number;
  today_office_pct: number;
  current_project_id_code?: string | null;
  current_project_name?: string | null;
};
