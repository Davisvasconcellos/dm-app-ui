import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ModalComponent } from '../../../../../shared/components/ui/modal/modal.component';
import { MusicSuggestion, MusicSuggestionService, FriendSearchResult } from '../../../music-suggestion/music-suggestion.service';
import { DiscogsService, DiscogsResult } from '../../../../../shared/services/discogs.service';
import { AuthService } from '../../../../../shared/services/auth.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';
import { ToastService } from '../../../../../shared/services/toast.service';

@Component({
  selector: 'app-music-suggestion-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TranslateModule, ModalComponent],
  templateUrl: './music-suggestion-modal.component.html',
  styles: [`
    :host {
      display: contents;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #1a1a1a;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #333;
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
  `]
})
export class MusicSuggestionModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() suggestion: MusicSuggestion | null = null;
  @Input() users: any[] = []; // Available users to add as guests (pre-loaded or searchable)
  @Input() eventId: string = ''; // Required for friend search

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

  form: FormGroup;
  participants: any[] = [];

  // Discogs Search
  searchMusicControl = new FormControl('');
  musicResults: DiscogsResult[] = [];
  selectedMusic: DiscogsResult | null = null;
  isSearchingMusic = false;

  // Instrument slots logic
  instrumentOptions = ['voz', 'violao', 'guitarra', 'baixo', 'bateria', 'teclado', 'percussao', 'sopro', 'outros'];
  instrumentSlots: Record<string, number> = {};

  // Add Guest logic
  friendQuery = '';
  friends: any[] = [];
  isInviteFormOpen = false;
  selectedGuestId = '';
  selectedGuestName = '';
  selectedGuestAvatar = '';
  selectedGuestInstrument = '';

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private discogsService: DiscogsService,
    private suggestionService: MusicSuggestionService,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    this.form = this.fb.group({
      song_name: ['', Validators.required],
      artist_name: ['', Validators.required]
    });
  }

  toggleInstrumentSlot(instrument: string) {
    const current = this.instrumentSlots[instrument] || 0;
    const next = (current + 1) % 6; // Loop 0-5
    if (next === 0) {
      delete this.instrumentSlots[instrument];
    } else {
      this.instrumentSlots[instrument] = next;
    }
  }

  getSlotCount(instrument: string): number {
    return this.instrumentSlots[instrument] || 0;
  }

  hasSelectedSlots(): boolean {
    return Object.values(this.instrumentSlots).some((v) => Number(v) > 0);
  }

  canSubmit(): boolean {
    return this.form.valid && (this.hasSelectedSlots() || this.hasParticipantInstruments());
  }

  private hasParticipantInstruments(): boolean {
    return (this.participants || []).some(p => !!p?.instrument);
  }

  ngOnInit() {
    // Setup music search
    this.searchMusicControl.valueChanges.pipe(
      debounceTime(1000),
      distinctUntilChanged(),
      switchMap(query => {
        this.isSearchingMusic = !!query && query.length >= 2;
        if (!this.isSearchingMusic) {
           this.musicResults = [];
           return [];
        }
        return this.discogsService.search(query || '');
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (results) => {
        this.musicResults = results;
        this.isSearchingMusic = false;
      },
      error: () => {
        this.musicResults = [];
        this.isSearchingMusic = false;
      }
    });

    // Setup friend search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) return [];
        return this.suggestionService.searchFriends(query, this.eventId);
      }),
      takeUntil(this.destroy$)
    ).subscribe((users: FriendSearchResult[]) => {
      this.friends = users.map(u => ({
        id: u.user_id,
        name: u.name,
        avatar: u.avatar_url || '/images/user/default-avatar.jpg'
      }));
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      if (this.suggestion) {
        this.populateForm(this.suggestion);
      } else {
        this.resetForm();
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  resetForm() {
    this.form.reset();
    this.participants = [];
    this.searchMusicControl.setValue('', { emitEvent: false });
    this.selectedMusic = null;
    this.musicResults = [];
    this.instrumentSlots = {};
    this.isInviteFormOpen = false;
    this.resetGuestSelection();
  }

  resetGuestSelection() {
    this.selectedGuestId = '';
    this.selectedGuestName = '';
    this.selectedGuestAvatar = '';
    this.selectedGuestInstrument = '';
    this.friendQuery = '';
    this.friends = [];
  }

  populateForm(suggestion: MusicSuggestion) {
    this.form.patchValue({
      song_name: suggestion.song_name,
      artist_name: suggestion.artist_name
    });

    this.participants = suggestion.participants ? [...suggestion.participants] : [];

    // Reset and populate slots if available (future proofing, currently manual slots might be inferred or stored elsewhere)
    this.instrumentSlots = {};
    // If suggestion has slots data, we would populate it here.
    // For now, we assume slots are derived from participants or stored separately if we add that field to MusicSuggestion.
    // But since we are reusing MusicSuggestion interface which might not have 'slots' property explicitly mapped yet
    // we'll leave it empty or try to map if provided in 'any'.
    if ((suggestion as any).instrument_slots) {
       (suggestion as any).instrument_slots.forEach((s: any) => {
          this.instrumentSlots[s.instrument] = s.slots;
       });
    }

    // Set selected music for display if cover exists
    if (suggestion.cover_image) {
      this.selectedMusic = {
        id: 0,
        title: `${suggestion.artist_name} - ${suggestion.song_name}`,
        thumb: suggestion.cover_image,
        cover_image: suggestion.cover_image,
        year: ''
      };
    }
  }

  // Discogs Logic
  selectMusic(music: DiscogsResult) {
    this.selectedMusic = music;
    this.musicResults = [];

    let artist = 'Desconhecido';
    let song = music.title;

    if (music.title.includes(' - ')) {
      const parts = music.title.split(' - ');
      artist = parts[0];
      song = parts.slice(1).join(' - ');
    }

    this.form.patchValue({
      song_name: song,
      artist_name: artist
    });
  }

  clearSelectedMusic() {
    this.selectedMusic = null;
    this.form.patchValue({
      song_name: '',
      artist_name: ''
    });
    this.searchMusicControl.setValue('');
  }

  onAlbumImageError(event: any) {
    event.target.src = '/images/default-album.png';
  }

  // Participant Logic
  onFriendSearch(query: string) {
    this.friendQuery = query;
    this.searchSubject.next(query);
  }

  selectFriend(friend: any) {
    this.selectedGuestId = friend.id;
    this.selectedGuestName = friend.name;
    this.selectedGuestAvatar = friend.avatar;
    this.friendQuery = friend.name;
    this.friends = []; // Clear results
  }

  addParticipant() {
    if (this.selectedGuestId && this.selectedGuestInstrument) {
      // Check if already added
      const exists = this.participants.find(p => p.user_id === this.selectedGuestId);
      if (exists) {
        this.toastService.triggerToast('warning', 'Usuário duplicado', 'Este usuário já foi adicionado.');
        this.resetGuestSelection();
        return;
      }

      this.participants.push({
        user_id: this.selectedGuestId,
        name: this.selectedGuestName,
        avatar: this.selectedGuestAvatar,
        instrument: this.selectedGuestInstrument,
        status: 'PENDING',
        is_creator: false
      });

      this.resetGuestSelection();
    }
  }

  removeParticipant(index: number) {
    this.participants.splice(index, 1);
  }

  getInstrumentType(instrument: string): string {
    const norm = (instrument || '').toLowerCase().trim();
    if (norm.includes('voz') || norm.includes('vocal') || norm.includes('cantor') || norm.includes('mic')) return 'voz';
    if (norm.includes('guitarra') || norm.includes('guitar') || norm.includes('violão') || norm.includes('acoustic')) return 'guitarra';
    if (norm.includes('baixo') || norm.includes('bass')) return 'baixo';
    if (norm.includes('bateria') || norm.includes('drums') || norm.includes('cajon')) return 'bateria';
    if (norm.includes('teclado') || norm.includes('piano') || norm.includes('synth') || norm.includes('keys')) return 'teclado';
    if (norm.includes('percuss') || norm.includes('shaker') || norm.includes('pandeiro')) return 'percussao';
    if (norm.includes('metais') || norm.includes('sax') || norm.includes('trompete') || norm.includes('trombone') || norm.includes('flauta') || norm.includes('sopro')) return 'metais';
    if (norm.includes('violino') || norm.includes('cello') || norm.includes('viola') || norm.includes('cordas')) return 'cordas';
    return 'outros';
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!(this.hasSelectedSlots() || this.hasParticipantInstruments())) {
      this.toastService.triggerToast('warning', 'Selecione instrumentos', 'Adicione ao menos um slot ou um convidado com instrumento.');
      return;
    }

    const formValue = this.form.value;

    // Generate final slots: Manual Slots + Participants
    // We want to keep the manual counts as the base, and ensure we have enough slots for participants?
    // Or just sum them?
    // Usually, if I set "2 Guitars" and add 1 Guitarist, I still need 1 more Guitar.
    // So 'slots' usually represents the TOTAL vacancies or TOTAL positions?
    // In DM-APP, 'slots' usually means "Total spots for this instrument".
    // If I add a participant, they consume a slot.
    // So if I want 2 Guitars TOTAL, and I have 1 participant, I set slots=2.
    // BUT, the 'instrumentSlots' UI is "Add Empty Slots" or "Define Total Slots"?
    // The user said "slots com os badges tocando".
    // Let's assume the badge number is the TOTAL desired count for that instrument (including any participants added manually?).
    // OR is it "Empty Slots to be filled"?
    // "podemos selecionar vários instrumentos... badges tocando"
    // Let's assume it's "Vacancies" (Open Slots) or "Required Instruments".
    // If I click Guitar -> 1. I want 1 Guitar.
    // If I add a friend (Guitar), do I increment this?
    // If I add a friend, the system knows there is 1 Guitarist.
    // If I also click Guitar icon (1), does it mean 1 MORE guitar (total 2) or 1 Guitar Total?
    // Given the context of "Admin", they probably define the *structure*.
    // Let's assume the badge count = "Additional/Open Slots" OR "Total Structure".
    // Let's treat them as "Open Slots" (Vacancies) effectively, but the backend expects "Total Slots" maybe?
    // Let's look at 'jam-kanban.component.ts' onMusicModalSave.
    // It says:
    // instrument_slots: Object.entries(data.slots || {}).map(([inst, count]) => ({ instrument: inst, slots: count }))
    // And for Create:
    // instrument_slots: ... map ... slots: count
    // And THEN it adds participants.
    // If I say "Guitar: 2" and add 1 Participant.
    // The backend usually treats 'instrument_slots' as the DEFINITION of the song's lineup.
    // So if I have 2 Guitars defined, and 1 Participant, that means 1 is taken, 1 is free.
    // So the badge should represent the TOTAL slots for that instrument.
    // However, if I add a participant, the system should probably auto-increment the slot count for that instrument to at least cover the participant?
    // Or should I manually set it?
    // Safest bet: Merge.
    // Final Slots = Max(Manual_Count, Count_of_Participants_for_Inst).
    // OR Sum?
    // If I have 1 friend (Guitar) and I want 1 MORE, I should probably set badge to 2? Or badge to 1 (meaning 1 empty)?
    // Let's assume the badge is "Total Slots" for simplicity in Admin.
    // If I add a participant, I should probably make sure the slot count is at least that high.

    // Let's merge:
    const finalSlots: Record<string, number> = { ...this.instrumentSlots };

    // Ensure slots exist for all participants
    this.participants.forEach(p => {
        const inst = p.instrument;
        if (inst) {
            const current = finalSlots[inst] || 0;
            // If the manual count is lower than the number of participants, bump it up?
            // Or just treat manual count as "Extra"?
            // Let's just Add them to be safe? No, double counting is bad.
            // Let's assume manual count is "Total Desired".
            // If I have 3 participants and manual says 0, it should be 3.
            // If I have 0 participants and manual says 2, it should be 2.
            // If I have 1 participant and manual says 2, it should be 2.
            // So: Max(Manual, ParticipantCount)?
            // Actually, let's just sum them for now if the user thinks "Badge = Vacancies".
            // But usually "Badge = Total".
            // Let's simply combine them:
            // The previous logic was: slots[inst] = (slots[inst] || 0) + 1 (just counting participants).
            // Now we have manual slots.
            // Let's use the manual slots as the base, and add any participants that aren't accounted for?
            // Let's just send both or merge carefully.
            // Let's simply sum them:
            // Count from Participants
            const participantCounts: Record<string, number> = {};
            this.participants.forEach(p => {
               if(p.instrument) participantCounts[p.instrument] = (participantCounts[p.instrument] || 0) + 1;
            });

            // Merge:
            // If I set Guitar=2 manually, and have 1 Guitarist. I probably mean 2 Total.
            // If I set Guitar=0 manually, and have 1 Guitarist. I mean 1 Total.
            // If I set Guitar=1 manually (thinking it means 1 OPEN slot) and have 1 Guitarist.
            // This ambiguity is tricky.
            // Let's assume Badge = "Total Spots".
            // So we take the Max of (Badge, ParticipantCount).

            // Actually, the user said "slots com os badges tocando".
            // Let's just take the Manual Slots as "Requested Vacancies" on top of participants?
            // "Quero adicionar uma música, com 1 Guitarra e 1 Baixo (vagos), e já colocar o Fulano na Bateria".
            // So: Guitar=1 (Badge), Bass=1 (Badge), Drums=1 (Participant).
            // Result: Guitar: 1, Bass: 1, Drums: 1.
            // So it seems like Sum is the right approach if Badge = "Open/Wanted".
            // Let's go with SUM.
            // Final Slots = Manual_Badge_Count + Participant_Count.

            if (inst) {
               // We will calculate this after the loop
            }
        }
    });

    const participantCounts: Record<string, number> = {};
    this.participants.forEach(p => {
       if(p.instrument) participantCounts[p.instrument] = (participantCounts[p.instrument] || 0) + 1;
    });

    Object.entries(participantCounts).forEach(([inst, count]) => {
        finalSlots[inst] = (finalSlots[inst] || 0) + count;
    });

    // NOTE: This assumes Badge = "Extra Slots / Vacancies".
    // If Badge = "Total Slots", this would be wrong.
    // Given the UI "click to add", it usually implies adding *more*.
    // So "Sum" feels intuitive for "Building a band".

    const payload = {
      ...formValue,
      participants: this.participants,
      slots: finalSlots,
      cover_image: this.selectedMusic?.cover_image || this.selectedMusic?.thumb || null,
      catalog_id: this.selectedMusic?.id || null
    };

    if (this.suggestion) {
      payload.id = this.suggestion.id;
    }

    this.save.emit(payload);
  }
}
