import { Component, EventEmitter, Output, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MusicSuggestionService, Participant, MusicSuggestion } from './music-suggestion.service';
import { AuthService } from '../../../shared/services/auth.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-music-suggestion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TranslateModule],
  templateUrl: './music-suggestion.component.html',
  styleUrls: ['./music-suggestion.component.css']
})
export class MusicSuggestionComponent implements OnInit, OnChanges {
  @Input() suggestionToEdit: MusicSuggestion | null = null;
  @Output() close = new EventEmitter<void>();

  suggestionForm: FormGroup;
  step = 1;
  friends: any[] = [];
  selectedFriendId: string = '';
  selectedFriendInstrument: string = '';

  instrumentOptions = ['voz', 'violao', 'guitarra', 'baixo', 'bateria', 'teclado', 'percussao', 'sopro', 'outros'];

  constructor(
    private fb: FormBuilder,
    private suggestionService: MusicSuggestionService,
    private authService: AuthService
  ) {
    this.suggestionForm = this.fb.group({
      song_name: ['', Validators.required],
      artist_name: ['', Validators.required],
      my_instrument: ['', Validators.required],
      invites: this.fb.array([])
    });
  }

  ngOnInit() {
    this.friends = [];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['suggestionToEdit'] && this.suggestionToEdit) {
      this.populateForm(this.suggestionToEdit);
    }
  }

  populateForm(suggestion: MusicSuggestion) {
    this.suggestionForm.patchValue({
      song_name: suggestion.song_name,
      artist_name: suggestion.artist_name
    });

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    const myParticipant = suggestion.participants.find(p => p.user_id === currentUser.id.toString());
    if (myParticipant) {
      this.suggestionForm.patchValue({
        my_instrument: myParticipant.instrument
      });
    }

    // Clear existing invites
    while (this.invites.length !== 0) {
      this.invites.removeAt(0);
    }

    // Add other participants as invites
    const others = suggestion.participants.filter(p => p.user_id !== currentUser.id);
    others.forEach(p => {
      this.invites.push(this.fb.group({
        user_id: [p.user_id],
        name: [p.name],
        avatar: [p.avatar],
        instrument: [p.instrument],
        status: [p.status]
      }));
    });
  }

  get invites() {
    return this.suggestionForm.get('invites') as FormArray;
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

  addInvite() {
    if (this.selectedFriendId && this.selectedFriendInstrument) {
      const friend = this.friends.find(f => f.id === this.selectedFriendId);
      if (friend) {
        this.invites.push(this.fb.group({
          user_id: [friend.id],
          name: [friend.name],
          avatar: [friend.avatar],
          instrument: [this.selectedFriendInstrument],
          status: ['PENDING']
        }));
        this.selectedFriendId = '';
        this.selectedFriendInstrument = '';
      }
    }
  }

  removeInvite(index: number) {
    this.invites.removeAt(index);
  }

  nextStep() {
    if (this.step === 1 && (this.suggestionForm.get('song_name')?.invalid || this.suggestionForm.get('artist_name')?.invalid)) {
      this.suggestionForm.markAllAsTouched();
      return;
    }
    if (this.step === 2 && this.suggestionForm.get('my_instrument')?.invalid) {
        this.suggestionForm.markAllAsTouched();
        return;
    }
    this.step++;
  }

  prevStep() {
    this.step--;
  }

  submit() {
    if (this.suggestionForm.invalid) return;

    const formValue = this.suggestionForm.value;
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    const participants: Participant[] = [
      {
        user_id: currentUser.id.toString(),
        name: currentUser.name,
        avatar: currentUser.avatar,
        instrument: formValue.my_instrument,
        is_creator: true,
        status: 'ACCEPTED'
      },
      ...formValue.invites.map((invite: any) => ({
        user_id: invite.user_id,
        name: invite.name,
        avatar: invite.avatar,
        instrument: invite.instrument,
        is_creator: false,
        status: invite.status || 'PENDING'
      }))
    ];

    if (this.suggestionToEdit) {
      const updatedSuggestion: Partial<MusicSuggestion> = {
        id: this.suggestionToEdit.id,
        song_name: formValue.song_name,
        artist_name: formValue.artist_name,
        // Backend handles participants logic usually, or send minimal
      };
      this.suggestionService.updateSuggestion(updatedSuggestion).subscribe();
    } else {
      const newSuggestion: Partial<MusicSuggestion> = {
        song_name: formValue.song_name,
        artist_name: formValue.artist_name,
        participants: participants
      };
      this.suggestionService.addSuggestion(newSuggestion).subscribe();
    }

    this.close.emit();
  }
}
