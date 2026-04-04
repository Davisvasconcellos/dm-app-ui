import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ElementRef, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EventService, ApiGuest } from '../event.service';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';
import { InputFieldComponent } from '../../../shared/components/form/input/input-field.component';
import { AuthService } from '../../../shared/services/auth.service';
import { ThemeService } from '../../../shared/services/theme.service';
import { ImageUploadService } from '../../../shared/services/image-upload.service';

@Component({
  selector: 'app-event-checkin',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, InputFieldComponent],
  templateUrl: './checkin.component.html',
  styleUrls: ['./checkin.component.css']
})
export class CheckinComponent implements OnInit, OnDestroy {
  idCode = '';
  displayName = '';
  email = '';
  phone = '';
  selfieUrl = '';
  uploadingSelfie = false;
  cameraLoading = false;
  submitting = false;
  submitError = '';
  submitSuccess = false;
  nameError = false;

  // Evento
  eventName: string = '';
  eventBannerUrl: string = '';
  // Fluxo
  autoCheckinFlowQuest: boolean = false;
  hasQuestions: boolean = false;

  // Câmera
  cameraOpen = false;
  mediaStream: MediaStream | null = null;
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private authService: AuthService,
    private themeService: ThemeService,
    private imageUploadService: ImageUploadService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Força tema escuro para esta rota
    this.themeService.setTheme('dark');

    // Prefill com dados do usuário autenticado
    const user = this.authService.getCurrentUser();
    if (user) {
      this.displayName = user.name || '';
      this.email = user.email || '';
      this.phone = user.phone || '';
    }

