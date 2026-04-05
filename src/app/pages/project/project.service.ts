import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { Project, ProjectInvoiceRow, ProjectMember, ProjectStage, ProjectStatus } from './project.types';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../shared/services/auth.service';
import { StoreContextService } from '../../shared/services/store-context.service';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private storeContext = inject(StoreContextService);
  private readonly API_BASE_URL = `${environment.apiUrl}/api/v1/project`;

  private readonly projectsSubject = new BehaviorSubject<Project[]>(this.seedProjects());
  private readonly membersSubject = new BehaviorSubject<ProjectMember[]>(this.seedMembers());
  private readonly invoicesSubject = new BehaviorSubject<ProjectInvoiceRow[]>(this.seedInvoices());
  private readonly memberCostHistorySubject = new BehaviorSubject<Record<string, { cost_per_hour: number | null; effective_from: string }[]>>({});

  listProjects(): Observable<Project[]> {
    return this.projectsSubject.asObservable();
  }

  setProjectsFromExternal(external: Project[]): void {
    const items = Array.isArray(external) ? external : [];
    const normalized = items.map((p) => this.normalizeProject(p));
    this.projectsSubject.next(normalized);
  }

  refreshProjects(storeIdCode?: string | null): Observable<Project[]> {
    const storeId = (storeIdCode || this.storeContext.getActiveStore()?.id_code || '').trim();
    if (!storeId) return of(this.projectsSubject.value);

    const headers = this.getHeaders(storeId);
    const params = new HttpParams().set('store_id', storeId);
    return this.http.get<any>(`${this.API_BASE_URL}/projects`, { headers, params }).pipe(
      map((resp) => this.extractProjects(resp)),
      tap((items) => this.projectsSubject.next(items)),
      catchError(() => of(this.projectsSubject.value))
    );
  }

  getMyScope(): Observable<{ store: any; projects: any[] }[]> {
    const headers = this.getHeaders();
    return this.http.get<any>(`${this.API_BASE_URL}/me/scope`, { headers }).pipe(
      map((resp) => {
        const root = this.unwrapResponse(resp);
        const raw = resp?.data ?? root?.data ?? root ?? [];
        return Array.isArray(raw) ? (raw as any[]) : [];
      }),
      catchError(() => of([]))
    );
  }

  getMeToday(storeIdCode: string): Observable<any | null> {
    const storeId = String(storeIdCode || '').trim();
    if (!storeId) return of(null);
    const headers = this.getHeaders(storeId);
    const params = new HttpParams().set('store_id', storeId);
    return this.http.get<any>(`${this.API_BASE_URL}/me/today`, { headers, params }).pipe(
      map((resp) => this.unwrapResponse(resp)),
      catchError(() => of(null))
    );
  }

  checkIn(storeIdCode: string, payload?: { source?: string; device_id?: string }): Observable<any | null> {
    const storeId = String(storeIdCode || '').trim();
    if (!storeId) return of(null);
    const headers = this.getHeaders(storeId);
    return this.http.post<any>(`${this.API_BASE_URL}/sessions/check-in`, payload || {}, { headers }).pipe(
      map((resp) => this.unwrapResponse(resp)),
      catchError(() => of(null))
    );
  }

  startGlobalTimeEntry(storeIdCode: string, description: string = 'Expediente'): Observable<any | null> {
    const storeId = String(storeIdCode || '').trim();
    if (!storeId) return of(null);
    const headers = this.getHeaders(storeId);
    return this.http.post<any>(`${this.API_BASE_URL}/time-entries/start`, { description }, { headers }).pipe(
      map((resp) => this.unwrapResponse(resp)),
      catchError(() => of(null))
    );
  }

  heartbeatTimeEntry(storeIdCode: string, timeEntryId: string): Observable<any | null> {
    const storeId = String(storeIdCode || '').trim();
    const id = String(timeEntryId || '').trim();
    if (!storeId || !id) return of(null);
    const headers = this.getHeaders(storeId);
    return this.http.post<any>(`${this.API_BASE_URL}/time-entries/${encodeURIComponent(id)}/heartbeat`, {}, { headers }).pipe(
      map((resp) => this.unwrapResponse(resp)),
      catchError(() => of(null))
    );
  }

  stopTimeEntry(storeIdCode: string, timeEntryId: string): Observable<any | null> {
    const storeId = String(storeIdCode || '').trim();
    const id = String(timeEntryId || '').trim();
    if (!storeId || !id) return of(null);
    const headers = this.getHeaders(storeId);
    return this.http.post<any>(`${this.API_BASE_URL}/time-entries/${encodeURIComponent(id)}/stop`, {}, { headers }).pipe(
      map((resp) => this.unwrapResponse(resp)),
      catchError(() => of(null))
    );
  }

  getProjectById(idCode: string): Observable<Project | null> {
    const clean = String(idCode || '').trim();
    if (!clean) return of(null);
    const storeId = (this.storeContext.getActiveStore()?.id_code || '').trim();
    const headers = this.getHeaders(storeId || undefined);
    const params = storeId ? new HttpParams().set('store_id', storeId) : undefined;
    return this.http.get<any>(`${this.API_BASE_URL}/projects/${encodeURIComponent(clean)}`, { headers, params }).pipe(
      map((resp) => this.extractProject(resp)),
      catchError(() => of(null))
    );
  }

  createProject(payload: {
    store_id?: string | null;
    name: string;
    description?: string | null;
    client_party_id?: string | null;
    responsible_name?: string | null;
    logo_url?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    status?: ProjectStatus | null;
  }): Observable<Project> {
    const now = new Date();
    const storeId = (payload.store_id || this.storeContext.getActiveStore()?.id_code || '').trim();
    const headers = this.getHeaders(storeId || undefined);
    const params = storeId ? new HttpParams().set('store_id', storeId) : undefined;

    return this.http.post<any>(`${this.API_BASE_URL}/projects`, payload, { headers, params }).pipe(
      map((resp) => this.extractProject(resp) as Project),
      tap(() => {
        if (storeId) this.refreshProjects(storeId).subscribe();
      }),
      catchError(() => {
        const id = `proj-${now.getTime()}`;
        const stages = this.seedStages().map((s) => ({ ...s }));
        const next: Project = {
          id_code: id,
          name: (payload.name || '').trim() || 'Novo Projeto',
          description: payload.description ?? null,
          client_party_id: payload.client_party_id ?? null,
          responsible_name: payload.responsible_name ?? null,
          client_name: null,
          logo_url: payload.logo_url ?? null,
          start_date: payload.start_date ?? now.toISOString().slice(0, 10),
          end_date: payload.end_date ?? null,
          team_member_ids: null,
          status: payload.status ?? 'draft',
          current_stage: 'EP',
          stages,
          contract_total: null,
          burn_cost_total: null,
          updated_at: now.toISOString(),
        };
        this.projectsSubject.next([next, ...this.projectsSubject.value]);
        return of(next);
      })
    );
  }

  createProjectStage(projectIdCode: string, payload: any): Observable<any> {
    const id = String(projectIdCode || '').trim();
    if (!id) return of(null);
    const storeId = (this.storeContext.getActiveStore()?.id_code || '').trim();
    const headers = this.getHeaders(storeId || undefined);
    const params = storeId ? new HttpParams().set('store_id', storeId) : undefined;
    return this.http.post<any>(`${this.API_BASE_URL}/projects/${encodeURIComponent(id)}/stages`, payload, { headers, params });
  }

  addProjectMember(projectIdCode: string, payload: { user_id: string; role: string }): Observable<any> {
    const id = String(projectIdCode || '').trim();
    if (!id) return of(null);
    const storeId = (this.storeContext.getActiveStore()?.id_code || '').trim();
    const headers = this.getHeaders(storeId || undefined);
    const params = storeId ? new HttpParams().set('store_id', storeId) : undefined;
    return this.http.post<any>(`${this.API_BASE_URL}/projects/${encodeURIComponent(id)}/members`, payload, { headers, params });
  }

  updateProject(projectIdCode: string, patch: Partial<Project>): Observable<boolean> {
    const id = String(projectIdCode || '').trim();
    if (!id) return of(false);
    const storeId = (this.storeContext.getActiveStore()?.id_code || '').trim();
    const headers = this.getHeaders(storeId || undefined);
    const params = storeId ? new HttpParams().set('store_id', storeId) : undefined;
    return this.http.patch<any>(`${this.API_BASE_URL}/projects/${encodeURIComponent(id)}`, patch, { headers, params }).pipe(
      map(() => true),
      tap(() => {
        if (storeId) this.refreshProjects(storeId).subscribe();
      }),
      catchError(() => of(false))
    );
  }

  updateProjectStatus(projectIdCode: string, status: ProjectStatus): Observable<boolean> {
    return this.updateProject(projectIdCode, { status });
  }

  listMembers(): Observable<ProjectMember[]> {
    return this.membersSubject.asObservable();
  }

  listInvoices(): Observable<ProjectInvoiceRow[]> {
    return this.invoicesSubject.asObservable();
  }

  setMembersFromExternal(external: ProjectMember[]): void {
    const byId = new Map<string, ProjectMember>();
    for (const m of this.membersSubject.value) byId.set(m.id_code, m);

    const merged = external.map((incoming) => {
      const prev = byId.get(incoming.id_code);
      const costFromHistory = this.getCurrentCostForMember(incoming.id_code);
      const cost = costFromHistory !== undefined ? costFromHistory : (incoming.cost_per_hour ?? prev?.cost_per_hour ?? null);
      return {
        ...prev,
        ...incoming,
        cost_per_hour: cost,
        status: incoming.status ?? prev?.status ?? 'offline',
        today_project_pct: incoming.today_project_pct ?? prev?.today_project_pct ?? 0,
        today_office_pct: incoming.today_office_pct ?? prev?.today_office_pct ?? 0,
      } satisfies ProjectMember;
    });

    this.membersSubject.next(merged);
  }

  markInvoicePaid(invoiceIdCode: string, paidDate: string, paidValue?: number | null): Observable<boolean> {
    const current = this.invoicesSubject.value;
    const idx = current.findIndex((r) => r.id_code === invoiceIdCode);
    if (idx < 0) return of(false);
    const next = [...current];
    const row = next[idx];
    next[idx] = {
      ...row,
      paid_date: paidDate,
      paid_value: paidValue ?? row.expected_value,
    };
    this.invoicesSubject.next(next);
    return of(true);
  }

  upsertMemberCost(memberIdCode: string, costPerHour: number | null, effectiveFrom?: string | null): Observable<boolean> {
    const current = this.membersSubject.value;
    const idx = current.findIndex((m) => m.id_code === memberIdCode);
    if (idx < 0) return of(false);

    const nextEffectiveFrom = (effectiveFrom || '').trim() || new Date().toISOString().slice(0, 10);
    const currentHistory = this.memberCostHistorySubject.value;
    const prevHistory = currentHistory[memberIdCode] || [];
    const nextHistory = [...prevHistory, { cost_per_hour: costPerHour, effective_from: nextEffectiveFrom }]
      .filter((e) => !!e.effective_from)
      .sort((a, b) => a.effective_from.localeCompare(b.effective_from));
    this.memberCostHistorySubject.next({ ...currentHistory, [memberIdCode]: nextHistory });

    const resolvedCost = this.getCurrentCostForMember(memberIdCode) ?? costPerHour ?? null;
    const next = [...current];
    next[idx] = { ...next[idx], cost_per_hour: resolvedCost };
    this.membersSubject.next(next);
    return of(true);
  }

  getMemberCostHistory(memberIdCode: string): { cost_per_hour: number | null; effective_from: string }[] {
    return this.memberCostHistorySubject.value[memberIdCode] || [];
  }

  private getCurrentCostForMember(memberIdCode: string): number | null | undefined {
    const history = this.memberCostHistorySubject.value[memberIdCode];
    if (!history || history.length === 0) return undefined;
    const today = new Date().toISOString().slice(0, 10);
    const eligible = history.filter((e) => e.effective_from <= today);
    const pick = (eligible.length ? eligible : history).at(-1);
    return pick ? pick.cost_per_hour : undefined;
  }

  private seedStages(): ProjectStage[] {
    return [
      { code: 'EP', name: 'Estudo Preliminar', order: 1 },
      { code: 'AP', name: 'Anteprojeto', order: 2 },
      { code: 'EX', name: 'Executivo', order: 3 },
      { code: 'VT', name: 'Vistoria', order: 4 },
    ];
  }

  private seedProjects(): Project[] {
    const stages = this.seedStages();
    return [
      {
        id_code: 'proj-001',
        name: 'Residência Jardim Europa',
        description: 'Reforma e ampliação residencial',
        client_name: 'Cliente A',
        logo_url: null,
        start_date: '2026-03-06',
        end_date: '2026-12-21',
        team_member_ids: ['mem-001', 'mem-002'],
        status: 'published',
        current_stage: 'EX',
        stages: stages.map((s) => ({ ...s })),
        contract_total: 120000,
        burn_cost_total: 42000,
        updated_at: new Date().toISOString(),
      },
      {
        id_code: 'proj-002',
        name: 'Apartamento Moema',
        description: 'Interiores + compatibilização',
        client_name: 'Cliente B',
        logo_url: null,
        start_date: '2026-02-12',
        end_date: '2026-08-30',
        team_member_ids: ['mem-002'],
        status: 'paused',
        current_stage: 'AP',
        stages: stages.map((s) => ({ ...s })),
        contract_total: 80000,
        burn_cost_total: 61000,
        updated_at: new Date().toISOString(),
      },
      {
        id_code: 'proj-003',
        name: 'Comercial Vila Madalena',
        description: 'Projeto executivo comercial',
        client_name: 'Cliente C',
        logo_url: null,
        start_date: '2026-04-01',
        end_date: '2026-06-15',
        team_member_ids: ['mem-001'],
        status: 'draft',
        current_stage: 'EP',
        stages: stages.map((s) => ({ ...s })),
        contract_total: 65000,
        burn_cost_total: 0,
        updated_at: new Date().toISOString(),
      },
      {
        id_code: 'proj-004',
        name: 'Retrofit Centro',
        description: 'Retrofit de fachada e áreas comuns',
        client_name: 'Cliente D',
        logo_url: null,
        start_date: '2025-11-10',
        end_date: '2026-04-18',
        team_member_ids: ['mem-001', 'mem-002'],
        status: 'canceled',
        current_stage: 'VT',
        stages: stages.map((s) => ({ ...s })),
        contract_total: 150000,
        burn_cost_total: 98000,
        updated_at: new Date().toISOString(),
      },
    ];
  }

  private seedMembers(): ProjectMember[] {
    return [
      {
        id_code: 'mem-001',
        member_id_code: 'mem-001',
        name: 'Colaborador 1',
        email: 'colaborador1@dmedia.com',
        role: 'collaborator',
        avatar_url: null,
        cost_per_hour: 120,
        status: 'working',
        today_project_pct: 70,
        today_office_pct: 30,
        current_project_id_code: 'proj-001',
        current_project_name: 'Residência Jardim Europa',
      },
      {
        id_code: 'mem-002',
        member_id_code: 'mem-002',
        name: 'Colaborador 2',
        email: 'colaborador2@dmedia.com',
        role: 'collaborator',
        avatar_url: null,
        cost_per_hour: 90,
        status: 'idle',
        today_project_pct: 35,
        today_office_pct: 65,
        current_project_id_code: null,
        current_project_name: null,
      },
    ];
  }

  private seedInvoices(): ProjectInvoiceRow[] {
    return [
      {
        id_code: 'inv-001',
        project_id_code: 'proj-001',
        project_name: 'Residência Jardim Europa',
        stage_code: 'EP',
        stage_name: 'Estudo Preliminar',
        month: '2026-04',
        expected_value: 20000,
        expected_date: '2026-04-05',
        paid_value: 20000,
        paid_date: '2026-04-04',
      },
      {
        id_code: 'inv-002',
        project_id_code: 'proj-001',
        project_name: 'Residência Jardim Europa',
        stage_code: 'AP',
        stage_name: 'Anteprojeto',
        month: '2026-05',
        expected_value: 40000,
        expected_date: '2026-05-10',
        paid_value: null,
        paid_date: null,
      },
      {
        id_code: 'inv-003',
        project_id_code: 'proj-002',
        project_name: 'Apartamento Moema',
        stage_code: 'AP',
        stage_name: 'Anteprojeto',
        month: '2026-04',
        expected_value: 30000,
        expected_date: '2026-04-20',
        paid_value: null,
        paid_date: null,
      },
    ];
  }

  private getHeaders(storeId?: string): HttpHeaders {
    const token = this.auth.getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const sid = (storeId || '').trim();
    if (sid) headers['x-store-id'] = sid;
    return new HttpHeaders(headers);
  }

  private extractProjects(resp: any): Project[] {
    const root = this.unwrapResponse(resp);
    const raw =
      resp?.data?.projects ??
      resp?.data?.data ??
      resp?.data?.items ??
      resp?.data ??
      resp?.items ??
      root?.data?.projects ??
      root?.data?.data ??
      root?.data?.items ??
      root?.data ??
      root?.items ??
      root ??
      [];
    const items = Array.isArray(raw) ? raw : [];
    return items.map((it) => this.normalizeProject(it));
  }

  private extractProject(resp: any): Project | null {
    const root = this.unwrapResponse(resp);
    const stagesFromResp = resp?.data?.stages ?? root?.data?.stages ?? null;
    const rawProject = resp?.data?.project ?? root?.data?.project ?? null;
    const raw =
      rawProject && typeof rawProject === 'object'
        ? { ...rawProject, stages: Array.isArray(stagesFromResp) ? stagesFromResp : rawProject?.stages }
        : (resp?.data ?? root?.data ?? root ?? null);
    if (!raw || typeof raw !== 'object') return null;
    return this.normalizeProject(raw);
  }

  private normalizeProject(raw: any): Project {
    const idCode = String(raw?.id_code || raw?.id || '').trim();
    const name = String(raw?.name || raw?.title || '').trim();
    const statusRaw = String(raw?.status || '').trim();
    const status: ProjectStatus | null =
      statusRaw === 'published' ? 'active' :
      statusRaw === 'active' ? 'active' :
      statusRaw === 'paused' ? 'paused' :
      statusRaw === 'canceled' ? 'canceled' :
      statusRaw === 'draft' ? 'draft' :
      null;

    const stages = Array.isArray(raw?.stages)
      ? (raw.stages as any[]).map((s, idx) => {
          const idCode = String(s?.id_code || s?.id || '').trim() || undefined;
          const code = String(s?.code || s?.acronym || s?.id_code || s?.id || `STG${idx + 1}`).trim();
          const name = String(s?.name || s?.title || code).trim();
          const order =
            typeof s?.order === 'number' ? s.order :
            typeof s?.order_index === 'number' ? s.order_index :
            typeof s?.order_index === 'string' ? Number(s.order_index) :
            typeof s?.order === 'string' ? Number(s.order) :
            idx + 1;
          const contractValueRaw = s?.contract_value ?? null;
          const contract_value =
            contractValueRaw === null || contractValueRaw === undefined || contractValueRaw === ''
              ? null
              : Number(contractValueRaw);
          const hoursRaw = s?.hours_estimated ?? s?.estimated_hours ?? null;
          const hours_estimated = hoursRaw === null || hoursRaw === undefined || hoursRaw === '' ? null : Number(hoursRaw);
          const color = s?.color ?? s?.color_1 ?? null;
          const due_date = s?.due_date ?? null;
          const completed_at = s?.completed_at ?? null;
          return {
            id_code: idCode,
            code,
            name,
            order: Number.isFinite(order) ? order : idx + 1,
            contract_value: Number.isFinite(contract_value as any) ? contract_value : null,
            hours_estimated: Number.isFinite(hours_estimated as any) ? hours_estimated : null,
            color,
            due_date,
            completed_at,
          } satisfies ProjectStage;
        })
      : null;
    const currentStage = (raw?.current_stage || raw?.current_stage_code) as any;

    return {
      id_code: idCode || name || `proj-${Date.now()}`,
      name: name || idCode || 'Projeto',
      description: raw?.description ?? null,
      client_name: raw?.client_name ?? null,
      client_party_id: raw?.client_party_id ?? null,
      responsible_name: raw?.responsible_name ?? null,
      logo_url: raw?.logo_url ?? null,
      start_date: raw?.start_date ?? null,
      end_date: raw?.end_date ?? null,
      team_member_ids: raw?.team_member_ids ?? null,
      status,
      current_stage: currentStage ?? null,
      stages,
      contract_total: raw?.contract_total ?? raw?.contract_value_total ?? null,
      burn_cost_total: raw?.burn_cost_total ?? null,
      updated_at: raw?.updated_at ?? null,
    };
  }

  private unwrapResponse(resp: any): any {
    const body = resp?.body ?? resp;
    if (typeof body === 'string') {
      try {
        return JSON.parse(body);
      } catch {
        return body;
      }
    }
    return body;
  }
}
