import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { throwError, of } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { environment } from '../../../environments/environment';

export interface ApiEvent {
  id: number | string;
  name?: string;
  title?: string;
  description?: string | null;
  details?: string;
  start_date?: string;
  startDate?: string;
  start_datetime?: string;
  end_date?: string;
  endDate?: string;
  end_datetime?: string;
  banner_url?: string | null;
  image?: string | null;
  slug?: string;
  id_code?: string;
  // Auto-checkin
  requires_auto_checkin?: boolean | number;
  auto_checkin_flow_quest?: boolean | number;
  // Card background fields
  color_1?: string | null;
  color_2?: string | null;
  card_background?: string | null;
  card_background_type?: number | null; // 0 = colors (gradient), 1 = image
  // add any other fields from API as needed
}

export interface EventsApiResponse {
  success: boolean;
  message?: string;
  data: {
    events: ApiEvent[];
  };
}

export interface EventDetailApiResponse {
  success: boolean;
  data: {
    event: ApiEvent;
    total_responses?: number;
  };
}
// Auto-checkin: resposta do convidado atual
export interface EventGuestMeApiResponse {
  success: boolean;
  data: { guest?: ApiGuest | null };
  message?: string;
}

// Auto-checkin: resultado do check-in
export interface EventCheckinApiResponse {
  success: boolean;
  data: { guest: ApiGuest; checked_in: boolean };
  message?: string;
}

export interface CreateEventPayload {
  name: string;
  slug: string;
  banner_url: string;
  start_datetime: string;
  end_datetime: string;
  description: string;
  place: string;
  resp_email: string;
  resp_name: string;
  resp_phone: string;
  color_1: string;
  color_2: string;
  card_background?: string | null;
  card_background_type?: number | null; // 0 colors, 1 image
  // Auto-checkin flags
  requires_auto_checkin?: boolean | number;
  auto_checkin_flow_quest?: boolean | number;
}

export interface EventCreateApiResponse {
  success: boolean;
  data?: { event?: ApiEvent; events?: ApiEvent[] };
  message?: string;
}

export interface EventListItem {
  eventName: string;
  description: string;
  startDate: string;
  endDate: string;
  image?: string;
  id_code?: string;
  links: Array<{ text: string; url: string; variant: 'primary' | 'outline' | 'info' | 'warning' }>;
}

// ================================
// Jam Module API Types
// ================================
export interface ApiJam {
  id: number;
  name?: string;
  slug?: string;
  notes?: string | null;
  status?: string | null;
  order_index?: number | null;
  event_id?: number | string;
  songs?: ApiSong[];
}

export interface ApiSong {
  id: number;
  title: string;
  artist?: string | null;
  key?: string | null; // tom
  tempo_bpm?: number | null;
  notes?: string | null;
  status?: 'planned' | 'open_for_candidates' | 'on_stage' | 'played' | 'canceled';
  ready?: boolean | null;
  order_index?: number | null;
  instrument_buckets?: any[];
  instrument_slots?: Array<{
    instrument: string;
    slots: number;
    required?: boolean;
    fallback_allowed?: boolean;
    approved_count?: number;
    pending_count?: number;
    remaining_slots?: number;
  }>;
  release_batch?: number;
  jam?: { id: number; name?: string; status?: string } | null;
  jam_id?: number; // compat
  instrumentation?: string[]; // compat
  rating_summary?: any;
  queue_position?: number;
  my_application?: { instrument?: string; status?: 'pending' | 'approved' | 'rejected' } | null;
  musicians?: Array<{
    name: string;
    avatar_url?: string;
    instrument: string;
    id?: number | string;
    [key: string]: any;
  }>;
}

export interface InstrumentSlotPayload {
  instrument: string;
  slots: number;
  required?: boolean;
  fallback?: string | null;
}

export interface InstrumentSlotResult {
  instrument: string;
  slots: number;
  required?: boolean;
  fallback?: string | null;
  filled_count?: number;
}

export interface AutoInstrumentSlotPayload {
  instrument: string;
  slots: number;
  required?: boolean;
  fallback_allowed?: boolean;
}

export interface CreateSongAutoPayload {
  title: string;
  artist?: string;
  key?: string;
  tempo_bpm?: number;
  notes?: string;
  release_batch?: number;
  status?: 'planned' | 'open_for_candidates' | 'on_stage' | 'played' | 'canceled';
  order_index?: number;
  instrument_slots: AutoInstrumentSlotPayload[];
  pre_approved_candidates?: Array<{ user_id: string; instrument: string }>;
}

export interface CreateSongAutoResult {
  jam: ApiJam;
  song: ApiSong;
}

export interface OpenSongAggregate extends ApiSong {
  slots?: InstrumentSlotResult[];
  candidates?: any[];
  rating?: { average?: number; count?: number };
}

// ================================
// Questions API Types
// ================================
export interface ApiQuestion {
  id: number;
  text?: string; // creation/update response may return `text`
  question_text?: string; // list response may return `question_text`
  type?: string; // creation/update may use `type`
  question_type?: string; // list may use `question_type`
  options?: string[];
  is_required?: boolean;
  show_results?: boolean;
  order_index?: number;
  is_public?: boolean | number;
  config?: any;
}

export interface QuestionsListApiResponse {
  success: boolean;
  data: { questions: ApiQuestion[] };
  message?: string;
}

export interface QuestionCreateApiResponse {
  success: boolean;
  data: { question: ApiQuestion };
  message?: string;
}

// ================================
// Stats por pergunta (público/admin)
// ================================
export interface QuestionOptionCount {
  option_label: string;
  count: number;
}

