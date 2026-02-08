import { Component, OnInit, ElementRef, ViewChild, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MusicSuggestionService, MusicSuggestion, Participant, FriendSearchResult } from '../music-suggestion/music-suggestion.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';

interface Friend { id: string; name: string; avatar: string }

@Component({
  selector: 'app-music-suggestions-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TranslateModule, ModalComponent],
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
export class MusicSuggestionsListComponent implements OnInit, OnDestroy {
  @Input() eventId: string = '';
  mySuggestions: MusicSuggestion[] = [];
  invitesForMe: MusicSuggestion[] = [];
  acceptedSuggestions: MusicSuggestion[] = [];
  editingSuggestion: MusicSuggestion | null = null;
  
  // Delete Modal
  isDeleteModalOpen = false;
  suggestionToDelete: MusicSuggestion | null = null;

  // Remove Participant Modal
  isRemoveParticipantModalOpen = false;
  participantToRemove: { userId: string, name: string } | null = null;
  suggestionForParticipantRemoval: string | null = null;

  @ViewChild('scrollArea') scrollArea?: ElementRef<HTMLDivElement>;
  
  // Inline Create Form
  isCreating = false;
  createForm: FormGroup;
  // Invite Logic
  friendQuery = '';
  friends: Friend[] = [];
  selectedFriendId = '';
  selectedFriendInstrument = '';
  isInviteFormOpen = false; // Progressive Disclosure state

  instrumentOptions = [
    'voz', 'guitarra', 'violao', 'baixo', 'teclado', 'bateria', 'percussao', 'metais', 'cordas', 'outro'
  ];
  
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private suggestionService: MusicSuggestionService,
    private authService: AuthService,
    private fb: FormBuilder,
    private toastService: ToastService
  ) {
    this.createForm = this.fb.group({
      song_name: ['', Validators.required],
      artist_name: ['', Validators.required],
      my_instrument: ['', Validators.required],
      invites: this.fb.array([])
    });
  }

  ngOnInit(): void {
    if (this.eventId) {
      this.suggestionService.loadSuggestions(this.eventId);
    }

    // Setup search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => this.suggestionService.searchFriends(query, this.eventId)),
      takeUntil(this.destroy$)
    ).subscribe((users: FriendSearchResult[]) => {
      this.friends = users.map(u => ({
        id: u.user_id,
        name: u.name,
        avatar: u.avatar_url || ''
      }));
    });

    // Subscribe to suggestions
    this.suggestionService.suggestions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(suggestions => {
        const currentUser = this.authService.getCurrentUser();
        if (!currentUser) return;
        const userId = currentUser.id.toString();
        
        this.mySuggestions = suggestions.filter(s => String(s.created_by_user_id) === userId);
        this.invitesForMe = suggestions.filter(s => 
            String(s.created_by_user_id) !== userId && 
            s.participants.some(p => String(p.user_id) === userId && p.status === 'PENDING')
        );
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get mockUserId() {
    return this.authService.getCurrentUser()?.id.toString() || '';
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
    
    // Check for duplicates
    const isDuplicate = this.invites.value.some((inv: any) => inv.user_id === this.selectedFriendId);
    if (isDuplicate) {
      this.toastService.triggerToast('warning', 'Usuário duplicado', 'Este usuário já foi adicionado.');
      this.clearSelection();
      return;
    }

    const friend = this.friends.find(f => f.id === this.selectedFriendId);
    if (!friend) return;

    this.invites.push(this.fb.group({
      user_id: [friend.id],
      name: [friend.name],
      avatar: [friend.avatar],
      instrument: [this.selectedFriendInstrument]
    }));

    this.clearSelection();
  }

  private clearSelection() {
    this.selectedFriendId = '';
    this.selectedFriendInstrument = '';
    this.friendQuery = '';
    this.friends = []; // Clear search results to reset the list
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
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    if (this.editingSuggestion) {
      const updated: Partial<MusicSuggestion> = {
        id: this.editingSuggestion.id,
        song_name: formVal.song_name,
        artist_name: formVal.artist_name,
        // Backend handles participants update logic or we send minimal fields
      };
      
      this.suggestionService.updateSuggestion(updated).subscribe({
        next: () => {
          this.toastService.triggerToast('success', 'Sugestão atualizada', 'Sua sugestão foi atualizada com sucesso.');
          this.editingSuggestion = null;
          this.toggleCreate();
        },
        error: (err) => this.toastService.triggerToast('error', 'Erro ao atualizar', err.message || 'Não foi possível atualizar a sugestão.')
      });
    } else {
      const payload = {
        event_id: this.eventId,
        song_name: formVal.song_name,
        artist_name: formVal.artist_name,
        my_instrument: formVal.my_instrument,
        invites: formVal.invites.map((inv: any) => ({
          user_id: inv.user_id,
          instrument: inv.instrument
        }))
      };
      
      this.suggestionService.addSuggestion(payload).subscribe({
        next: () => {
          this.toastService.triggerToast('success', 'Sugestão criada', 'Sua sugestão foi criada com sucesso.');
          this.toggleCreate();
        },
        error: (err) => this.toastService.triggerToast('error', 'Erro ao criar', err.message || 'Não foi possível criar a sugestão.')
      });
    }
  }
  
  onImageError(event: any) {
    event.target.src = '/images/user/default-avatar.jpg';
  }

  getSuggestionStatus(s: MusicSuggestion): { labelKey: string, class: string } {
    if (s.status === 'APPROVED') return { labelKey: 'events.guestV2.suggestions.status.approved', class: 'bg-green-500/20 text-green-500' };
    if (s.status === 'REJECTED') return { labelKey: 'events.guestV2.suggestions.status.rejected', class: 'bg-red-500/20 text-red-500' };
    if (s.status === 'SUBMITTED') return { labelKey: 'events.guestV2.suggestions.status.submitted', class: 'bg-blue-500/20 text-blue-500' };
    
    // DRAFT
    const hasPending = s.participants.some(p => p.status === 'PENDING');
    if (hasPending) {
        return { labelKey: 'events.guestV2.suggestions.status.waitingFriends', class: 'bg-indigo-500/20 text-indigo-400' };
    }
    return { labelKey: 'events.guestV2.suggestions.status.waitingApproval', class: 'bg-purple-500/20 text-purple-500' };
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

  openDeleteModal(suggestion: MusicSuggestion) {
    this.suggestionToDelete = suggestion;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.suggestionToDelete = null;
  }

  confirmDelete() {
    if (!this.suggestionToDelete) return;
    
    const id = this.suggestionToDelete.id;
    this.suggestionService.deleteSuggestion(id).subscribe({
      next: () => {
        this.toastService.triggerToast('success', 'Sugestão excluída', 'A sugestão foi removida com sucesso.');
        this.closeDeleteModal();
      },
      error: (err) => {
        this.toastService.triggerToast('error', 'Erro ao excluir', err.message || 'Não foi possível excluir a sugestão.');
        this.closeDeleteModal();
      }
    });
  }

  removeParticipantFromSuggestion(suggestionId: string, userId: string) {
    // Legacy method signature kept for compatibility if needed, but redirected to modal logic if name unavailable
    // Ideally update template to pass name. For now, let's find the name.
    const s = this.mySuggestions.find(ms => ms.id === suggestionId);
    const p = s?.participants.find(part => (part.user_id_code || String(part.user_id)) === userId);
    this.openRemoveParticipantModal(suggestionId, userId, p?.name || 'Participante');
  }

  openRemoveParticipantModal(suggestionId: string, userId: string, userName: string) {
    this.suggestionForParticipantRemoval = suggestionId;
    this.participantToRemove = { userId, name: userName };
    this.isRemoveParticipantModalOpen = true;
  }

  closeRemoveParticipantModal() {
    this.isRemoveParticipantModalOpen = false;
    this.participantToRemove = null;
    this.suggestionForParticipantRemoval = null;
  }

  confirmRemoveParticipant() {
    if (!this.suggestionForParticipantRemoval || !this.participantToRemove) return;

    const suggestionId = this.suggestionForParticipantRemoval;
    const userId = this.participantToRemove.userId;

    this.suggestionService.removeParticipant(suggestionId, userId).subscribe({
      next: () => {
          this.toastService.triggerToast('success', 'Participante removido', 'O participante foi removido da sugestão.');
          // Update local state
          const s = this.mySuggestions.find(ms => ms.id === suggestionId);
          if (s) {
              s.participants = s.participants.filter(p => (p.user_id_code || String(p.user_id)) !== userId);
          }
          this.closeRemoveParticipantModal();
      },
      error: (err) => {
        this.toastService.triggerToast('error', 'Erro ao remover', err.message || 'Não foi possível remover o participante.');
        this.closeRemoveParticipantModal();
      }
    });
  }

  submitSuggestion(suggestionId: string) {
    const s = this.mySuggestions.find(ms => ms.id === suggestionId);
    if (!s || !this.canSubmitSuggestion(s)) {
      this.toastService.triggerToast('warning', 'Ação necessária', 'Ainda há convidados pendentes ou rejeitados. Remova-os ou aguarde aceitação.');
      return;
    }
    this.suggestionService.submitSuggestion(suggestionId).subscribe({
      next: () => this.toastService.triggerToast('success', 'Sugestão enviada', 'Sugestão enviada! A banda irá analisar.'),
      error: (err) => this.toastService.triggerToast('error', 'Erro ao enviar', err.message || 'Não foi possível enviar a sugestão.')
    });
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
    const userId = this.authService.getCurrentUser()?.id.toString();
    // Find the participant entry for the current user
    const myParticipant = suggestion.participants.find(p => String(p.user_id) === userId);
    return myParticipant ? myParticipant.instrument : 'outro';
  }

  getMyParticipantStatus(suggestion: MusicSuggestion): string {
    const userId = this.authService.getCurrentUser()?.id.toString();
    const p = suggestion.participants.find(p => String(p.user_id) === userId);
    return p ? p.status : '';
  }

  getInvitees(s: MusicSuggestion): Participant[] {
    return (s?.participants || []).filter(p => !p.is_creator);
  }

  canSubmitSuggestion(s: MusicSuggestion): boolean {
    const invitees = (s?.participants || []).filter(p => !p.is_creator);
    return invitees.every(p => p.status === 'ACCEPTED');
  }

  acceptInvite(suggestionId: string) {
    const userId = this.authService.getCurrentUser()?.id.toString() || '';
    this.suggestionService.acceptInvite(suggestionId, userId).subscribe({
        next: () => {
            this.toastService.triggerToast('success', 'Convite aceito', 'Você aceitou o convite para tocar nesta música.');
            
            // Update local state
            const inviteIndex = this.invitesForMe.findIndex(s => s.id === suggestionId);
            if (inviteIndex !== -1) {
                const suggestion = this.invitesForMe[inviteIndex];
                
                // Update participant status
                const participant = suggestion.participants.find(p => String(p.user_id) === userId);
                if (participant) {
                    participant.status = 'ACCEPTED';
                }

                // Move to accepted list
                this.invitesForMe.splice(inviteIndex, 1);
                this.acceptedSuggestions.unshift(suggestion);
            }
        },
        error: (err) => this.toastService.triggerToast('error', 'Erro ao aceitar', err.message || 'Não foi possível aceitar o convite.')
    });
  }

  rejectInvite(suggestionId: string) {
    const userId = this.authService.getCurrentUser()?.id.toString() || '';
    this.suggestionService.rejectInvite(suggestionId, userId).subscribe({
        next: () => {
            this.toastService.triggerToast('success', 'Convite recusado', 'Você recusou o convite.');
            
            // Remove from list immediately
            this.invitesForMe = this.invitesForMe.filter(s => s.id !== suggestionId);
        },
        error: (err) => this.toastService.triggerToast('error', 'Erro ao recusar', err.message || 'Não foi possível recusar o convite.')
    });
  }

  getFilteredFriends(): any[] {
    // This is now handled by the search subscription and local `friends` state
    return this.friends; 
  }

  trackFriend(index: number, f: Friend) { return f?.id; }

  onFriendQueryChange(val: string) {
    this.friendQuery = val;
    this.selectedFriendId = '';
    this.searchSubject.next(val);
  }

  selectFriend(friend: Friend) {
    this.selectedFriendId = friend?.id || '';
    this.friendQuery = friend?.name || '';
  }

  getFriendById(id: string): Friend | null {
    return this.friends.find(f => f.id === id) || null;
  }
}
