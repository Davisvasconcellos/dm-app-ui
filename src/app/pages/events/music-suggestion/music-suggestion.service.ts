import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService, User } from '../../../shared/services/auth.service';

export type SuggestionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type ParticipantStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface Participant {
  user_id: string;
  user_id_code?: string;
  name: string;
  avatar?: string;
  instrument: string;
  is_creator: boolean;
  status: ParticipantStatus;
}

export interface MusicSuggestion {
  id: string;
  song_name: string;
  artist_name: string;
  cover_image?: string;
  created_by_user_id: string;
  status: SuggestionStatus;
  participants: Participant[];
  created_at: number | string;
  creator?: {
    id: string | number;
    id_code: string;
    name: string;
    avatar_url: string;
  };
}

export interface FriendSearchResult {
  user_id: string;
  name: string;
  avatar_url: string;
  guest_id: string;
  check_in_at: string;
}

export interface CreateSuggestionPayload {
  event_id: string;
  song_name: string;
  artist_name: string;
  cover_image?: string;
  my_instrument: string;
  invites?: {
    user_id: string;
    instrument: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class MusicSuggestionService {
  private readonly API_URL = `${environment.apiUrl}/api/v1/music-suggestions`;
  private suggestionsSubject = new BehaviorSubject<MusicSuggestion[]>([]);
  suggestions$ = this.suggestionsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  loadSuggestions(eventId?: string, status?: string) {
    let params = new HttpParams();
    if (eventId) {
      params = params.set('event_id', eventId);
    }
    if (status) {
      params = params.set('status', status);
    }
    
    this.http.get<{success: boolean, data: any[]}>(this.API_URL, { params }).subscribe({
      next: (response) => {
        const data = (response.data || []).map(s => this.mapSuggestion(s));
        this.suggestionsSubject.next(data);
      },
      error: (err) => console.error('Error loading suggestions', err)
    });
  }

  addSuggestion(payload: CreateSuggestionPayload): Observable<MusicSuggestion> {
    return this.http.post<{success: boolean, data: any}>(this.API_URL, payload).pipe(
      map(response => this.mapSuggestion(response.data)),
      tap(newSuggestion => {
        const current = this.suggestionsSubject.value;
        this.suggestionsSubject.next([newSuggestion, ...current]);
      })
    );
  }

  updateSuggestion(suggestion: Partial<MusicSuggestion>): Observable<MusicSuggestion> {
    if (!suggestion.id) throw new Error('Suggestion ID is required for update');
    return this.http.put<MusicSuggestion>(`${this.API_URL}/${suggestion.id}`, suggestion).pipe(
      tap(updated => this.updateLocalState(updated))
    );
  }

  deleteSuggestion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`).pipe(
      tap(() => {
        const current = this.suggestionsSubject.value;
        this.suggestionsSubject.next(current.filter(s => s.id !== id));
      })
    );
  }

  submitSuggestion(id: string): Observable<MusicSuggestion> {
    return this.http.post<MusicSuggestion>(`${this.API_URL}/${id}/submit`, {}).pipe(
      tap(updated => this.updateLocalState(updated))
    );
  }

  // Participants
  addParticipant(suggestionId: string, userId: string, instrument: string): Observable<MusicSuggestion> {
    return this.http.post<MusicSuggestion>(`${this.API_URL}/${suggestionId}/participants`, { user_id: userId, instrument }).pipe(
      tap(updated => this.updateLocalState(updated))
    );
  }

  removeParticipant(suggestionId: string, userId: string): Observable<MusicSuggestion> {
    return this.http.delete<MusicSuggestion>(`${this.API_URL}/${suggestionId}/participants/${userId}`).pipe(
      tap(updated => this.updateLocalState(updated))
    );
  }

  acceptInvite(suggestionId: string, userId: string): Observable<MusicSuggestion> {
    return this.respondInvite(suggestionId, 'ACCEPTED');
  }

  rejectInvite(suggestionId: string, userId: string): Observable<MusicSuggestion> {
    return this.respondInvite(suggestionId, 'REJECTED');
  }

  private respondInvite(suggestionId: string, status: 'ACCEPTED' | 'REJECTED'): Observable<MusicSuggestion> {
    return this.http.patch<MusicSuggestion>(`${this.API_URL}/${suggestionId}/participants/me/status`, { status }).pipe(
      tap(updated => this.updateLocalState(updated))
    );
  }

  searchFriends(query: string, eventId: string): Observable<FriendSearchResult[]> {
    let params = new HttpParams().set('q', query);
    if (eventId) {
      params = params.set('event_id', eventId);
    }
    return this.http.get<{success: boolean, data: FriendSearchResult[]}>(`${this.API_URL}/friends`, { params }).pipe(
      map(response => response.data || [])
    );
  }

  private updateLocalState(updatedRaw: any) {
    const updated = this.mapSuggestion(updatedRaw);
    const current = this.suggestionsSubject.value;
    const index = current.findIndex(s => s.id === updated.id);
    if (index !== -1) {
      current[index] = updated;
      this.suggestionsSubject.next([...current]);
    }
  }

  private mapSuggestion(s: any): MusicSuggestion {
    return {
      ...s,
      participants: (s.participants || []).map((p: any) => ({
        ...p,
        user_id: p.user_id.toString(),
        user_id_code: p.user?.id_code,
        name: p.user?.name || p.name || 'Unknown',
        avatar: p.user?.avatar_url || p.avatar || '/images/user/default-avatar.jpg',
        instrument: p.instrument
      }))
    };
  }
}