export interface QuestionStatsApiResponse {
  success: boolean;
  data: {
    counts: QuestionOptionCount[];
    total_responses: number;
    correct_count?: number;
    accuracy_percent?: number;
  };
  message?: string;
}

// Público: lista e detalhe com perguntas visíveis (show_results=true)
export interface PublicEventsListApiResponse {
  success: boolean;
  data: { events: ApiEvent[] };
  message?: string;
}

export interface PublicEventDetailWithQuestionsApiResponse {
  success: boolean;
  data: { event: ApiEvent & { questions?: ApiQuestion[] } };
  message?: string;
}

// ================================
// Responses API Types
// ================================
export interface AnswerItemPayload {
  question_id: number;
  answer_text?: string;
  answer_json?: any;
}

export interface SubmitResponsesPublicPayload {
  guest_code: string;
  selfie_url?: string;
  answers: AnswerItemPayload[];
}

export interface SubmitResponsesAuthPayload {
  selfie_url?: string;
  answers: AnswerItemPayload[];
}

export interface SubmitResponsesResult {
  success: boolean;
  response_id?: number;
  message?: string;
}

// Listagem de respostas
export interface ApiResponseItem {
  id: number;
  question_id: number;
  answer_text?: string | null;
  answer_json?: any;
  created_at?: string;
  // Informações do convidado/usuário (podem variar entre endpoints)
  user?: { id?: number; name?: string; display_name?: string; avatar_url?: string };
  guest_name?: string;
  guest_avatar_url?: string;
}

export interface ListResponsesApiResponse {
  success: boolean;
  data: { responses: ApiResponseItem[] };
  meta?: { total?: number };
  message?: string;
}

export interface ListResponsesParams {
  question_id?: number;
  page?: number;
  page_size?: number;
  search?: string;
}

// ================================
// Admin Respondents (aggregated list)
// ================================
export interface AdminRespondentItem {
  guest_code: string;
  selfie_url?: string | null;
  submitted_at?: string | null;
  answers: Record<string, string>;
  user?: { id_code?: string; name?: string; email?: string; phone?: string; avatar_url?: string };
  guest?: any | null;
}

export interface AdminRespondentsApiResponse {
  success: boolean;
  data: AdminRespondentItem[];
  meta?: { total?: number; page?: number; limit?: number; pages?: number };
  message?: string;
}

// Novo: retorno de perguntas com possível resposta pré-preenchida
export interface QuestionWithAnswer {
  question: ApiQuestion;
  answer?: ApiResponseItem | null;
}

// ================================
// Guests API Types
// ================================
export interface ApiGuestDocument { type?: string; number?: string }
export interface ApiGuest {
  id: number;
  display_name: string;
  avatar_url?: string | null;
  email: string;
  document?: ApiGuestDocument | null;
  phone?: string;
  type?: string;
  origin_status?: string;
  // RSVP
  rsvp?: boolean; // compat
  rsvp_confirmed?: boolean | number | null; // coluna oficial pode vir 0/1
  rsvp_at?: string | null;
  invited_at?: string | null;
  invited_by_user_id?: number | null;
  // Check-in
  check_in_at?: string | null;
  check_in_method?: string | null;
  authorized_by_user?: number | null;
  // Extras
  source?: string | null;
  guest_number?: number | null;
  guest_document_type?: string | null;
  guest_phone?: string | null;
  guest_email?: string | null;
  guestname?: string | null;
}

export interface ApiGuestUpdatePayload {
  rsvp_confirmed?: boolean | number | null;
  rsvp_at?: string | null;
  check_in_at?: string | null;
  check_in_method?: string | null;
  authorized_by_user?: number | null;
  // Dados de perfil
  display_name?: string;
  email?: string;
  phone?: string;
  document?: ApiGuestDocument | null;
  type?: string;
}

export interface GuestsApiResponse {
  success: boolean;
  data: { guests: ApiGuest[] };
  message?: string;
}

// Guests stats (para KPIs de convidados)
export interface GuestsStats {
  total_guests: number;
  rsvp_count: number;
  checkin_count: number;
  by_source?: Record<string, number>;
  by_type?: Record<string, number>;
  by_check_in_method?: Record<string, number>;
}

// Resposta com guests e stats juntos
export interface GuestsWithStatsApiResponse {
  success: boolean;
  data: { guests: ApiGuest[]; stats?: GuestsStats };
  meta?: any;
  message?: string;
}

export interface CreateEventGuestPayload {
  display_name: string;
  email: string;
  phone?: string;
  document?: ApiGuestDocument | null;
  check_in_at?: string | null;
}

// Novo: criação em lote na pré-lista
export interface CreateGuestBatchItem {
  guest_name: string;
  guest_email?: string | null;
  guest_phone?: string | null;
  guest_document_type: 'rg' | 'cpf' | 'passport';
  guest_document_number: string;
  type: 'normal' | 'vip' | 'premium';
  source?: 'invited' | 'walk_in';
}

// Novo: check-in manual imediato
export interface CheckinManualPayload {
  guest_name: string;
  guest_phone?: string | null;
  guest_document_type: 'rg' | 'cpf' | 'passport';
  guest_document_number: string;
  type: 'normal' | 'vip' | 'premium';
}

