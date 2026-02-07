import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MusicSuggestionService, MusicSuggestion, Participant } from '../music-suggestion/music-suggestion.service';

interface Friend { id: string; name: string; avatar: string }

@Component({
  selector: 'app-music-suggestions-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TranslateModule],
  templateUrl: './music-suggestions-list.component.html',
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
  `]
})
export class MusicSuggestionsListComponent implements OnInit {
  mySuggestions: MusicSuggestion[] = [];
  invitesForMe: MusicSuggestion[] = [];
  editingSuggestion: MusicSuggestion | null = null;
  @ViewChild('scrollArea') scrollArea?: ElementRef<HTMLDivElement>;
  
  // Inline Create Form
  isCreating = false;
  createForm: FormGroup;
  instrumentOptions = ['Voz', 'Guitarra', 'Baixo', 'Cordas', 'Bateria', 'Percussão', 'Teclado', 'Metais', 'Outros'];
  friends: Friend[] = [];
  selectedFriendId = '';
  selectedFriendInstrument = '';
  friendQuery = '';

  constructor(
    private suggestionService: MusicSuggestionService,
    private fb: FormBuilder
  ) {
    this.createForm = this.fb.group({
      song_name: ['', Validators.required],
      artist_name: ['', Validators.required],
      my_instrument: ['', Validators.required],
      invites: this.fb.array([])
    });
    this.friends = this.suggestionService.mockFriends;
  }

  ngOnInit(): void {
    // Subscribe to suggestions
    this.suggestionService.suggestions$.subscribe(suggestions => {
      const userId = this.suggestionService.currentUser.id;
      this.mySuggestions = suggestions.filter(s => s.created_by_user_id === userId);
      this.invitesForMe = suggestions.filter(s => 
          s.created_by_user_id !== userId && 
          s.participants.some(p => p.user_id === userId && p.status === 'PENDING')
      );
    });
  }

  get mockUserId() {
    return this.suggestionService.currentUser.id;
  }
  
  get invites() {
    return this.createForm.get('invites') as FormArray;
  }

  toggleCreate() {
    this.isCreating = !this.isCreating;
    if (!this.isCreating) {
      this.createForm.reset();
      this.invites.clear();
      this.selectedFriendId = '';
      this.selectedFriendInstrument = '';
      this.friendQuery = '';
    }
  }

  addInvite() {
    if (!this.selectedFriendId || !this.selectedFriendInstrument) return;
    
    const friend = this.friends.find(f => f.id === this.selectedFriendId);
    if (!friend) return;

    this.invites.push(this.fb.group({
      user_id: [friend.id],
      name: [friend.name],
      avatar: [friend.avatar],
      instrument: [this.selectedFriendInstrument]
    }));

    this.selectedFriendId = '';
    this.selectedFriendInstrument = '';
    this.friendQuery = '';
  }

  removeInvite(index: number) {
    this.invites.removeAt(index);
  }

  saveSuggestion() {
    if (this.createForm.invalid) {
        this.createForm.markAllAsTouched();
        return;
    }

    const formVal = this.createForm.value;
    const currentUser = this.suggestionService.currentUser;

    if (this.editingSuggestion) {
      const updated: MusicSuggestion = {
        ...this.editingSuggestion,
        song_name: formVal.song_name,
        artist_name: formVal.artist_name,
        participants: [
          {
            user_id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            instrument: formVal.my_instrument,
            is_creator: true,
            status: 'ACCEPTED'
          },
          ...formVal.invites.map((inv: any) => ({
            user_id: inv.user_id,
            name: inv.name,
            avatar: inv.avatar,
            instrument: inv.instrument,
            is_creator: false,
            status: 'PENDING'
          }))
        ]
      };
      this.suggestionService.updateSuggestion(updated);
    } else {
      const newSuggestion: MusicSuggestion = {
        id: 'sugg-' + Date.now(),
        song_name: formVal.song_name,
        artist_name: formVal.artist_name,
        created_by_user_id: currentUser.id,
        status: 'DRAFT',
        created_at: Date.now(),
        participants: [
          {
            user_id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            instrument: formVal.my_instrument,
            is_creator: true,
            status: 'ACCEPTED'
          },
          ...formVal.invites.map((inv: any) => ({
            user_id: inv.user_id,
            name: inv.name,
            avatar: inv.avatar,
            instrument: inv.instrument,
            is_creator: false,
            status: 'PENDING'
          }))
        ]
      };
      this.suggestionService.addSuggestion(newSuggestion);
    }
    this.editingSuggestion = null;
    this.toggleCreate();
  }
  
  onImageError(event: any) {
    event.target.src = '/images/user/default-avatar.jpg';
  }

  getSuggestionStatus(s: MusicSuggestion): { label: string, class: string } {
    if (s.status === 'APPROVED') return { label: 'Aprovada', class: 'bg-green-500/20 text-green-500' };
    if (s.status === 'REJECTED') return { label: 'Recusada', class: 'bg-red-500/20 text-red-500' };
    if (s.status === 'SUBMITTED') return { label: 'Aguardando Banda', class: 'bg-blue-500/20 text-blue-500' };
    
    // DRAFT
    const hasPending = s.participants.some(p => p.status === 'PENDING');
    if (hasPending) {
        return { label: 'Aguardando Amigos', class: 'bg-indigo-500/20 text-indigo-400' };
    }
    return { label: 'Rascunho', class: 'bg-yellow-500/20 text-yellow-500' };
  }

  getSuggestionBorderClass(s: MusicSuggestion): string {
    if (s.status === 'APPROVED') return 'border-t-green-500';
    if (s.status === 'REJECTED') return 'border-t-red-500';
    if (s.status === 'SUBMITTED') return 'border-t-blue-500';
    const hasPending = s.participants.some(p => p.status === 'PENDING');
    if (hasPending) return 'border-t-indigo-500';
    return 'border-t-yellow-500';
  }

  getInviteSender(suggestion: MusicSuggestion): Participant | null {
    const creator = suggestion.participants.find(p => p.is_creator);
    return creator || suggestion.participants[0] || null;
  }

  editSuggestion(suggestion: MusicSuggestion) {
    this.editingSuggestion = suggestion;
    this.isCreating = true;
    this.createForm.patchValue({
      song_name: suggestion.song_name,
      artist_name: suggestion.artist_name,
      my_instrument: suggestion.participants.find(p => p.user_id === this.mockUserId)?.instrument || ''
    });
    this.invites.clear();
    const others = suggestion.participants.filter(p => p.user_id !== this.mockUserId);
    others.forEach(p => {
      this.invites.push(this.fb.group({
        user_id: [p.user_id],
        name: [p.name],
        avatar: [p.avatar],
        instrument: [p.instrument]
      }));
    });
    setTimeout(() => {
      const el = this.scrollArea?.nativeElement;
      if (el && typeof el.scrollTo === 'function') {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 0);
  }

  deleteSuggestion(id: string) {
    if (confirm('Tem certeza que deseja excluir esta sugestão?')) {
      this.suggestionService.deleteSuggestion(id);
    }
  }

  removeParticipantFromSuggestion(suggestionId: string, userId: string) {
    if (confirm('Remover este participante?')) {
      this.suggestionService.removeParticipant(suggestionId, userId);
    }
  }

  submitSuggestion(suggestionId: string) {
    const s = this.mySuggestions.find(ms => ms.id === suggestionId);
    if (!s || !this.canSubmitSuggestion(s)) {
      alert('Ainda há convidados pendentes ou rejeitados. Remova-os ou aguarde aceitação.');
      return;
    }
    this.suggestionService.submitSuggestion(suggestionId);
    alert('Sugestão enviada! A banda irá analisar.');
  }

  getInstrumentType(instrument: string): string {
    const norm = (instrument || '').toLowerCase().trim();

    // 1. Voz
    if (norm.includes('voz') || norm.includes('vocal') || norm.includes('cantor') || norm.includes('mic')) return 'voz';
    
    // 2. Guitarra
    if (norm.includes('guitarra') || norm.includes('guitar') || norm.includes('violão') || norm.includes('violao') || norm.includes('acoustic')) return 'guitarra';
    
    // 3. Baixo
    if (norm.includes('baixo') || norm.includes('bass')) return 'baixo';
    
    // 4. Teclado
    if (norm.includes('teclado') || norm.includes('piano') || norm.includes('key') || norm.includes('synth') || norm.includes('orgão')) return 'teclado';
    
    // 5. Bateria
    if (norm.includes('bateria') || norm.includes('drum') || norm.includes('batera')) return 'bateria';
    
    // 6. Metais
    if (norm.includes('metais') || norm.includes('horn') || norm.includes('sax') || norm.includes('trompete') || norm.includes('trombone') || norm.includes('flauta') || norm.includes('wind')) return 'metais';
    
    // 7. Percussão
    if (norm.includes('percussão') || norm.includes('percussao') || norm.includes('percussion') || norm.includes('conga') || norm.includes('cajon') || norm.includes('pandeiro')) return 'percussao';
    
    // 8. Cordas
    if (norm.includes('cordas') || norm.includes('string') || norm.includes('violino') || norm.includes('cello') || norm.includes('viola')) return 'cordas';

    // 9. Outro (Default)
    if (norm.includes('outro') || norm.includes('outros')) return 'outro';
    return 'outro';
  }

  getInstrumentLabelFromType(type: string): string {
    const map: Record<string, string> = {
      voz: 'Voz',
      guitarra: 'Guitarra',
      baixo: 'Baixo',
      teclado: 'Teclado',
      bateria: 'Bateria',
      metais: 'Metais',
      percussao: 'Percussão',
      cordas: 'Cordas',
      outro: 'Outro'
    };
    return map[(type || '').toLowerCase()] || 'Outro';
  }

  getMyInviteInstrument(suggestion: MusicSuggestion): string {
    const userId = this.suggestionService.currentUser.id;
    // Find the participant entry for the current user
    const myParticipant = suggestion.participants.find(p => p.user_id === userId);
    return myParticipant ? myParticipant.instrument : 'outro';
  }

  getInvitees(s: MusicSuggestion): Participant[] {
    return (s?.participants || []).filter(p => !p.is_creator);
  }

  canSubmitSuggestion(s: MusicSuggestion): boolean {
    const invitees = (s?.participants || []).filter(p => !p.is_creator);
    return invitees.every(p => p.status === 'ACCEPTED');
  }

  acceptInvite(suggestionId: string) {
    const userId = this.suggestionService.currentUser.id;
    this.suggestionService.acceptInvite(suggestionId, userId);
  }

  rejectInvite(suggestionId: string) {
    const userId = this.suggestionService.currentUser.id;
    this.suggestionService.rejectInvite(suggestionId, userId);
  }

  getFilteredFriends(): any[] {
    const q = (this.friendQuery || '').toLowerCase().trim();
    if (!q) return [];
    return this.friends
      .filter(f => String(f.name || '').toLowerCase().includes(q))
      .slice(0, 8);
  }

  trackFriend(index: number, f: Friend) { return f?.id; }

  onFriendQueryChange(val: string) {
    this.friendQuery = val;
    this.selectedFriendId = '';
  }

  selectFriend(friend: Friend) {
    this.selectedFriendId = friend?.id || '';
    this.friendQuery = friend?.name || '';
  }

  getFriendById(id: string): Friend | null {
    return this.friends.find(f => f.id === id) || null;
  }
}
