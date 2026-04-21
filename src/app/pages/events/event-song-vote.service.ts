import { Injectable, inject } from '@angular/core';
import { LocalStorageService } from '../../shared/services/local-storage.service';

type VotesState = {
  version: 1;
  votes: Record<string, boolean>;
};

@Injectable({ providedIn: 'root' })
export class EventSongVoteService {
  private storage = inject(LocalStorageService);
  private readonly KEY = 'event_song_votes_v1';

  hasVoted(eventIdCode: string, songId: string | number): boolean {
    const key = this.voteKey(eventIdCode, songId);
    return !!this.load().votes[key];
  }

  toggleVote(eventIdCode: string, songId: string | number): boolean {
    const key = this.voteKey(eventIdCode, songId);
    const st = this.load();
    const current = !!st.votes[key];
    const next: VotesState = {
      version: 1,
      votes: { ...st.votes, [key]: !current },
    };
    this.storage.saveData(this.KEY, next);
    return !current;
  }

  private voteKey(eventIdCode: string, songId: string | number): string {
    return `${String(eventIdCode || '').trim()}:${String(songId || '').trim()}`;
  }

  private load(): VotesState {
    const raw = this.storage.getData<VotesState>(this.KEY);
    if (raw && raw.version === 1 && raw.votes && typeof raw.votes === 'object') return raw;
    return { version: 1, votes: {} };
  }
}

