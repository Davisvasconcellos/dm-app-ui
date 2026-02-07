import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type SuggestionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type ParticipantStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface Participant {
  user_id: string;
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
  created_by_user_id: string;
  status: SuggestionStatus;
  participants: Participant[];
  created_at: number;
}

@Injectable({
  providedIn: 'root'
})
export class MusicSuggestionService {
  private suggestionsSubject = new BehaviorSubject<MusicSuggestion[]>([]);
  suggestions$ = this.suggestionsSubject.asObservable();

  // Mock current user (Simulating the logged in user for this context)
  currentUser = {
    id: 'user-123',
    name: 'Davis (Eu)',
    avatar: 'https://ui-avatars.com/api/?name=Davis&background=random'
  };

  // Mock friends
  mockFriends = [
    { id: 'user-456', name: 'Alice Bass', avatar: 'https://ui-avatars.com/api/?name=Alice&background=random' },
    { id: 'user-789', name: 'Bob Drums', avatar: 'https://ui-avatars.com/api/?name=Bob&background=random' },
    { id: 'user-101', name: 'Charlie Guitar', avatar: 'https://ui-avatars.com/api/?name=Charlie&background=random' },
    { id: 'user-202', name: 'Dave Keys', avatar: 'https://ui-avatars.com/api/?name=Dave&background=random' }
  ];

  constructor() {
    // Add some initial mock data
    this.addMockData();
  }

  private addMockData() {
    const initialData: MusicSuggestion[] = [
      {
        id: 'sugg-1',
        song_name: 'Hotel California',
        artist_name: 'Eagles',
        created_by_user_id: 'user-123',
        status: 'DRAFT',
        created_at: Date.now(),
        participants: [
          { user_id: 'user-123', name: 'Davis (Eu)', instrument: 'violao', is_creator: true, status: 'ACCEPTED' },
          { user_id: 'user-456', name: 'Alice Bass', instrument: 'baixo', is_creator: false, status: 'ACCEPTED' }
        ]
      },
       {
        id: 'sugg-2',
        song_name: 'Come Together',
        artist_name: 'The Beatles',
        created_by_user_id: 'user-789', // Created by Bob
        status: 'DRAFT',
        created_at: Date.now() - 100000,
        participants: [
          { user_id: 'user-789', name: 'Bob Drums', instrument: 'bateria', is_creator: true, status: 'ACCEPTED' },
          { user_id: 'user-123', name: 'Davis (Eu)', instrument: 'voz', is_creator: false, status: 'PENDING' } // Invite for me
        ]
      },
      {
        id: 'sugg-3',
        song_name: 'Wonderwall',
        artist_name: 'Oasis',
        created_by_user_id: 'user-123',
        status: 'DRAFT',
        created_at: Date.now() - 200000,
        participants: [
          { user_id: 'user-123', name: 'Davis (Eu)', instrument: 'voz e violao', is_creator: true, status: 'ACCEPTED' }
        ]
      }
    ];
    this.suggestionsSubject.next(initialData);
  }

  addSuggestion(suggestion: MusicSuggestion) {
    const current = this.suggestionsSubject.value;
    this.suggestionsSubject.next([suggestion, ...current]);
  }

  updateSuggestion(updated: MusicSuggestion) {
    const current = this.suggestionsSubject.value;
    const index = current.findIndex(s => s.id === updated.id);
    if (index !== -1) {
      current[index] = updated;
      this.suggestionsSubject.next([...current]);
    }
  }

  deleteSuggestion(id: string) {
    const current = this.suggestionsSubject.value;
    this.suggestionsSubject.next(current.filter(s => s.id !== id));
  }

  // Helper to get friends list
  getFriends() {
    return this.mockFriends;
  }

  // Actions
  acceptInvite(suggestionId: string, userId: string) {
    const suggestion = this.suggestionsSubject.value.find(s => s.id === suggestionId);
    if (suggestion) {
      const participant = suggestion.participants.find(p => p.user_id === userId);
      if (participant) {
        participant.status = 'ACCEPTED';
        this.updateSuggestion(suggestion);
      }
    }
  }

  rejectInvite(suggestionId: string, userId: string) {
    const suggestion = this.suggestionsSubject.value.find(s => s.id === suggestionId);
    if (suggestion) {
        // If rejected, maybe remove or just set status? User said "creator can remove invite", implying rejection stays until removed?
        // Let's set status to REJECTED
      const participant = suggestion.participants.find(p => p.user_id === userId);
      if (participant) {
        participant.status = 'REJECTED';
        this.updateSuggestion(suggestion);
      }
    }
  }

  removeParticipant(suggestionId: string, userId: string) {
    const suggestion = this.suggestionsSubject.value.find(s => s.id === suggestionId);
    if (suggestion) {
      suggestion.participants = suggestion.participants.filter(p => p.user_id !== userId);
      this.updateSuggestion(suggestion);
    }
  }

  submitSuggestion(suggestionId: string) {
    const suggestion = this.suggestionsSubject.value.find(s => s.id === suggestionId);
    if (suggestion) {
      suggestion.status = 'SUBMITTED';
      this.updateSuggestion(suggestion);
    }
  }
}