    this.route.paramMap.subscribe(pm => {
      this.idCode = pm.get('id_code') || '';
      if (this.idCode) {
        this.loadEventDetails(this.idCode);
        // Carregar flags do evento e existência de perguntas
        this.loadEventConfigAndQuestions(this.idCode);
        // Se já estiver autenticado, verificar se convidado já está checado para pular tela
        if (this.authService.isAuthenticated()) {
          this.precheckSkipIfAlreadyChecked(this.idCode);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  private loadEventDetails(idCode: string): void {
    // Usa o endpoint público para exibir card/banner sem exigir autenticação
    this.eventService.getPublicEventByIdCodeDetail(idCode).subscribe({
      next: (res: any) => {
        const ev = res?.event || res;
        this.eventName = ev?.title || ev?.name || '';
        this.eventBannerUrl = ev?.banner_url || ev?.image || '';
        try {
          console.log('[CHECKIN][Detalhes] Recebido', { idCode, title: this.eventName, banner: !!this.eventBannerUrl });
        } catch {}
      },
      error: () => {
        // Silencioso: banner/nome são complementares
      }
    });
  }

  private loadEventConfigAndQuestions(idCode: string): void {
    try {
      console.log('[CHECKIN][Config] Início', { idCode, esperado: { auto_checkin_flow_quest: true, perguntas: '> 0' } });
    } catch {}
    this.eventService.getEventByIdCodeDetail(idCode).subscribe({
      next: ({ event }) => {
        const autoFlowRaw = (event as any)?.auto_checkin_flow_quest;
        this.autoCheckinFlowQuest = typeof autoFlowRaw === 'boolean' ? autoFlowRaw : (Number(autoFlowRaw) === 1);
        const fromEvent = Array.isArray((event as any)?.questions) ? (event as any).questions : [];
        try {
          console.log('[CHECKIN][Config] Recebido do /events/:id_code', {
            idCode,
            recebido: {
              auto_checkin_flow_quest_raw: autoFlowRaw,
              auto_checkin_flow_quest: this.autoCheckinFlowQuest,
              perguntas_event_len: fromEvent?.length || 0,
            }
          });
        } catch {}
        if (fromEvent && fromEvent.length > 0) {
          this.hasQuestions = true;
          try {
            console.log('[CHECKIN][Config] Perguntas detectadas no evento (fromEvent)', { perguntas_event_len: fromEvent.length });
          } catch {}
        } else {
          this.hasQuestions = false;
          try {
            console.log('[CHECKIN][Config] Sem perguntas inline no evento. Não verificarei públicas aqui.');
          } catch {}
        }
      },
      error: () => {
        this.autoCheckinFlowQuest = false;
        this.hasQuestions = false;
        try {
          console.log('[CHECKIN][Config] Erro ao carregar /events/:id_code', { idCode });
        } catch {}
      }
    });
  }

  private decidePostCheckinDestination(returnUrl?: string): void {
    try {
      console.log('[CHECKIN][Destino] Início decisão pós-checkin', { idCode: this.idCode, returnUrl });
    } catch {}
    if (returnUrl) {
      try { console.log('[CHECKIN][Destino] Navegando via returnUrl', { returnUrl }); } catch {}
      this.router.navigateByUrl(returnUrl);
      return;
    }
    const routeParamId = this.route.snapshot.paramMap.get('id_code') || '';
    const queryParamId = this.route.snapshot.queryParamMap.get('id_code') || '';
    let returnUrlId = '';
    try {
      const pattern = /events\/(?:home-guest|answer|answer-plain)\/([A-Za-z0-9-]+)/;
      const match = (this.route.snapshot.queryParamMap.get('returnUrl') || '').match(pattern);
      returnUrlId = match ? match[1] : '';
    } catch {}
    const idCode = this.idCode || routeParamId || queryParamId || returnUrlId;
    if (!idCode) {
      const fallbackId = queryParamId || returnUrlId;
      try { console.log('[CHECKIN][Destino] idCode ausente. Redirecionando home-guest com fallback', { fallbackId }); } catch {}
      if (fallbackId) this.router.navigate([`/events/home-guest`], { queryParams: { id_code: fallbackId } });
      else this.router.navigate([`/events/home-guest`]);
      return;
    }
    this.eventService.getEventByIdCodeDetail(idCode).subscribe({
      next: ({ event }) => {
        const autoRaw = (event as any)?.auto_checkin_flow_quest;
        const requiresAutoQuest = typeof autoRaw === 'boolean' ? autoRaw : (Number(autoRaw) === 1);
        try {
          console.log('[CHECKIN][Destino] Recebido /events/:id_code', {
            idCode,
            recebido: {
              auto_checkin_flow_quest_raw: autoRaw,
              auto_checkin_flow_quest: requiresAutoQuest,
            }
          });
        } catch {}

        if (!requiresAutoQuest) {
          try { console.log('[CHECKIN][Destino] auto_checkin_flow_quest=false. Redirecionando home-guest-v2 com id_code'); } catch {}
          this.rememberRecentEvent(idCode);
          this.router.navigate([`/events/home-guest-v2/${idCode}`]);
          return;
        }
        // Fluxo simplificado: se flag true, abre questionário sem layout; caso contrário, home-guest.
        try { console.log('[CHECKIN][Destino] Flag auto_checkin_flow_quest=true. Navegando para answer-plain (sem layout)'); } catch {}
        this.rememberRecentEvent(idCode);
        this.router.navigate([`/events/answer-plain/${idCode}`]);
      },
      error: () => {
        try { console.log('[CHECKIN][Destino] Erro ao carregar /events/:id_code. Navegando home-guest-v2 com id_code', { idCode }); } catch {}
        this.rememberRecentEvent(idCode);
        this.router.navigate([`/events/home-guest-v2/${idCode}`]);
      }
    });
  }

  private rememberRecentEvent(idCode: string): void {
    try {
      const key = 'events_recent';
      const raw = localStorage.getItem(key);
      const prev = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(prev) ? prev.map((x) => String(x)).filter(Boolean) : [];
      const next = [idCode, ...list.filter((x) => x !== idCode)].slice(0, 12);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  }

  private precheckSkipIfAlreadyChecked(idCode: string): void {
    this.eventService.getEventGuestMe(idCode).subscribe({
      next: (guest) => {
        const isChecked = !!guest?.check_in_at;
        try { console.log('[CHECKIN][Pré-skip] guest.me recebido', { idCode, isChecked, check_in_at: guest?.check_in_at }); } catch {}
        if (isChecked) {
          // Se já checado, não exibir tela de check-in
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || undefined;
          try { console.log('[CHECKIN][Pré-skip] Convidado já checado. Decidindo destino.', { returnUrl }); } catch {}
          this.decidePostCheckinDestination(returnUrl);
        }
      },
      error: () => {
        // Silencioso: sem convidado atual, segue fluxo normal
        try { console.log('[CHECKIN][Pré-skip] Erro guest.me. Mantendo tela de check-in.', { idCode }); } catch {}
      }
    });
  }

  onNameChange(value: string | number): void {
    this.displayName = String(value);
    this.nameError = !this.displayName?.trim();
  }

  onEmailChange(value: string | number): void {
    this.email = String(value);
  }

  onPhoneChange(value: string | number): void {
    this.phone = String(value);
  }

  onSubmit(): void {
    if (!this.idCode) return;
    this.nameError = !this.displayName?.trim();
    if (this.nameError) {
      this.submitError = 'Por favor, informe como prefere ser chamado.';
      return;
    }
    this.submitting = true;
    this.submitError = '';
    this.eventService.postEventCheckin(this.idCode, {
      display_name: this.displayName || undefined,
      email: this.email || undefined,
      phone: this.phone || undefined,
      selfie_url: this.selfieUrl || undefined,
      document: null
    }).subscribe({
      next: ({ guest, checked_in }) => {
        this.submitting = false;
        this.submitSuccess = checked_in;
        try { console.log('[CHECKIN][Submit] Resposta check-in', { idCode: this.idCode, checked_in, guest_id: guest?.id, guest }); } catch {}
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || undefined;
        if (checked_in) {
          try { console.log('[CHECKIN][Submit] Check-in confirmado. Decidindo destino.', { returnUrl }); } catch {}
          this.decidePostCheckinDestination(returnUrl);
        }
      },
      error: (err) => {
        this.submitting = false;
        this.submitError = err?.error?.message || 'Falha ao realizar check-in.';
        try { console.log('[CHECKIN][Submit] Erro no check-in', { idCode: this.idCode, error: this.submitError }); } catch {}
      }
    });
  }

  // ---- Selfie com câmera ----
  async triggerCamera(): Promise<void> {
    await this.startCamera();
  }

  private async startCamera(): Promise<void> {
    try {
      this.cameraOpen = true;
      this.cameraLoading = true;
      this.cdr.detectChanges();
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      const videoEl = this.videoRef?.nativeElement;
      if (videoEl && this.mediaStream) {
        videoEl.srcObject = this.mediaStream;
        // Em alguns dispositivos (iOS), é necessário mutar para permitir autoplay
        videoEl.muted = true;
        await videoEl.play();
        this.cameraLoading = false;
        this.cdr.detectChanges();
      }
    } catch (err) {
      this.cameraOpen = false;
      this.cameraLoading = false;
      this.cdr.detectChanges();
      this.submitError = 'Não foi possível acessar a câmera.';
    }
  }

  stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.cameraOpen = false;
  }

  async captureSelfie(): Promise<void> {
    const videoEl = this.videoRef?.nativeElement;
    const canvasEl = this.canvasRef?.nativeElement;
    if (!videoEl || !canvasEl || !this.idCode) return;

    // Ajusta canvas ao tamanho do vídeo e desenha o frame atual
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

    // Preview imediato para evitar sensação de travamento
    try {
      this.selfieUrl = canvasEl.toDataURL('image/jpeg', 0.9);
      this.uploadingSelfie = true;
      this.cdr.detectChanges();
    } catch {}

    // Fecha a câmera imediatamente após capturar o frame
    this.stopCamera();

    // Converte para Blob e faz upload
    canvasEl.toBlob(async (blob) => {
      if (!blob) {
        this.submitError = 'Não foi possível capturar a imagem.';
        return;
      }
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      try {
        const slugName = this.slugify(this.eventName);
        const folderPath = `events/${this.idCode}_${slugName}/guests`;
        
        const res = await this.imageUploadService.uploadImage(
          file,
          'event-selfie',
          this.idCode,
          undefined,
          folderPath
        );
        if (res.success && res.filePath) {
          console.log('[CHECKIN][Selfie] URL recebida do novo método:', res.filePath);
          this.selfieUrl = res.filePath;
        } else {
          this.submitError = res.error || 'Falha ao enviar selfie.';
        }
      } catch (err: any) {
        this.submitError = err?.message || 'Erro ao processar selfie.';
      } finally {
        this.uploadingSelfie = false;
        this.cdr.detectChanges();
      }
    }, 'image/jpeg', 0.9);
  }

  private slugify(text: string): string {
    return (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim();
  }
}