export interface OnStageResponse {
  now_playing?: ApiSong | null;
  my_upcoming: ApiSong[];
}

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private readonly API_BASE_URL = `${environment.apiUrl}/api/v1`;
  private readonly PUBLIC_API_BASE_URL = `${environment.apiUrl}/api/public/v1`;
  private readonly NON_VERSIONED_API_BASE_URL = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  getEvents(): Observable<EventListItem[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});

    return this.http.get<EventsApiResponse>(`${this.API_BASE_URL}/events`, { headers }).pipe(
      map((resp) => {
        const events = resp?.data?.events ?? [];
        return events.map((ev) => this.mapApiEventToListItem(ev));
      })
    );
  }

  // ================================
  // Jam Module API Methods
  // ================================
  createJam(eventId: string | number, payload: { name: string; slug: string; notes?: string; status?: string; order_index?: number }): Observable<ApiJam> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${eventId}/jams`;
    return this.http.post<{ success: boolean; data: { jam: ApiJam } }>(url, payload, { headers }).pipe(
      map((resp) => resp?.data?.jam as ApiJam)
    );
  }

  getEventJams(eventId: string | number): Observable<ApiJam[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${eventId}/jams`;
    return this.http.get<any>(url, { headers }).pipe(
      map((resp) => {
        if (Array.isArray(resp?.data?.jams)) return resp.data.jams as ApiJam[];
        if (Array.isArray(resp?.data)) return resp.data as ApiJam[];
        if (Array.isArray(resp)) return resp as ApiJam[];
        return [] as ApiJam[];
      })
    );
  }

  createJamSong(eventId: string | number, jamId: string | number, payload: {
    title: string;
    artist?: string;
    key?: string;
    tempo_bpm?: number;
    notes?: string;
  }): Observable<ApiSong> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/${jamId}/songs`;
    return this.http.post<{ success: boolean; data: { song: ApiSong } }>(url, payload, { headers }).pipe(
      map((resp) => resp?.data?.song as ApiSong)
    );
  }

  getJamSongs(eventId: string | number, jamId: string | number): Observable<ApiSong[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/${jamId}/songs`;
    return this.http.get<{ success: boolean; data: { songs: ApiSong[] } }>(url, { headers }).pipe(
      map((resp) => resp?.data?.songs ?? [])
    );
  }

  applySongCandidate(eventId: string | number, jamId: string | number, songId: string | number, instrument: string): Observable<boolean> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/${jamId}/songs/${songId}/apply`;
    return this.http.post<{ success: boolean; data?: any; message?: string }>(url, { instrument }, { headers }).pipe(
      map((resp) => !!resp?.success)
    );
  }

  setSongApplicationStatus(
    eventId: string | number,
    jamId: string | number,
    songId: string | number,
    instrument: string,
    candidate: { id?: number | string; id_code?: string; email?: string },
    status: 'pending' | 'approved' | 'rejected'
  ): Observable<boolean> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/${jamId}/songs/${songId}/applications/status`;
    const body: any = {
      instrument,
      status,
      user_id: candidate?.id,
      user_id_code: candidate?.id_code,
      user_email: candidate?.email
    };
    return this.http.post<{ success: boolean; data?: any; message?: string }>(url, body, { headers }).pipe(
      map((resp) => !!resp?.success)
    );
  }

  getOpenSongsWithMyApplication(eventId: string | number, jamId: string | number): Observable<any[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/${jamId}/songs/open`;
    return this.http.get<{ success?: boolean; data?: any }>(url, { headers }).pipe(
      map((resp) => {
        const songs = resp?.data?.songs || resp?.data || [];
        return Array.isArray(songs) ? songs : [];
      })
    );
  }

  getEventOpenJamsSongs(eventId: string | number): Observable<ApiSong[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.NON_VERSIONED_API_BASE_URL}/events/${eventId}/jams/open`;
    try { console.log('[HTTP][EventService] GET open jams songs', { url, eventId, auth: !!token }); } catch {}
    return this.http.get<{ success?: boolean; data?: any }>(url, { headers }).pipe(
      map((resp) => {
        const songs = resp?.data?.songs || resp?.data || [];
        return (Array.isArray(songs) ? songs : []) as ApiSong[];
      })
    );
  }

  getEventMyOnStage(eventId: string | number): Observable<OnStageResponse> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.NON_VERSIONED_API_BASE_URL}/events/${eventId}/jams/my/on-stage`;
    try { console.log('[HTTP][EventService] GET my on-stage songs', { url, eventId, auth: !!token }); } catch {}
    return this.http.get<{ success?: boolean; data?: any }>(url, { headers }).pipe(
      map((resp) => {
        const data = resp?.data;
        return {
          now_playing: data?.now_playing ? (data.now_playing as ApiSong) : null,
          my_upcoming: Array.isArray(data?.my_upcoming) ? (data.my_upcoming as ApiSong[]) : []
        };
      })
    );
  }

  getEventJamsPublic(eventId: string | number): Observable<ApiJam[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.NON_VERSIONED_API_BASE_URL}/events/${eventId}/jams`;
    try { console.log('[HTTP][EventService] GET public jams', { url, eventId, auth: !!token }); } catch {}
    return this.http.get<{ success?: boolean; data?: any }>(url, { headers }).pipe(
      map((resp) => {
        const jams = resp?.data?.jams || resp?.data || [];
        return (Array.isArray(jams) ? jams : []) as ApiJam[];
      })
    );
  }

  createSongAuto(eventId: string | number, payload: CreateSongAutoPayload): Observable<CreateSongAutoResult> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' });
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/songs`;
    return this.http.post<{ success: boolean; data: { jam: ApiJam; song: ApiSong } }>(url, payload, { headers }).pipe(
      map((resp) => ({ jam: resp?.data?.jam as ApiJam, song: resp?.data?.song as ApiSong }))
    );
  }

  setSongInstrumentSlots(eventId: string | number, jamId: string | number, songId: string | number, slots: InstrumentSlotPayload[]): Observable<InstrumentSlotResult[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/${jamId}/songs/${songId}/instrument-slots`;
    return this.http.post<{ success: boolean; data: { slots: InstrumentSlotResult[] } }>(url, { slots }, { headers }).pipe(
      map((resp) => resp?.data?.slots ?? [])
    );
  }

  getOpenSongs(eventId: string | number, jamId: string | number): Observable<OpenSongAggregate[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.NON_VERSIONED_API_BASE_URL}/events/${eventId}/jams/${jamId}/songs/open`;
    return this.http.get<{ success: boolean; data: { songs: OpenSongAggregate[] } }>(url, { headers }).pipe(
      map((resp) => resp?.data?.songs ?? [])
    );
  }

  streamJam(eventId: string | number, jamId: string | number): EventSource {
    const stub: any = {
      onopen: null,
      onmessage: null,
      onerror: null,
      close: () => {},
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    return stub as EventSource;
  }

 

  getEventJamId(eventId: string | number): Observable<number | null> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.NON_VERSIONED_API_BASE_URL}/events/${eventId}/jam`;
    try { console.log('[HTTP][EventService] GET jam id', { url, eventId, auth: !!token }); } catch {}
    return this.http.get<any>(url, { headers }).pipe(
      map((resp) => {
        const jamId = resp?.data?.jam_id ?? resp?.jam_id ?? null;
        if (jamId === null || jamId === undefined) return null;
        const n = Number(jamId);
        return Number.isNaN(n) ? null : n;
      })
    );
  }

  getEventPlaylist(eventId: string | number): Observable<any[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.NON_VERSIONED_API_BASE_URL}/events/${eventId}/jams/playlist`;
    return this.http.get<{ success: boolean; data: any[] }>(url, { headers }).pipe(
      map((resp) => resp?.data || [])
    );
  }

  moveSongStatus(eventId: string | number, jamId: string | number, songId: string | number, status: 'planned' | 'open_for_candidates' | 'on_stage' | 'played' | 'canceled'): Observable<ApiSong> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/${jamId}/songs/${songId}/move`;
    return this.http.post<{ success: boolean; data: { song: ApiSong } }>(url, { status }, { headers }).pipe(
      map((resp) => resp?.data?.song as ApiSong)
    );
  }

  updateSongReady(eventId: string | number, jamId: string | number, songId: string | number, ready: boolean): Observable<boolean> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' });
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/${jamId}/songs/${songId}/ready`;
    return this.http.patch<{ success: boolean; data?: any }>(url, { ready }, { headers }).pipe(
      map((resp) => !!resp?.success)
    );
  }

  updateSongOrder(eventId: string | number, jamId: string | number, status: 'planned' | 'open_for_candidates' | 'on_stage' | 'played', orderedIds: Array<string | number>): Observable<boolean> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' });
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/${jamId}/songs/order`;
    return this.http.patch<{ success: boolean; data?: any }>(url, { status, ordered_ids: orderedIds }, { headers }).pipe(
      map((resp) => !!resp?.success)
    );
  }

  deleteSong(eventId: string | number, jamId: string | number, songId: string | number): Observable<boolean> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/${jamId}/songs/${songId}`;
    return this.http.delete<{ success: boolean }>(url, { headers }).pipe(
      map((resp) => !!resp?.success)
    );
  }

  // Lista convidados do evento por id_code (ou ID) com paginação/filtros simples
  getEventGuests(idOrCode: string, params?: {
    page?: number;
    page_size?: number;
    search?: string;
    type?: string;
    source?: string;
    checked_in?: boolean;
    rsvp?: boolean;
  }): Observable<ApiGuest[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});

    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));
    if (params?.search) query.set('search', params.search);
    if (params?.type) query.set('type', params.type);
    if (params?.source) query.set('source', params.source);
    if (typeof params?.checked_in === 'boolean') query.set('checked_in', String(params.checked_in));
    if (typeof params?.rsvp === 'boolean') query.set('rsvp', String(params.rsvp));

    const qs = query.toString();
    const url = `${this.API_BASE_URL}/events/${idOrCode}/guests${qs ? `?${qs}` : ''}`;

    return this.http.get<GuestsApiResponse>(url, { headers }).pipe(
      map((resp) => resp?.data?.guests ?? [])
    );
  }

  // Versão que também retorna stats para KPIs
  getEventGuestsWithStats(idOrCode: string, params?: {
    page?: number;
    page_size?: number;
    search?: string;
    type?: string;
    source?: string;
    checked_in?: boolean;
    rsvp?: boolean;
  }): Observable<{ guests: ApiGuest[]; stats?: GuestsStats }> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});

    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));
    if (params?.search) query.set('search', params.search);
    if (params?.type) query.set('type', params.type);
    if (params?.source) query.set('source', params.source);
    if (typeof params?.checked_in === 'boolean') query.set('checked_in', String(params.checked_in));
    if (typeof params?.rsvp === 'boolean') query.set('rsvp', String(params.rsvp));

    const qs = query.toString();
    const url = `${this.API_BASE_URL}/events/${idOrCode}/guests${qs ? `?${qs}` : ''}`;

    return this.http.get<GuestsWithStatsApiResponse>(url, { headers }).pipe(
      map((resp) => ({ guests: resp?.data?.guests ?? [], stats: resp?.data?.stats }))
    );
  }

  // Atualiza campos de um convidado do evento
  updateEventGuest(idOrCode: string | number, guestId: number, changes: ApiGuestUpdatePayload): Observable<ApiGuest> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${idOrCode}/guests/${guestId}`;
    return this.http.patch<{ success: boolean; data: { guest: ApiGuest } }>(url, changes, { headers }).pipe(
      map((resp) => resp?.data?.guest)
    );
  }

  // Cria um convidado (pré-convidado) para o evento
  createEventGuest(idOrCode: string | number, payload: CreateEventGuestPayload): Observable<ApiGuest> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${idOrCode}/guests`;
    return this.http.post<{ success: boolean; data: { guest: ApiGuest } }>(url, payload, { headers }).pipe(
      map((resp) => resp?.data?.guest)
    );
  }

  // Cria convidados na pré-lista (lote)
  createEventGuestsBatch(idOrCode: string | number, guests: CreateGuestBatchItem[]): Observable<ApiGuest[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${idOrCode}/guests`;
    const body = { guests };
    return this.http.post<GuestsApiResponse>(url, body, { headers }).pipe(
      map((resp) => resp?.data?.guests ?? [])
    );
  }

  // Check-in manual imediato
  checkinManual(idOrCode: string | number, payload: CheckinManualPayload): Observable<ApiGuest> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${idOrCode}/checkin/manual`;
    return this.http.post<{ success: boolean; data: { guest: ApiGuest } }>(url, payload, { headers }).pipe(
      map((resp) => resp?.data?.guest)
    );
  }

  createEvent(payload: CreateEventPayload): Observable<EventListItem> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    return this.http.post<EventCreateApiResponse>(`${this.API_BASE_URL}/events`, payload, { headers }).pipe(
      map((resp) => {
        const ev = resp?.data?.event || (resp?.data?.events ? resp.data!.events[0] : undefined);
        if (ev) return this.mapApiEventToListItem(ev);
        // fallback: mapeia a partir do payload enviado
        return {
          eventName: payload.name,
          description: payload.description || 'Sem descrição',
          startDate: this.formatDateTime(payload.start_datetime),
          endDate: this.formatDateTime(payload.end_datetime),
          image: this.normalizeImageUrl(payload.banner_url),
          links: []
        };
      })
    );
  }

  // Retorna o objeto bruto da API para obter id e id_code
  createEventRaw(payload: CreateEventPayload): Observable<ApiEvent> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    return this.http.post<EventCreateApiResponse>(`${this.API_BASE_URL}/events`, payload, { headers }).pipe(
      map((resp) => (resp?.data?.event || (resp?.data?.events ? resp.data!.events[0] : undefined)) as ApiEvent)
    );
  }

  // Atualiza um evento por id numérico ou id_code string
  updateEvent(idOrCode: number | string, changes: Partial<ApiEvent>): Observable<ApiEvent> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    // Backend espera PATCH para atualizações parciais
    return this.http.patch<ApiEvent>(`${this.API_BASE_URL}/events/${idOrCode}`, changes, { headers });
  }

  // Busca detalhes de um evento por id_code (rota pública)
  getEventByIdCode(idCode: string): Observable<ApiEvent> {
    const url = `${this.PUBLIC_API_BASE_URL}/events/${idCode}`;
    return this.http.get<any>(url).pipe(
      map((resp) => (resp?.data?.event || resp?.data || resp?.event) as ApiEvent)
    );
  }

  // Versão pública que retorna também total_responses (para KPIs)
  getEventByIdCodeDetail(idCode: string): Observable<{ event: ApiEvent; total_responses?: number }> {
    const url = `${this.PUBLIC_API_BASE_URL}/events/${idCode}`;
    try { console.log('[HTTP][EventService] GET event by id_code (detail)', { url, idCode }); } catch {}
    return this.http.get<any>(url).pipe(
      map((resp) => ({
        event: (resp?.data?.event || resp?.data || resp?.event) as ApiEvent,
        total_responses: resp?.data?.total_responses ?? resp?.total_responses
      }))
    );
  }

  // Endpoint público para detalhe do evento por id_code (sem necessidade de token)
  getPublicEventByIdCodeDetail(idCode: string): Observable<{ event: ApiEvent; total_responses?: number }> {
    const url = `${this.PUBLIC_API_BASE_URL}/events/${idCode}`;
    try { console.log('[HTTP][EventService] GET public event by id_code (detail)', { url, idCode }); } catch {}
    return this.http.get<any>(url).pipe(
      map((resp) => ({
        event: (resp?.data || resp?.event) as ApiEvent,
        total_responses: resp?.data?.total_responses ?? resp?.total_responses
      }))
    );
  }

  private mapApiEventToListItem(ev: ApiEvent): EventListItem {
    const eventName = ev.name || ev.title || 'Evento';
    const description = ev.description ?? ev.details ?? 'Sem descrição';

    const startIso = ev.start_datetime || ev.start_date || ev.startDate || '';
    const endIso = ev.end_datetime || ev.end_date || ev.endDate || '';
    const startDate = this.formatDateTime(startIso);
    const endDate = this.formatDateTime(endIso);

    const image = this.normalizeImageUrl(ev.banner_url || ev.image || undefined);

    // Links podem ser enriquecidos posteriormente quando a API disponibilizar URLs
    const links: Array<{ text: string; url: string; variant: 'primary' | 'outline' | 'info' | 'warning' }> = [];

    return { eventName, description, startDate, endDate, image: image || undefined, id_code: ev.id_code, links };
  }

  private formatDateTime(iso: string | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso; // caso venha num formato inesperado, mantém
    return date.toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private normalizeImageUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    let clean = url.trim().replace(/[`'\"]/g, '');
    // Se vier apenas o nome do arquivo, assume pasta pública de cards
    if (!/^https?:\/\//.test(clean)) {
      // Evita duplicar caminho se já for relativo válido
      if (!clean.startsWith('/')) {
        clean = `/images/cards/${clean}`;
      }
      return clean;
    }
    return clean;
  }

  // ================================
  // Questions API Methods
  // ================================
  getEventQuestions(idOrCode: string | number): Observable<ApiQuestion[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${idOrCode}/questions`;
    return this.http.get<QuestionsListApiResponse>(url, { headers }).pipe(
      map((resp) => (resp?.data?.questions ?? []).map((q) => this.normalizeQuestion(q)))
    );
  }

  // Público: lista eventos para obter slug
  getPublicEventsList(): Observable<ApiEvent[]> {
    const url = `${this.API_BASE_URL.replace('/api/v1', '')}/api/public/v1/events/public`;
    return this.http.get<PublicEventsListApiResponse>(url).pipe(
      map((resp) => resp?.data?.events ?? [])
    );
  }

  // Público: obter perguntas visíveis por slug
  getPublicEventQuestionsBySlug(slug: string): Observable<ApiQuestion[]> {
    const url = `${this.API_BASE_URL.replace('/api/v1', '')}/api/public/v1/events/public/${slug}`;
    return this.http.get<PublicEventDetailWithQuestionsApiResponse>(url).pipe(
      map((resp) => (resp?.data?.event?.questions ?? []).map((q) => this.normalizeQuestion(q)))
    );
  }

  // Público: stats agregadas por pergunta visível
  getPublicQuestionStats(idOrCode: string | number, questionId: number): Observable<{ options?: string[]; counts: QuestionOptionCount[]; total_responses: number; correct_count?: number; accuracy_percent?: number }> {
    const url = `${this.API_BASE_URL.replace('/api/v1', '')}/api/public/v1/events/${idOrCode}/questions/${questionId}/stats`;
    return this.http.get<QuestionStatsApiResponse>(url).pipe(
      map((resp) => {
        const data: any = resp?.data || {};
        const options: string[] = Array.isArray(data.options) ? data.options.map((o: any) => String(o)) : [];
        const rawCounts: any[] = Array.isArray(data.counts) ? data.counts : [];

        // Normaliza o formato dos counts para { option_label, count }
        const counts: QuestionOptionCount[] = rawCounts.map((c: any) => {
          let label: string = '';
          if (typeof c?.option_label === 'string') label = String(c.option_label);
          else if (typeof c?.option === 'string') label = String(c.option);
          else if (typeof c?.index === 'number' && options[c.index] !== undefined) label = String(options[c.index]);
          return { option_label: label, count: Number(c?.count) || 0 };
        });

        const total = typeof data.total_responses === 'number'
          ? data.total_responses
          : (typeof data.total_answers === 'number' ? data.total_answers : 0);

        return {
          options,
          counts,
          total_responses: total,
          correct_count: data?.correct_count,
          accuracy_percent: data?.accuracy_percent,
        };
      })
    );
  }

  // Auto-checkin: obter status do convidado atual (rota pública, requer JWT)
  getEventGuestMe(idCode: string): Observable<ApiGuest | null> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.PUBLIC_API_BASE_URL}/events/${idCode}/guest/me`;
    return this.http.get<any>(url, { headers }).pipe(
      map((resp) => {
        const data = resp?.data ?? resp ?? null;
        if (!data) return null;
        // Criar objeto mínimo compatível apenas para leitura de check_in_at
        const checkInAt = data?.checkin_at ?? null;
        const guestId = data?.guest_id ?? 0;
        const minimal: Partial<ApiGuest> = { id: guestId, display_name: '', email: '', check_in_at: checkInAt };
        // Adiciona selfie_url se existir no payload da API pública
        const selfie = data?.selfie_url ?? data?.selfieUrl ?? null;
        (minimal as any).selfie_url = selfie;
        return minimal as ApiGuest;
      }),
      catchError((err) => {
        // 404 → usuário não está na lista de convidados
        if (err?.status === 404) return of(null);
        throw err;
      })
    );
  }

  // Auto-checkin: realizar check-in do convidado autenticado
  postEventCheckin(idCode: string, payload: { display_name?: string; email?: string; phone?: string; selfie_url?: string; document?: ApiGuestDocument | null }): Observable<{ guest: ApiGuest; checked_in: boolean }> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    // Corrigir para rota pública de check-in do cliente
    const base = this.API_BASE_URL.replace('/api/v1', '');
    const url = `${base}/api/public/v1/events/${idCode}/checkin`;

    // A API pública espera { name, email, selfie_url }
    const body: any = {
      name: payload.display_name ?? payload.email ?? undefined,
      email: payload.email,
      selfie_url: payload.selfie_url,
    };

    return this.http.post<any>(url, body, { headers }).pipe(
      map((resp: any) => {
        const data = resp?.data ?? resp ?? {};
        const guest = data?.guest as ApiGuest;
        const checked_in = !!(data?.checked_in ?? data?.checkedIn ?? (data?.status === 'checked_in'));
        return { guest, checked_in };
      })
    );
  }

  createEventQuestion(idOrCode: string | number, payload: {
    text: string;
    type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'rating';
    options?: string[];
    is_required?: boolean;
    show_results?: boolean;
    order_index?: number;
    is_public?: boolean | number;
    correct_option_index?: number;
    max_choices?: number;
    config?: any;
  }): Observable<ApiQuestion> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${idOrCode}/questions`;
    return this.http.post<QuestionCreateApiResponse>(url, payload, { headers }).pipe(
      map((resp) => this.normalizeQuestion(resp?.data?.question))
    );
  }

  updateEventQuestion(idOrCode: string | number, questionId: number, changes: Partial<{
    text: string;
    type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'rating';
    options: string[];
    is_required: boolean;
    show_results: boolean;
    order_index: number;
    is_public: boolean | number;
    correct_option_index: number;
    max_choices: number;
    config: any;
  }>): Observable<ApiQuestion> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${idOrCode}/questions/${questionId}`;
    return this.http.patch<QuestionCreateApiResponse>(url, changes, { headers }).pipe(
      map((resp) => this.normalizeQuestion(resp?.data?.question))
    );
  }

  deleteEventQuestion(idOrCode: string | number, questionId: number): Observable<{ success: boolean; message?: string }>{
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${idOrCode}/questions/${questionId}`;
    return this.http.delete<{ success: boolean; message?: string }>(url, { headers });
  }

  private normalizeQuestion(api: ApiQuestion | undefined): ApiQuestion {
    if (!api) return { id: 0, text: '', type: 'text', options: [], is_required: true, show_results: true, order_index: 0, is_public: 0 };
    const text = api.text ?? api.question_text ?? '';
    const rawType = api.type ?? api.question_type ?? 'text';
    // Mapear possíveis nomes alternativos vindos da API
    const type = ((): string => {
      const t = String(rawType).toLowerCase();
      if (['single', 'single_choice', 'radio'].includes(t)) return 'radio';
      if (['multiple', 'multiple_choice', 'checkbox', 'check'].includes(t)) return 'checkbox';
      if (['text_area', 'textarea'].includes(t)) return 'textarea';
      if (['rate', 'rating', 'stars'].includes(t)) return 'rating';
      return t || 'text';
    })();

    // Normalizar opções: aceitar array direto, JSON string ou CSV
    let options: string[] = [];
    const rawOpts: any = (api as any).options;
    if (Array.isArray(rawOpts)) {
      options = rawOpts.filter((o) => o != null).map((o) => String(o).trim()).filter(Boolean);
    } else if (typeof rawOpts === 'string') {
      const s = rawOpts.trim();
      if (s) {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) {
            options = parsed.filter((o) => o != null).map((o) => String(o).trim()).filter(Boolean);
          }
        } catch {
          // CSV/pipe/semicolon/newline
          options = s.split(/[\n,;|]/).map((o) => o.trim()).filter(Boolean);
        }
      }
    }
    // Detectar marcador de opção correta embutido na string da opção
    // Suportados: prefixo '*', sufixo '*', '[c]', '(c)', '[correct]', '#correct', sufixo '|correct'
    let correctFromMarker = -1;
    const cleanedOptions = options.map((label, i) => {
      let cleaned = label;
      let isCorrect = false;
      if (/^\s*\*/.test(cleaned)) { isCorrect = true; cleaned = cleaned.replace(/^\s*\*\s*/, ''); }
      if (/\*\s*$/.test(cleaned)) { isCorrect = true; cleaned = cleaned.replace(/\s*\*\s*$/, ''); }
      if (/\[(c|ok|correct)\]/i.test(cleaned)) { isCorrect = true; cleaned = cleaned.replace(/\s*\[(?:c|ok|correct)\]\s*/ig, ''); }
      if (/\((c|ok|correct)\)/i.test(cleaned)) { isCorrect = true; cleaned = cleaned.replace(/\s*\((?:c|ok|correct)\)\s*/ig, ''); }
      if (/#correct/i.test(cleaned)) { isCorrect = true; cleaned = cleaned.replace(/\s*#correct\s*/ig, ''); }
      if (/\|\s*correct\s*$/i.test(cleaned)) { isCorrect = true; cleaned = cleaned.replace(/\|\s*correct\s*$/ig, ''); }
      if (isCorrect && correctFromMarker === -1) correctFromMarker = i;
      return cleaned.trim();
    });
    options = cleanedOptions;
    const rawPublic: any = (api as any).is_public;
    const is_public = typeof rawPublic === 'boolean' ? rawPublic : Number(rawPublic) === 1;
    // Propagar config e incluir índice correto se detectado pelo marcador
    const baseConfig: any = (api as any).config ?? {};
    const config = { ...baseConfig };
    const topCorrect = (api as any).correct_option_index;
    if (typeof topCorrect === 'number' && topCorrect >= 0) {
      config.correct_option_index = Math.floor(topCorrect);
    }
    if (correctFromMarker >= 0 && typeof config.correct_option_index !== 'number') {
      config.correct_option_index = correctFromMarker;
    }
    // Mapear limite de seleção múltipla a partir do campo top-level `max_choices`
    const topMaxChoices = (api as any).max_choices;
    if (typeof topMaxChoices === 'number' && topMaxChoices >= 0) {
      config.max_selected_options = Math.floor(topMaxChoices);
    }
    // Preservar preseleções vindas do backend (ex.: selected_labels)
    const selectedLabels: any = (api as any).selected_labels;
    if (Array.isArray(selectedLabels) && selectedLabels.length > 0) {
      try {
        config.prefill_labels = selectedLabels.map((x: any) => String(x).trim()).filter((s: string) => !!s);
      } catch {
        config.prefill_labels = (selectedLabels as any[]).map((x: any) => String(x).trim()).filter((s: string) => !!s);
      }
    }
    // Preservar preseleção específica de rating (ex.: selected_value)
    const selectedValueRaw: any = (api as any).selected_value;
    if (selectedValueRaw !== undefined && selectedValueRaw !== null) {
      const num = typeof selectedValueRaw === 'number' ? selectedValueRaw : Number(String(selectedValueRaw).trim());
      if (!isNaN(num)) {
        config.prefill_rating_value = Math.floor(num);
      }
    }
    return {
      id: api.id,
      text,
      type,
      options,
      is_required: api.is_required ?? true,
      show_results: api.show_results ?? true,
      order_index: api.order_index ?? 0,
      is_public,
      config,
    };
  }

  // ================================
  // Responses API Methods
  // ================================
  getEventResponses(idOrCode: string | number, params?: ListResponsesParams): Observable<ApiResponseItem[]> {
    // Listagem de respostas é no namespace público, mesmo autenticado
    const headers: HttpHeaders = new HttpHeaders({});
    const base = `${this.API_BASE_URL.replace('/api/v1', '')}/api/public/v1/events/${idOrCode}/responses`;

    const query = new URLSearchParams();
    if (params?.question_id) query.set('question_id', String(params.question_id));
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));
    if (params?.search) query.set('search', params.search);

    const url = `${base}${query.toString() ? `?${query.toString()}` : ''}`;
    return this.http.get<ListResponsesApiResponse>(url, { headers }).pipe(
      map((resp) => resp?.data?.responses ?? [])
    );
  }

  // ================================
  // Admin: Listagem de respondentes agregados
  // ================================
  /**
   * Lista convidados/usuários que enviaram respostas para o evento (visão administrativa).
   * Retorna itens agregados por respondente com campos como guest_code, submitted_at, user, answers.
   */
  getEventRespondentsAdmin(idOrCode: string | number, params?: { page?: number; page_size?: number; search?: string }): Observable<AdminRespondentItem[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const base = `${this.API_BASE_URL}/events/${idOrCode}/responses`;
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) {
      query.set('page_size', String(params.page_size));
      // compat: alguns endpoints usam "limit" na meta; enviamos ambos
      query.set('limit', String(params.page_size));
    }
    if (params?.search) query.set('search', params.search);
    const url = `${base}${query.toString() ? `?${query.toString()}` : ''}`;
    return this.http.get<AdminRespondentsApiResponse>(url, { headers }).pipe(
      map((resp) => resp?.data ?? [])
    );
  }

  // ================================
  // Novos endpoints: questions-with-answers e PATCH responses
  // ================================
  getQuestionsWithAnswers(idOrCode: string | number, guestCode?: string): Observable<QuestionWithAnswer[]> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const basePublic = this.API_BASE_URL.replace('/api/v1', '');
    const url = token
      ? `${this.API_BASE_URL}/events/${idOrCode}/questions-with-answers`
      : `${basePublic}/api/events/${idOrCode}/questions-with-answers${guestCode ? `?guest_code=${encodeURIComponent(guestCode)}` : ''}`;

    return this.http.get<any>(url, { headers }).pipe(
      map((resp) => {
        const raw = resp?.data?.questions ?? resp?.questions ?? [];
        return (raw as any[]).map((item) => {
          const q = this.normalizeQuestion(item?.question ?? item);
          const answer: ApiResponseItem | null = (item?.answer ?? (Array.isArray(item?.answers) ? item.answers[0] : null)) || null;
          return { question: q, answer } as QuestionWithAnswer;
        });
      })
    );
  }

  patchEventResponses(idOrCode: string | number, data: { guest_code?: string; selfie_url?: string; answers: AnswerItemPayload[] }): Observable<boolean> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const basePublic = this.API_BASE_URL.replace('/api/v1', '');
    const url = token
      ? `${this.API_BASE_URL}/events/${idOrCode}/responses`
      : `${basePublic}/api/events/${idOrCode}/responses`;

    const body = token
      ? ({ selfie_url: data.selfie_url, answers: data.answers } as SubmitResponsesAuthPayload)
      : ({ guest_code: data.guest_code!, selfie_url: data.selfie_url, answers: data.answers } as SubmitResponsesPublicPayload);

    return this.http.patch<SubmitResponsesResult>(url, body, { headers }).pipe(
      map((resp) => !!resp?.success)
    );
  }

  submitEventResponses(idOrCode: string | number, data: { guest_code?: string; selfie_url?: string; answers: AnswerItemPayload[] }): Observable<boolean> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = token
      ? `${this.API_BASE_URL}/events/${idOrCode}/responses`
      : `${this.API_BASE_URL.replace('/api/v1', '')}/api/public/v1/events/${idOrCode}/responses`;

    const body = token
      ? ({ selfie_url: data.selfie_url, answers: data.answers } as SubmitResponsesAuthPayload)
      : ({ guest_code: data.guest_code!, selfie_url: data.selfie_url, answers: data.answers } as SubmitResponsesPublicPayload);

    return this.http.post<SubmitResponsesResult>(url, body, { headers }).pipe(
      map((resp) => !!resp?.success)
    );
  }

  // Versão bruta: retorna o objeto completo (inclui response_id)
  submitEventResponseRaw(idOrCode: string | number, data: { guest_code?: string; selfie_url?: string; answers: AnswerItemPayload[] }): Observable<SubmitResponsesResult> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = token
      ? `${this.API_BASE_URL}/events/${idOrCode}/responses`
      : `${this.API_BASE_URL.replace('/api/v1', '')}/api/public/v1/events/${idOrCode}/responses`;

    const body = token
      ? ({ selfie_url: data.selfie_url, answers: data.answers } as SubmitResponsesAuthPayload)
      : ({ guest_code: data.guest_code!, selfie_url: data.selfie_url, answers: data.answers } as SubmitResponsesPublicPayload);

    return this.http.post<SubmitResponsesResult>(url, body, { headers }).pipe(
      map((resp) => resp || { success: false })
    );
  }
  approveSongCandidate(eventId: string | number, jamId: string | number, songId: string | number, candidateId: string | number): Observable<boolean> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/${jamId}/songs/${songId}/candidates/${candidateId}/approve`;
    return this.http.post<{ success: boolean }>(url, {}, { headers }).pipe(map((resp) => !!resp?.success));
  }

  rejectSongCandidate(eventId: string | number, jamId: string | number, songId: string | number, candidateId: string | number): Observable<boolean> {
    const token = this.authService.getAuthToken();
    const headers: HttpHeaders = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    const url = `${this.API_BASE_URL}/events/${eventId}/jams/${jamId}/songs/${songId}/candidates/${candidateId}/reject`;
    return this.http.post<{ success: boolean }>(url, {}, { headers }).pipe(map((resp) => !!resp?.success));
  }
}
