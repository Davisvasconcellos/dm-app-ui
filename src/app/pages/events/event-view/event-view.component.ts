import { Component, OnInit, ApplicationRef, Injector, EnvironmentInjector, createComponent, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule, ApexAxisChartSeries, ApexChart, ApexPlotOptions, ApexDataLabels, ApexXAxis, ApexLegend, ApexYAxis } from 'ng-apexcharts';
import { PaginationWithIconComponent } from '../../../shared/components/tables/data-tables/table-one/pagination-with-icon/pagination-with-icon.component';
import { GuestCardModalComponent } from '../../../shared/components/modals/guest-card-modal/guest-card-modal.component';
import { EditGuestModalComponent } from '../../../shared/components/modals/edit-guest-modal/edit-guest-modal.component';
import { AddGuestModalComponent } from '../../../shared/components/modals/add-guest-modal/add-guest-modal.component';
import { NewGuestInput } from '../../../shared/components/modals/add-guest-modal/add-guest-modal.component';
import { CardSettingsComponent, CardSettings } from '../../../shared/components/cards/card-settings/card-settings.component';
import { NotificationComponent } from '../../../shared/components/ui/notification/notification/notification.component';
import { Guest } from '../../../shared/interfaces/guest.interface';
import { TranslateModule } from '@ngx-translate/core';
  import { EventService, ApiEvent, ApiGuest, CreateGuestBatchItem, GuestsStats, ApiResponseItem, AdminRespondentItem } from '../event.service';
import { ImageUploadService } from '../../../shared/services/image-upload.service';
import { AuthService } from '../../../shared/services/auth.service';

  interface TableRowData {
    id: number;
    user: { image: string | undefined; name: string };
    email: string;
    phone: string;
    status: 'Confirmado' | 'Pendente' | 'Cancelado';
    documentNumber?: string;
    guestType?: string;
    source?: string;
    rsvp?: boolean;
    rsvpAt?: string | null;
    checkin?: boolean;
    checkinAt?: string | null;
    checkinMethod?: string;
  }

interface EventData {
  id: number;
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  slug?: string;
  respName?: string;
  respEmail?: string;
  respPhone?: string;
  primaryColor: string;
  secondaryColor: string;
  showLogo: boolean;
  showQRCode: boolean;
  image: string;
  cardBackgroundType: 'gradient' | 'image';
  cardBackgroundImage?: string;
  // Auto-checkin config
  requiresAutoCheckin?: boolean;
  autoCheckinFlowQuest?: boolean; // true: questionário, false: home-guest
}

// Tipos para perguntas e respostas
type QuestionType = 'text' | 'single_choice' | 'multiple_choice' | 'poll';

interface AnswerItem {
  user: { id: number; image: string; name: string };
  value: string | string[];
}

interface QuestionItem {
  id: number;
  title: string;
  type: QuestionType;
  answers: AnswerItem[];
}

// Linhas para DataTable de respondentes
interface RespondentRowData {
  id_code?: string;
  user: { image?: string; name: string };
  email?: string;
  phone?: string;
  guest_code?: string;
  submittedAt?: string;
  answersCount: number;
}

@Component({
  selector: 'app-event-view',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, NgApexchartsModule, PaginationWithIconComponent, GuestCardModalComponent, EditGuestModalComponent, AddGuestModalComponent, CardSettingsComponent],
  templateUrl: './event-view.component.html',
  styleUrl: './event-view.component.css'
})
  export class EventViewComponent implements OnInit {
    activeTab: string = 'kpi_convidados';
    private eventIdCode?: string;
    isEventLoading: boolean = true;
    private imageFile?: File;
    private imageDirty: boolean = false;
    private bannerOriginalUrl?: string;
    private cardImageFile?: File;
    private cardImageDirty: boolean = false;
    private cardBackgroundOriginalUrl?: string;

  event: EventData = {
    id: 1,
    name: 'Festival de Música Vibehood',
    description: 'Três dias de música ao vivo com artistas renomados e talentos emergentes. Desfrute de diversos gêneros musicais, food trucks e uma atmosfera vibrante.',
    location: 'Parque Central da Cidade',
    startDate: '2024-06-15',
    endDate: '2024-06-17',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    showLogo: true,
    showQRCode: true,
    image: '/images/cards/event2.jpg',
    cardBackgroundType: 'image',
    cardBackgroundImage: '/images/cards/event3.jpg',
    requiresAutoCheckin: false,
    autoCheckinFlowQuest: true
  }

  private toBool(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      return v === 'true' || v === '1' || v === 't' || v === 'y' || v === 'yes';
    }
    return !!value;
  }

  // Configurações do cartão
  cardSettings: CardSettings = {
    backgroundType: 'image',
    backgroundImage: '/images/cards/event4.jpg',
    primaryColor: this.event.primaryColor,
    secondaryColor: this.event.secondaryColor,
    showLogo: this.event.showLogo,
    showQRCode: this.event.showQRCode
  };

  // Métodos do DataTable
  get filteredAndSortedData() {
    return this.tableData
      .filter((item) =>
        ((item.user?.name || '').toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        ((item.email || '').toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        ((item.phone || '').toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (item.guestType?.toLowerCase().includes(this.searchTerm.toLowerCase()) ?? false) ||
        (item.documentNumber?.toLowerCase().includes(this.searchTerm.toLowerCase()) ?? false)
      )
      .sort((a, b) => {
        let valueA: any, valueB: any;

        if (this.sortKey === 'name') {
          valueA = a.user?.name || '';
          valueB = b.user?.name || '';
        } else {
          valueA = a[this.sortKey as keyof TableRowData];
          valueB = b[this.sortKey as keyof TableRowData];
        }

        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return this.sortOrder === 'asc'
            ? valueA.localeCompare(valueB)
            : valueB.localeCompare(valueA);
        }

        return this.sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
      });
  }

  get totalItems() {
    return this.filteredAndSortedData.length;
  }

  get totalPages() {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  get startIndex() {
    return (this.currentPage - 1) * this.itemsPerPage;
  }

  get endIndex() {
    return Math.min(this.startIndex + this.itemsPerPage, this.totalItems);
  }

  get currentData() {
    return this.filteredAndSortedData.slice(this.startIndex, this.endIndex);
  }

  handlePageChange(page: number) {
    this.currentPage = page;
  }

  handleSort(key: string) {
    if (this.sortKey === key) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortOrder = 'asc';
    }
  }

  onItemsPerPageChange() {
    this.currentPage = 1;
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  };

  // Dados dos convidados adaptados para o DataTable
  tableData: TableRowData[] = [];

  guests: Guest[] = [];
  // KPIs
  guestStats?: GuestsStats;
  totalResponses: number = 0;

  // Modal properties
  isGuestCardModalOpen = false;
  isEditGuestModalOpen = false;
  isAddGuestModalOpen = false;
  selectedGuest: Guest | null = null;

  // Event data for modal
  eventData = {
    id: 1,
    name: this.event.name,
    description: this.event.description,
    location: this.event.location,
    startDate: this.event.startDate,
    endDate: this.event.endDate,
    primaryColor: this.event.primaryColor,
    secondaryColor: this.event.secondaryColor,
    showLogo: this.event.showLogo,
    showQRCode: this.event.showQRCode,
    image: this.event.image,
    cardBackgroundType: this.event.cardBackgroundType,
    cardBackgroundImage: this.event.cardBackgroundImage
  };

  // Propriedades do DataTable
  columns = [
    { key: 'name', label: 'Convidado' },
    { key: 'phone', label: 'Telefone' },
    { key: 'guestType', label: 'Tipo de convidado' },
    { key: 'rsvp', label: 'RSVP' },
    { key: 'checkin', label: 'Check-in' },
    { key: 'actions', label: 'Ações' }
  ];

  // Colunas para mobile (combinadas)
  mobileColumns = [
    { key: 'guest-info', label: 'Informações do Convidado' },
    { key: 'actions', label: 'Ações' }
  ];

  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortKey: string = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';
  searchTerm: string = '';
  isSaving: boolean = false;

  private respondentsRaw: AdminRespondentItem[] = [];
  respondentsTableData: RespondentRowData[] = [];
  respondentsCurrentPage: number = 1;
  respondentsItemsPerPage: number = 10;
  respondentsSearchTerm: string = '';
  saveMessage: string = '';
  saveError: string = '';

  // Toast state
  showToast: boolean = false;
  toastVariant: 'success' | 'info' | 'warning' | 'error' = 'success';
  toastTitle: string = '';
  toastDescription?: string;
  @ViewChild(AddGuestModalComponent) addGuestModal?: AddGuestModalComponent;
  @ViewChild(EditGuestModalComponent) editGuestModal?: EditGuestModalComponent;

  constructor(
    private route: ActivatedRoute,
    private eventService: EventService,
    private appRef: ApplicationRef,
    private injector: Injector,
    private envInjector: EnvironmentInjector,
    private imageUploadService: ImageUploadService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((pm) => {
      const idCode = pm.get('id_code');
      if (idCode) {
        this.resetEventState();
        this.eventIdCode = idCode;
        this.loadEvent(idCode);
        this.loadGuests(idCode);
        this.loadQuestions(idCode);
      }
    });
  }

  openAddGuestModal() {
    // Garantir que o modal abre com formulário limpo
    this.addGuestModal?.resetForm?.();
    this.isAddGuestModalOpen = true;
  }

  closeAddGuestModal() {
    // Ao fechar/cancelar, zera o formulário
    this.addGuestModal?.resetForm?.();
    this.isAddGuestModalOpen = false;
  }

  saveNewGuest(newGuest: NewGuestInput) {
    if (!this.eventIdCode) return;
    // Mapeia campos do modal para API conforme fluxo
    if (newGuest.checkin) {
      // Check-in imediato: POST /checkin/manual (não enviar email)
      const payload = {
        guest_name: newGuest.name,
        guest_phone: newGuest.phone,
        guest_document_type: newGuest.documentType,
        guest_document_number: newGuest.documentNumber,
        type: newGuest.guestType,
      };
      this.eventService.checkinManual(this.eventIdCode, payload).subscribe({
        next: (g) => {
          const normalizedImage = this.normalizeImageUrl(g?.avatar_url || undefined);
          const rsvpAtVal = this.normalizeDateString(g?.rsvp_at ?? null);
          const rsvpBoolRaw = g?.rsvp_confirmed !== undefined && g?.rsvp_confirmed !== null
            ? this.toBool(g?.rsvp_confirmed)
            : this.toBool(g?.rsvp);
          const rsvpBool = rsvpBoolRaw || !!rsvpAtVal;
          const checkInAt = this.normalizeDateString(g?.check_in_at ?? null);

          const guest: Guest = {
            id: g.id,
            name: g.display_name,
            email: g.email,
            phone: g.phone || '',
            image: normalizedImage,
            status: 'Confirmado'
          };
          this.guests = [guest, ...this.guests];

          const row: TableRowData = {
            id: g.id,
            user: { image: guest.image, name: guest.name },
            email: guest.email,
            phone: guest.phone,
            status: guest.status,
            documentNumber: g?.document?.number || '',
            guestType: g?.type || '',
            rsvp: rsvpBool,
            rsvpAt: rsvpAtVal,
            checkin: !!checkInAt,
            checkinAt: checkInAt
          };
          this.tableData = [row, ...this.tableData];
          // Fechar e zerar formulário, e recarregar lista para garantir sincronização
          this.addGuestModal?.resetForm?.();
          this.isAddGuestModalOpen = false;
          if (this.eventIdCode) { this.loadGuests(this.eventIdCode); }
          this.triggerToast('success', 'Check-in realizado', 'Convidado criado como walk_in e check-in efetuado.');
        },
        error: (err) => {
          let msg = (err?.error?.message || err?.message || 'Falha no check-in manual');
          switch (err?.status) {
            case 400: msg = 'Erro de validação: verifique os campos obrigatórios.'; break;
            case 403: msg = 'Acesso negado: verifique o token e permissões.'; break;
            case 404: msg = 'Evento não encontrado.'; break;
            case 409: {
              msg = err?.error?.message || 'Convidado duplicado por email/documento/usuário';
              this.handleDuplicateError('add', err);
              break;
            }
          }
          this.triggerToast('error', 'Erro no check-in', msg);
        }
      });
    } else {
      // Pré-lista: POST /guests (em lote)
      const item: CreateGuestBatchItem = {
        guest_name: newGuest.name,
        guest_email: newGuest.email,
        guest_phone: newGuest.phone,
        guest_document_type: newGuest.documentType,
        guest_document_number: newGuest.documentNumber,
        type: newGuest.guestType,
        source: 'invited' as const
      };
      this.eventService.createEventGuestsBatch(this.eventIdCode, [item]).subscribe({
        next: (guests) => {
          const g = guests[0];
          if (!g) {
            this.triggerToast('warning', 'Nenhum convidado criado', 'Resposta vazia da API.');
            return;
          }
          const normalizedImage = this.normalizeImageUrl(g?.avatar_url || undefined);
          const rsvpAtVal = this.normalizeDateString(g?.rsvp_at ?? null);
          const rsvpBoolRaw = g?.rsvp_confirmed !== undefined && g?.rsvp_confirmed !== null
            ? this.toBool(g?.rsvp_confirmed)
            : this.toBool(g?.rsvp);
          const rsvpBool = rsvpBoolRaw || !!rsvpAtVal;
          const checkInAt = this.normalizeDateString(g?.check_in_at ?? null);

          const guest: Guest = {
            id: g.id,
            name: g.display_name,
            email: g.email,
            phone: g.phone || '',
            image: normalizedImage,
            status: g.check_in_at ? 'Confirmado' : 'Pendente'
          };
          this.guests = [guest, ...this.guests];

          const row: TableRowData = {
            id: g.id,
            user: { image: guest.image, name: guest.name },
            email: guest.email,
            phone: guest.phone,
            status: guest.status,
            documentNumber: g?.document?.number || '',
            guestType: g?.type || '',
            rsvp: rsvpBool,
            rsvpAt: rsvpAtVal,
            checkin: !!checkInAt,
            checkinAt: checkInAt
          };
          this.tableData = [row, ...this.tableData];
          // Fechar e zerar formulário, e recarregar lista para garantir sincronização
          this.addGuestModal?.resetForm?.();
          this.isAddGuestModalOpen = false;
          if (this.eventIdCode) { this.loadGuests(this.eventIdCode); }
          this.triggerToast('success', 'Convidado adicionado', 'Pré-convidado cadastrado com sucesso.');
        },
        error: (err) => {
          let msg = (err?.error?.message || err?.message || 'Falha ao cadastrar convidado');
          switch (err?.status) {
            case 400: msg = 'Erro de validação: verifique os campos obrigatórios.'; break;
            case 403: msg = 'Acesso negado: verifique o token e permissões.'; break;
            case 404: msg = 'Evento não encontrado.'; break;
            case 409: {
              msg = err?.error?.message || 'Convidado duplicado por email/documento/usuário';
              this.handleDuplicateError('add', err);
              break;
            }
          }
          this.triggerToast('error', 'Erro ao adicionar convidado', msg);
        }
      });
    }
  }

  private resetEventState() {
    this.isEventLoading = true;
    this.event = {
      id: 0,
      name: '',
      description: '',
      location: '',
      startDate: '',
      endDate: '',
      slug: '',
      respName: '',
      respEmail: '',
      respPhone: '',
      primaryColor: '#3B82F6',
      secondaryColor: '#1E40AF',
      showLogo: true,
      showQRCode: true,
      image: '/images/cards/event2.jpg',
      cardBackgroundType: 'image',
      cardBackgroundImage: '/images/cards/event3.jpg'
    };
    this.cardSettings = {
      backgroundType: 'image',
      backgroundImage: '/images/cards/event4.jpg',
      primaryColor: this.event.primaryColor,
      secondaryColor: this.event.secondaryColor,
      showLogo: this.event.showLogo,
      showQRCode: this.event.showQRCode
    };
    this.guests = [];
  }

  private loadEvent(idCode: string) {
    this.eventService.getEventByIdCodeDetail(idCode).subscribe({
      next: ({ event: ev, total_responses }) => {
        const name = ev.name || ev.title || '';
        const description = ev.description ?? ev.details ?? '';
        const startIso = ev.start_datetime || ev.start_date || ev.startDate || '';
        const endIso = ev.end_datetime || ev.end_date || ev.endDate || '';
        const banner = this.normalizeImageUrl(ev.banner_url || ev.image || undefined) || '/images/cards/event2.jpg';
        const place = (ev as any).place || '';
        const color1 = (ev as any).color_1 || '#3B82F6';
        const color2 = (ev as any).color_2 || '#1E40AF';
        const cardBgRaw = (ev as any).card_background || this.event.cardBackgroundImage || '/images/cards/event3.jpg';
        const cardBg = this.normalizeImageUrl(cardBgRaw) || cardBgRaw;
        const bgTypeNum = (ev as any).card_background_type as number | null | undefined;
        const slug = (ev as any).slug || '';
        const respName = (ev as any).resp_name || '';
        const respEmail = (ev as any).resp_email || '';
        const respPhone = (ev as any).resp_phone || '';
        const id_code = (ev as any).id_code || idCode;
        const requiresAutoCheckin = this.toBool((ev as any).requires_auto_checkin);
        const autoCheckinFlowQuest = this.toBool((ev as any).auto_checkin_flow_quest);

        // Determina o tipo com fallbacks recomendados
        const hasImage = !!cardBg;
        const hasColors = !!(color1 && color2);
        let cardBackgroundType: 'gradient' | 'image' = 'image';
        if (bgTypeNum === 1) {
          cardBackgroundType = hasImage ? 'image' : (hasColors ? 'gradient' : 'image');
        } else if (bgTypeNum === 0) {
          cardBackgroundType = hasColors ? 'gradient' : (hasImage ? 'image' : 'gradient');
        } else {
          cardBackgroundType = hasImage ? 'image' : (hasColors ? 'gradient' : 'image');
        }

        this.event = {
          id: Number(ev.id) || 0,
          name,
          description,
          location: (place || '').trim(),
          startDate: this.toLocalDateTime(startIso),
          endDate: this.toLocalDateTime(endIso),
          slug,
          respName,
          respEmail,
          respPhone,
          primaryColor: color1,
          secondaryColor: color2,
          showLogo: true,
          showQRCode: true,
          image: banner,
          cardBackgroundType,
          cardBackgroundImage: cardBg,
          requiresAutoCheckin,
          autoCheckinFlowQuest
        };
        this.eventIdCode = id_code;
        this.bannerOriginalUrl = (ev.banner_url || ev.image || undefined) || undefined;
        this.cardBackgroundOriginalUrl = (ev as any).card_background || undefined;

        this.cardSettings = {
          backgroundType: cardBackgroundType,
          backgroundImage: cardBg,
          primaryColor: color1,
          secondaryColor: color2,
          showLogo: true,
          showQRCode: true
        };
        this.isEventLoading = false;
        this.totalResponses = Number(total_responses || 0);
      },
      error: (err) => {
        this.isEventLoading = false;
        const msg = (err?.error?.message || err?.message || 'Falha ao carregar evento');
        this.triggerToast('error', 'Erro ao carregar evento', msg);
      }
    });
  }

  private loadGuests(idCode: string) {
    this.eventService.getEventGuestsWithStats(idCode, { page: 1, page_size: 20 }).subscribe({
      next: ({ guests, stats }) => {
        // Mapear para o modelo Guest usado no componente
        this.guests = guests.map(g => ({
          id: g.id,
          name: g.display_name,
          email: g.email,
          phone: g.phone || '',
          image: this.normalizeImageUrl(g.avatar_url || undefined),
          status: g.check_in_at ? 'Confirmado' : 'Pendente',
          documentNumber: g?.document?.number || '',
          documentType: (g?.document?.type as ('rg' | 'cpf' | 'passport') | undefined) || 'rg',
          guestType: (g?.type as ('normal' | 'premium' | 'vip') | undefined) || 'normal'
        }));

        // Atualizar dados da tabela para DataTables
        this.tableData = this.guests.map(guest => {
          const g = guests.find(gg => gg.id === guest.id);
          const rsvpBoolRaw = g?.rsvp_confirmed !== undefined && g?.rsvp_confirmed !== null
            ? this.toBool(g?.rsvp_confirmed)
            : this.toBool(g?.rsvp);
          const rsvpAtVal = this.normalizeDateString(g?.rsvp_at ?? null);
          const rsvpBool = rsvpBoolRaw || !!rsvpAtVal;
          const checkInAt = this.normalizeDateString(g?.check_in_at ?? null);
          return {
            id: guest.id,
            user: { image: guest.image, name: guest.name },
            email: guest.email,
            phone: guest.phone,
            status: guest.status,
            documentNumber: g?.document?.number || '',
            guestType: g?.type || '',
            source: g?.source || '',
            rsvp: rsvpBool,
            rsvpAt: rsvpAtVal,
            checkin: !!checkInAt,
            checkinAt: checkInAt,
            checkinMethod: g?.check_in_method || ''
          } as TableRowData;
        });
        // Guardar KPIs de convidados
        this.guestStats = stats ? {
          total_guests: Number(stats.total_guests || 0),
          rsvp_count: Number(stats.rsvp_count || 0),
          checkin_count: Number(stats.checkin_count || 0)
        } : undefined;
      },
      error: (err) => {
        const msg = (err?.error?.message || err?.message || 'Falha ao carregar convidados');
        this.triggerToast('error', 'Erro ao carregar convidados', msg);
      }
    });
  }

  // -----------------
  // Carregar respondentes agregados (admin)
  // -----------------
  private loadRespondents(idCode: string) {
    this.eventService.getEventRespondentsAdmin(idCode, { page: 1, page_size: 100 }).subscribe({
      next: (items) => {
        this.respondentsRaw = items || [];
        this.respondentsTableData = (this.respondentsRaw || []).map((r) => {
          const user = r.user || {};
          const answersObj = (r.answers || {}) as Record<string, string>;
          const answersCount = Object.keys(answersObj).length;
          return {
            id_code: user.id_code,
            user: { image: this.normalizeImageUrl(user.avatar_url || undefined), name: user.name || (user.id_code || 'Sem nome') },
            email: user.email || undefined,
            phone: user.phone || undefined,
            guest_code: r.guest_code || undefined,
            submittedAt: r.submitted_at ? this.toLocalDateTime(r.submitted_at) : undefined,
            answersCount,
          } as RespondentRowData;
        });
      },
      error: (err) => {
        const msg = (err?.error?.message || err?.message || 'Falha ao carregar respondentes');
        this.triggerToast('error', 'Erro ao carregar respondentes', msg);
      }
    });
  }

  // DataTable helpers: respondentes
  onRespondentsItemsPerPageChange() { this.respondentsCurrentPage = 1; }
  updateRespondentsSearchTerm(term: string) { this.respondentsSearchTerm = term || ''; this.respondentsCurrentPage = 1; }
  get respondentsFilteredData(): RespondentRowData[] {
    const term = (this.respondentsSearchTerm || '').toLowerCase();
    return (this.respondentsTableData || []).filter((row) => {
      const name = (row.user?.name || '').toLowerCase();
      const email = (row.email || '').toLowerCase();
      const phone = (row.phone || '').toLowerCase();
      const code = (row.guest_code || '').toLowerCase();
      return name.includes(term) || email.includes(term) || phone.includes(term) || code.includes(term);
    });
  }
  get respondentsTotalItems(): number { return this.respondentsFilteredData.length; }
  get respondentsTotalPages(): number { return Math.ceil(this.respondentsTotalItems / this.respondentsItemsPerPage); }
  get respondentsStartIndex(): number { return (this.respondentsCurrentPage - 1) * this.respondentsItemsPerPage; }
  get respondentsEndIndex(): number { return Math.min(this.respondentsStartIndex + this.respondentsItemsPerPage, this.respondentsTotalItems); }
  get respondentsPageData(): RespondentRowData[] { return this.respondentsFilteredData.slice(this.respondentsStartIndex, this.respondentsEndIndex); }
  handleRespondentsPageChange(page: number) { const total = this.respondentsTotalPages; if (page >= 1 && page <= total) { this.respondentsCurrentPage = page; } }

  // Getters para exibir valores dos cards de KPI
  get totalGuestsKpi(): number {
    return (this.guestStats?.total_guests ?? this.tableData.length) || 0;
  }
  get totalRsvpKpi(): number {
    return (this.guestStats?.rsvp_count ?? this.tableData.filter(r => !!r.rsvp).length) || 0;
  }
  get totalCheckinKpi(): number {
    return (this.guestStats?.checkin_count ?? this.tableData.filter(r => !!r.checkin).length) || 0;
  }
  get totalResponsesKpi(): number {
    return this.totalResponses || 0;
  }

  // Segmentos para tabelas de analytics
  private mapToSegments<T extends string | null | undefined>(records: Array<{ key?: T }>): { label: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const rec of records) {
      const kRaw = (rec.key ?? '').toString().trim();
      const key = kRaw || 'Não informado';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }

  get bySourceSegments(): { label: string; count: number }[] {
    const source = this.guestStats?.by_source;
    if (source) {
      return Object.entries(source as Record<string, number>)
        .map(([label, count]) => ({ label, count: Number(count) }))
        .sort((a, b) => Number(b.count) - Number(a.count));
    }
    return this.mapToSegments(this.tableData.map(r => ({ key: r.source })));
  }

  get byTypeSegments(): { label: string; count: number }[] {
    const type = this.guestStats?.by_type;
    if (type) {
      return Object.entries(type as Record<string, number>)
        .map(([label, count]) => ({ label, count: Number(count) }))
        .sort((a, b) => Number(b.count) - Number(a.count));
    }
    return this.mapToSegments(this.tableData.map(r => ({ key: r.guestType })));
  }

  get byCheckinMethodSegments(): { label: string; count: number }[] {
    const method = this.guestStats?.by_check_in_method;
    if (method) {
      return Object.entries(method as Record<string, number>)
        .map(([label, count]) => ({ label, count: Number(count) }))
        .sort((a, b) => Number(b.count) - Number(a.count));
    }
    return this.mapToSegments(this.tableData.map(r => ({ key: r.checkinMethod })));
  }

  private toLocalDateTime(iso: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      // Caso venha já no formato correto ou outro, retorna como está
      return iso;
    }
  }

  toLocalTime(iso?: string | null): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return String(iso);
    }
  }

  private normalizeDateString(value: string | null | undefined): string | null {
    if (!value) return null;
    // Converte "YYYY-MM-DD HH:mm:ss" em "YYYY-MM-DDTHH:mm:ss" para compatibilidade com DatePipe
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
      return value.replace(' ', 'T');
    }
    return value;
  }

  toggleRsvp(row: TableRowData) {
    const newVal = !row.rsvp;
    if (!this.eventIdCode) return;
    // Se está marcado como SIM e usuário não é MASTER, não permite desconfirmar
    if (row.rsvp && !this.authService.hasRole('master')) {
      this.triggerToast('warning', 'Ação não permitida', 'Somente MASTER pode desconfirmar RSVP');
      return;
    }
    const payload = {
      rsvp_confirmed: newVal ? 1 : 0,
      rsvp_at: newVal ? new Date().toISOString() : null
    };
    this.eventService.updateEventGuest(this.eventIdCode, row.id, payload).subscribe({
      next: (g) => {
        const rsvpAtVal = this.normalizeDateString(g?.rsvp_at ?? null);
        const rsvpBoolRaw = this.toBool(g?.rsvp_confirmed ?? g?.rsvp);
        const rsvpBool = rsvpBoolRaw || !!rsvpAtVal;
        this.tableData = this.tableData.map(r => r.id === row.id ? {
          ...r,
          rsvp: rsvpBool,
          rsvpAt: rsvpAtVal
        } : r);
        this.triggerToast('success', 'RSVP atualizado', rsvpBool ? 'Confirmado' : 'Não confirmado');
      },
      error: () => {
        this.triggerToast('error', 'Falha ao atualizar RSVP');
      }
    });
  }

  toggleCheckin(row: TableRowData) {
    const newVal = !row.checkin;
    if (!this.eventIdCode) return;
    // Se já está com check-in e usuário não é MASTER, não permite remover
    if (row.checkin && !this.authService.hasRole('master')) {
      this.triggerToast('warning', 'Ação não permitida', 'Somente MASTER pode remover o check-in');
      return;
    }
    const payload = {
      check_in_at: newVal ? new Date().toISOString() : null
    };
    this.eventService.updateEventGuest(this.eventIdCode, row.id, payload).subscribe({
      next: (g) => {
        const checkInAt = this.normalizeDateString(g?.check_in_at ?? null);
        this.tableData = this.tableData.map(r => r.id === row.id ? {
          ...r,
          checkin: !!checkInAt,
          checkinAt: checkInAt
        } : r);
        this.triggerToast('success', 'Check-in atualizado', !!checkInAt ? 'Marcado' : 'Desmarcado');
      },
      error: () => {
        this.triggerToast('error', 'Falha ao atualizar Check-in');
      }
    });
  }

  private normalizeImageUrl(url?: string | null): string | undefined {
    const clean = (url || '').trim();
    const defaultAvatar = '/images/user/default-avatar.jpg';
    if (!clean) return defaultAvatar;
    if (/^https?:\/\//.test(clean)) return clean;
    const resolved = clean.startsWith('/') ? clean : `/${clean}`;
    // Guard against placeholder-like values
    if (resolved === '/' || resolved === '/null' || resolved === '/undefined') {
      return defaultAvatar;
    }
    return resolved;
  }

  onImageUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.imageFile = file;
      this.imageDirty = true; // Marca que houve alteração na imagem
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.event.image = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  onDateChange(field: string, event: Event) {
    const target = event.target as HTMLInputElement;
    const newDate = target.value;
    const startD = this.parseLocalDate(this.event.startDate);
    const endD = this.parseLocalDate(this.event.endDate);
    const newD = this.parseLocalDate(newDate);

    if (field === 'start') {
      // Se a data de início mudou e é maior que a data de fim, limpar a data de fim
      if (endD && newD && newD.getTime() > endD.getTime()) {
        this.event.endDate = '';
      }
      this.event.startDate = newDate;
    } else if (field === 'end') {
      // Se a data de fim é menor que a data de início, ajustar para a data de início
      if (startD && newD && newD.getTime() < startD.getTime()) {
        this.event.endDate = this.event.startDate;
        target.value = this.event.startDate;
        return;
      }
      this.event.endDate = newDate;
    }
  }

  saveEvent() {
    this.isSaving = true;
    this.saveMessage = '';
    this.saveError = '';

    if (!this.isDetailsValid()) {
      this.isSaving = false;
      this.saveError = 'Preencha os campos obrigatórios: nome, descrição, datas e local.';
      return;
    }

    const name = (this.event.name || '').trim();
    const description = (this.event.description || '').trim();
    const startIso = this.toIsoZ(this.event.startDate);
    const endIso = this.toIsoZ(this.event.endDate);
    const place = (this.event.location || '').trim();
    const respEmail = (this.event.respEmail || '').trim();
    const respName = (this.event.respName || '').trim();
    const respPhone = (this.event.respPhone || '').trim();
    const color_1 = this.cardSettings.primaryColor || this.event.primaryColor;
    const color_2 = this.cardSettings.secondaryColor || this.event.secondaryColor;
    let card_background: string | undefined;
    if (this.cardSettings.backgroundType === 'image') {
      // Se a imagem do cartão está "suja" (alterada), não enviar card_background no primeiro POST
      if (!this.cardImageDirty) {
        const bg = this.cardSettings.backgroundImage || this.event.cardBackgroundImage || '';
        // Envia URL absoluta para o backend
        card_background = bg ? this.normalizeBannerUrl(bg) : '';
      }
    } else {
      // Para gradiente, enviar string vazia para limpar o background de imagem
      card_background = '';
    }
    const slug = this.slugify(name);
    const hasImageForType = !!(this.cardSettings.backgroundImage || this.event.cardBackgroundImage);
    const hasColorsForType = !!(color_1 && color_2);
    const card_background_type: 0 | 1 = this.cardSettings.backgroundType === 'image'
      ? (hasImageForType ? 1 : (hasColorsForType ? 0 : 1))
      : (hasColorsForType ? 0 : (hasImageForType ? 1 : 0));

    const changes: Partial<ApiEvent> & {
      place?: string;
      resp_email?: string;
      resp_name?: string;
      resp_phone?: string;
      color_1?: string;
      color_2?: string;
      card_background?: string | null;
      card_background_type?: number;
    } = {
      name,
      description,
      start_datetime: startIso,
      end_datetime: endIso,
      slug,
      place,
      resp_email: respEmail,
      resp_name: respName,
      resp_phone: respPhone,
      color_1,
      color_2,
      card_background_type,
      requires_auto_checkin: !!this.event.requiresAutoCheckin,
      auto_checkin_flow_quest: !!this.event.autoCheckinFlowQuest
    };

    // Enviar card_background somente quando definido (evita enviar null quando sujo)
    if (card_background !== undefined) {
      changes.card_background = card_background;
    }

    const idOrCode = this.eventIdCode || this.event.id;
    this.eventService.updateEvent(idOrCode, changes).subscribe({
      next: async () => {
        // Se a imagem foi alterada, fazer upload e atualizar banner_url em seguida
        if (this.imageDirty && this.imageFile && this.eventIdCode) {
          try {
            const result = await this.imageUploadService.uploadImage(
              this.imageFile,
              'event-banner',
              this.eventIdCode,
              { maxWidth: 1200, maxHeight: 630, quality: 0.85 },
              `events/${this.eventIdCode}_${slug}`
            );

            if (result.success && result.filePath) {
              const bannerFullUrl = this.normalizeBannerUrl(result.filePath);
              await new Promise<void>((resolve, reject) => {
                this.eventService.updateEvent(idOrCode, { banner_url: bannerFullUrl }).subscribe({
                  next: () => resolve(),
                  error: (err) => reject(err)
                });
              });

              this.event.image = result.filePath;
              this.imageDirty = false;
              this.triggerToast('success', 'Atualização realizada', 'Evento e imagem atualizados com sucesso.');
            } else {
              this.triggerToast('warning', 'Imagem não atualizada', result.error || 'Falha no upload da imagem. O banner antigo foi mantido.');
              if (this.bannerOriginalUrl) {
                this.event.image = this.normalizeImageUrl(this.bannerOriginalUrl) || this.event.image;
              }
            }
          } catch (error) {
            console.error('Erro ao enviar imagem do evento:', error);
            this.triggerToast('error', 'Falha ao atualizar imagem', 'Erro ao enviar a nova imagem. O banner antigo foi mantido.');
            if (this.bannerOriginalUrl) {
              this.event.image = this.normalizeImageUrl(this.bannerOriginalUrl) || this.event.image;
            }
          }
        } else {
          this.triggerToast('success', 'Atualização realizada', 'Evento atualizado com sucesso.');
        }

        // Se a imagem do cartão foi alterada, fazer upload e atualizar card_background em seguida
        if (this.cardImageDirty && this.cardImageFile && this.eventIdCode) {
          try {
            const result = await this.imageUploadService.uploadImage(
              this.cardImageFile,
              'event-card',
              this.eventIdCode,
              { maxWidth: 800, maxHeight: 1200, quality: 0.9 },
              `events/${this.eventIdCode}_${slug}`
            );

            if (result.success && result.filePath) {
              const cardFullUrl = this.normalizeBannerUrl(result.filePath);
              await new Promise<void>((resolve, reject) => {
                this.eventService.updateEvent(idOrCode, { card_background: cardFullUrl, card_background_type: 1 } as any).subscribe({
                  next: () => resolve(),
                  error: (err) => reject(err)
                });
              });

              const newUrl = this.normalizeImageUrl(result.filePath) || result.filePath;
              this.cardSettings = { ...this.cardSettings, backgroundImage: newUrl };
              this.event.cardBackgroundImage = newUrl;
              this.event.cardBackgroundType = 'image';
              this.cardSettings.backgroundType = 'image';
              this.cardImageDirty = false;
            } else {
              this.triggerToast('warning', 'Imagem do cartão não atualizada', result.error || 'Falha no upload da imagem. O fundo antigo foi mantido.');
              if (this.cardBackgroundOriginalUrl) {
                const original = this.normalizeImageUrl(this.cardBackgroundOriginalUrl) || this.event.cardBackgroundImage;
                this.cardSettings = { ...this.cardSettings, backgroundImage: original };
                this.event.cardBackgroundImage = original;
              }
            }
          } catch (error) {
            console.error('Erro ao enviar imagem do cartão:', error);
            this.triggerToast('error', 'Falha ao atualizar imagem do cartão', 'Erro ao enviar a nova imagem. O fundo antigo foi mantido.');
            if (this.cardBackgroundOriginalUrl) {
              const original = this.normalizeImageUrl(this.cardBackgroundOriginalUrl) || this.event.cardBackgroundImage;
              this.cardSettings = { ...this.cardSettings, backgroundImage: original };
              this.event.cardBackgroundImage = original;
            }
          }
        }

        this.isSaving = false;
        this.saveMessage = '';
      },
      error: (err) => {
        console.error('Erro ao atualizar evento:', err);
        this.isSaving = false;
        this.saveError = '';
        this.triggerToast('error', 'Falha na atualização', 'Erro ao atualizar evento. Tente novamente.');
      }
    });
  }

  exportGuestList() {
    // Preparar dados para exportação
    const csvData = this.filteredAndSortedData.map(item => ({
      'Nome': item.user.name,
      'Email': item.email,
      'Telefone': item.phone
    }));

    // Converter para CSV
    const csvContent = this.convertToCSV(csvData);

    // Criar e baixar arquivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `lista-convidados-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Adicionar cabeçalhos
    csvRows.push(headers.join(','));

    // Adicionar dados
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        // Escapar aspas duplas e envolver em aspas se necessário
        return typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  // Método para trackBy na lista de convidados
  trackByGuestId(index: number, item: TableRowData): number {
    return item.id;
  }

  // Métodos para ações dos convidados
  viewGuest(item: TableRowData) {
    // Encontrar o guest correspondente pelo ID
    const guest = this.guests.find(g => g.id === item.id);
    if (guest) {
      this.selectedGuest = guest;
      this.isGuestCardModalOpen = true;
    }
  }

  closeGuestCardModal() {
    this.isGuestCardModalOpen = false;
    this.selectedGuest = null;
  }

  editGuest(item: TableRowData) {
    // Encontrar o guest correspondente pelo ID
    const guest = this.guests.find(g => g.id === item.id);
    if (guest) {
      this.selectedGuest = guest;
      this.isEditGuestModalOpen = true;
    }
  }

  // Métodos para o modal de edição
  closeEditGuestModal() {
    this.isEditGuestModalOpen = false;
    this.selectedGuest = null;
  }

  saveGuestChanges(updatedGuest: Guest) {
    const idCodeOrId: string | number = this.eventIdCode || this.event.id;
    const payload = {
      display_name: updatedGuest.name,
      email: updatedGuest.email,
      phone: updatedGuest.phone,
      document: (updatedGuest.documentNumber || updatedGuest.documentType) ? {
        number: updatedGuest.documentNumber || '',
        type: updatedGuest.documentType
      } : null,
      type: updatedGuest.guestType
    } as any;

    this.eventService.updateEventGuest(idCodeOrId, updatedGuest.id, payload).subscribe({
      next: (apiGuest) => {
        // Atualiza o convidado local com os dados retornados/alterados
        const index = this.guests.findIndex(g => g.id === updatedGuest.id);
        const mergedGuest: Guest = {
          ...updatedGuest,
          name: apiGuest?.display_name || updatedGuest.name,
          email: apiGuest?.email || updatedGuest.email,
          phone: apiGuest?.phone || updatedGuest.phone,
          documentNumber: apiGuest?.document?.number || updatedGuest.documentNumber,
          documentType: (apiGuest?.document?.type as ('rg' | 'cpf' | 'passport') | undefined) || updatedGuest.documentType,
          guestType: (apiGuest?.type as ('normal' | 'premium' | 'vip') | undefined) || updatedGuest.guestType,
          image: this.normalizeImageUrl(apiGuest?.avatar_url || updatedGuest.image),
          status: (apiGuest?.check_in_at ? 'Confirmado' : updatedGuest.status)
        };

        if (index !== -1) {
          this.guests[index] = mergedGuest;
        }

        const tableIndex = this.tableData.findIndex(t => t.id === updatedGuest.id);
        if (tableIndex !== -1) {
          this.tableData[tableIndex] = {
            id: mergedGuest.id,
            user: { image: mergedGuest.image, name: mergedGuest.name },
            email: mergedGuest.email,
            phone: mergedGuest.phone,
            status: mergedGuest.status,
            documentNumber: mergedGuest.documentNumber || '',
            guestType: mergedGuest.guestType || ''
          } as any;
        }

        this.triggerToast('success', 'Convidado atualizado', 'As alterações foram salvas com sucesso.');
        this.closeEditGuestModal();
      },
      error: (err) => {
        const status = err?.status;
        let msg = err?.error?.message || err?.message || 'Falha ao atualizar convidado.';
        if (status === 400) msg = 'Dados inválidos. Verifique os campos e tente novamente.';
        if (status === 403) msg = 'Sem permissão para atualizar este convidado.';
        if (status === 404) msg = 'Convidado não encontrado.';
        if (status === 409) {
          msg = err?.error?.message || 'Convidado duplicado por email/documento/usuário';
          this.handleDuplicateError('edit', err);
        }
        this.triggerToast('error', 'Erro ao salvar', msg);
      }
    });
  }

  private handleDuplicateError(kind: 'add' | 'edit', err: any) {
    try {
      const field: string | undefined = err?.error?.details?.[0]?.field;
      const apiMessage: string | undefined = err?.error?.message;
      const form = kind === 'add' ? this.addGuestModal?.form : this.editGuestModal?.editForm;
      if (!form) return;

      let controlName: string | undefined;
      const normalizedField = (field || '').toLowerCase();
      if (['guest_email', 'email'].includes(normalizedField)) {
        controlName = 'email';
      } else if ([
        'guest_document_number',
        'document_number',
        'document.number',
        'document'
      ].includes(normalizedField)) {
        controlName = 'documentNumber';
      } else if (normalizedField === 'user_id') {
        controlName = undefined; // mensagem global
      } else {
        controlName = undefined;
      }

      if (controlName) {
        const ctrl = form.get(controlName);
        if (ctrl) {
          const existingErrors = ctrl.errors || {};
          ctrl.setErrors({ ...existingErrors, duplicate: true, apiMessage });
          ctrl.markAsTouched();
          ctrl.updateValueAndValidity({ emitEvent: true });
        }
      }
    } catch (_) {
      // falha silenciosa na sinalização do formulário; o toaster já cobre a mensagem
    }
  }

  // Métodos para configurações do cartão
  onCardSettingsChange(settings: any) {
    this.cardSettings = { ...settings };
  }

  getCardBackground(): string {
    const type = this.cardSettings.backgroundType;
    const img = this.cardSettings.backgroundImage || this.event.cardBackgroundImage;
    const hasImage = !!img;
    const hasColors = !!(this.cardSettings.primaryColor && this.cardSettings.secondaryColor);

    let effective: 'image' | 'gradient' = type;
    if (type === 'image' && !hasImage) {
      effective = hasColors ? 'gradient' : 'image';
    } else if (type === 'gradient' && !hasColors) {
      effective = hasImage ? 'image' : 'gradient';
    }

    if (effective === 'image' && hasImage) {
      return `url(${img})`;
    }
    const c1 = this.cardSettings.primaryColor || this.event.primaryColor || '#3B82F6';
    const c2 = this.cardSettings.secondaryColor || this.event.secondaryColor || '#1E40AF';
    return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
  }

  onCardBackgroundFileChange(file: File | null) {
    this.cardImageFile = file ?? undefined;
    this.cardImageDirty = !!file;
  }

  // Salvar configurações do cartão
  saveCardSettings() {
    this.saveEvent();
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

  private toIsoZ(localValue: string | undefined): string {
    if (!localValue) return '';
    const parsed = this.parseLocalDate(localValue);
    if (!parsed) return localValue;
    return parsed.toISOString();
  }

  private parseLocalDate(value?: string): Date | null {
    if (!value) return null;
    // Esperado: YYYY-MM-DDTHH:MM (datetime-local)
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})$/.exec(value);
    if (m) {
      const [_, y, mo, d, h, mi] = m;
      const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), 0, 0);
      return dt;
    }
    // Fallback para formatos parseáveis pelo Date
    const dt = new Date(value);
    return isNaN(dt.getTime()) ? null : dt;
  }

  private normalizeBannerUrl(url: string): string {
    const clean = (url || '').trim();
    if (!clean) return '';
    if (/^https?:\/\//.test(clean)) return clean;
    const base = (typeof window !== 'undefined' && (window as any).location?.origin) ? (window as any).location.origin : '';
    const relative = clean.startsWith('/') ? clean : `/images/cards/${clean}`;
    return base ? `${base}${relative}` : relative;
  }

  isDetailsValid(): boolean {
    const nameOk = !!(this.event.name && this.event.name.trim());
    const descOk = !!(this.event.description && this.event.description.trim());
    const startOk = !!(this.event.startDate && this.event.startDate.trim());
    const endOk = !!(this.event.endDate && this.event.endDate.trim());
    const locOk = !!(this.event.location && this.event.location.trim());
    return nameOk && descOk && startOk && endOk && locOk;
  }

  private triggerToast(
    variant: 'success' | 'info' | 'warning' | 'error',
    title: string,
    description?: string
  ) {
    const compRef = createComponent(NotificationComponent, {
      environmentInjector: this.envInjector,
      elementInjector: this.injector,
    });
    compRef.setInput('variant', variant);
    compRef.setInput('title', title);
    compRef.setInput('description', description);
    compRef.setInput('hideDuration', 3000);

    this.appRef.attachView(compRef.hostView);
    const host = compRef.location.nativeElement as HTMLElement;
    host.style.position = 'fixed';
    host.style.top = '16px';
    host.style.right = '16px';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'auto';
    document.body.appendChild(host);

    setTimeout(() => {
      this.appRef.detachView(compRef.hostView);
      compRef.destroy();
    }, 3200);
  }

  // -----------------
  // Respostas por pergunta
  // -----------------
  questions: QuestionItem[] = [];

  private mapApiTypeToLocalType(apiType?: string): QuestionType {
    const t = (apiType || '').toLowerCase();
    switch (t) {
      case 'text':
      case 'textarea':
        return 'text';
      case 'radio':
        return 'single_choice';
      case 'checkbox':
        return 'multiple_choice';
      case 'rating':
      case 'music_preference':
        return 'poll';
      default:
        return 'text';
    }
  }

  private loadQuestions(idCode: string) {
    const token = this.authService.getAuthToken();
    if (token) {
      this.eventService.getEventQuestions(idCode).subscribe({
        next: (apiQuestions) => {
          this.questions = apiQuestions
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
            .map((q) => ({
              id: q.id,
              title: q.text || '',
              type: this.mapApiTypeToLocalType(q.type),
              answers: []
            }));
          // Após carregar perguntas, se autenticado use agregação admin (user + answers); caso contrário, público
          this.loadAnswersFromAdminRespondents(idCode);
        },
        error: (err) => {
          const msg = (err?.error?.message || err?.message || 'Falha ao carregar perguntas');
          this.triggerToast('error', 'Erro ao carregar perguntas', msg);
        }
      });
    } else {
      // Público: precisamos do slug para obter perguntas visíveis (show_results=true)
      this.eventService.getPublicEventsList().subscribe({
        next: (events) => {
          const ev = events.find(e => String(e.id_code) === String(idCode));
          if (!ev || !ev.slug) {
            this.triggerToast('warning', 'Evento público não encontrado', 'Não foi possível localizar o slug para carregar perguntas.');
            return;
          }
          this.eventService.getPublicEventQuestionsBySlug(ev.slug!).subscribe({
            next: (apiQuestions) => {
              this.questions = apiQuestions
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .map((q) => ({
                  id: q.id,
                  title: q.text || '',
                  type: this.mapApiTypeToLocalType(q.type),
                  answers: []
                }));
              // Após carregar perguntas em modo público, carregar respostas por pergunta (usa id_code)
              this.loadResponsesForQuestions(idCode);
        },
        error: (err) => {
          const msg = (err?.error?.message || err?.message || 'Falha ao carregar perguntas públicas');
          this.triggerToast('error', 'Erro ao carregar perguntas', msg);
        }
      });
        },
        error: (err) => {
          const msg = (err?.error?.message || err?.message || 'Falha ao listar eventos públicos');
          this.triggerToast('error', 'Erro ao carregar eventos públicos', msg);
        }
      });
    }
  }

  private expandedQuestionIds = new Set<number>();

  // Estado de DataTable por pergunta (filtro/paginação)
  private questionTableState: Record<number, { currentPage: number; itemsPerPage: number; searchTerm: string }> = {};

  getQuestionState(id: number) {
    if (!this.questionTableState[id]) {
      this.questionTableState[id] = { currentPage: 1, itemsPerPage: 8, searchTerm: '' };
    }
    return this.questionTableState[id];
  }

  toggleQuestion(id: number) {
    if (this.expandedQuestionIds.has(id)) {
      this.expandedQuestionIds.delete(id);
    } else {
      this.expandedQuestionIds.add(id);
      // inicializa estado ao abrir
      this.getQuestionState(id);
    }
  }

  isQuestionExpanded(id: number): boolean {
    return this.expandedQuestionIds.has(id);
  }

  exportQuestionAnswersCSV(question: QuestionItem) {
    const rows = question.answers.map(ans => ({
      'Pergunta': question.title,
      'Usuário': ans.user.name,
      'Resposta': Array.isArray(ans.value) ? (ans.value as string[]).join(', ') : (ans.value as string)
    }));

    const csvContent = this.convertToCSV(rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const filename = `respostas-pergunta-${question.id}-${new Date().toISOString().split('T')[0]}.csv`;
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  exportAllAnswersCSV() {
    const rows: any[] = [];
    this.questions.forEach(q => {
      q.answers.forEach(ans => {
        rows.push({
          'Pergunta': q.title,
          'Usuário': ans.user.name,
          'Resposta': Array.isArray(ans.value) ? (ans.value as string[]).join(', ') : (ans.value as string)
        });
      });
    });

    const csvContent = this.convertToCSV(rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const filename = `respostas-todas-${new Date().toISOString().split('T')[0]}.csv`;
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Helpers de filtro/paginação por pergunta
  updateQuestionSearchTerm(id: number, term: string) {
    const state = this.getQuestionState(id);
    state.searchTerm = term || '';
    state.currentPage = 1;
  }

  onQuestionItemsPerPageChange(id: number) {
    const state = this.getQuestionState(id);
    state.currentPage = 1;
  }

  handleQuestionPageChange(id: number, page: number) {
    const state = this.getQuestionState(id);
    const total = this.getQuestionTotalPagesById(id);
    if (page >= 1 && page <= total) {
      state.currentPage = page;
    }
  }

  private normalizeAnswerValue(value: string | string[]): string {
    return Array.isArray(value) ? value.join(', ') : value;
  }

  getQuestionFilteredAnswers(question: QuestionItem): AnswerItem[] {
    const state = this.getQuestionState(question.id);
    const term = state.searchTerm.toLowerCase();
    return question.answers.filter(ans => {
      const nameMatch = ans.user.name.toLowerCase().includes(term);
      const answerText = this.normalizeAnswerValue(ans.value).toLowerCase();
      const answerMatch = answerText.includes(term);
      return nameMatch || answerMatch;
    });
  }

  getQuestionTotalItems(question: QuestionItem): number {
    return this.getQuestionFilteredAnswers(question).length;
  }

  getQuestionTotalPages(question: QuestionItem): number {
    const state = this.getQuestionState(question.id);
    return Math.ceil(this.getQuestionTotalItems(question) / state.itemsPerPage);
  }

  // Mesma lógica porém por id (para uso em bindings que passam id)
  private getQuestionTotalPagesById(id: number): number {
    const q = this.questions.find(x => x.id === id);
    if (!q) return 1;
    return this.getQuestionTotalPages(q);
  }

  getQuestionStartIndex(question: QuestionItem): number {
    const state = this.getQuestionState(question.id);
    return (state.currentPage - 1) * state.itemsPerPage;
  }

  getQuestionEndIndex(question: QuestionItem): number {
    return Math.min(this.getQuestionStartIndex(question) + this.getQuestionState(question.id).itemsPerPage, this.getQuestionTotalItems(question));
  }

  getQuestionPageAnswers(question: QuestionItem): AnswerItem[] {
    const filtered = this.getQuestionFilteredAnswers(question);
    const start = this.getQuestionStartIndex(question);
    const end = this.getQuestionEndIndex(question);
    return filtered.slice(start, end);
  }

  toAnswerText(value: string | string[]): string {
    return Array.isArray(value) ? value.join(', ') : value;
  }

  // -----------------
  // Gráficos por pergunta (ApexCharts)
  // -----------------

  questionBarChart: ApexChart = {
    fontFamily: 'Outfit, sans-serif',
    type: 'bar',
    height: 220,
    toolbar: { show: false }
  };

  questionBarPlotOptions: ApexPlotOptions = {
    bar: {
      horizontal: true,
      barHeight: '60%',
      borderRadius: 6,
      borderRadiusApplication: 'end'
    }
  };

  questionBarDataLabels: ApexDataLabels = { enabled: false };
  questionBarLegend: ApexLegend = { show: false };
  questionBarYAxis: ApexYAxis = { title: { text: undefined } };
  questionBarColors: string[] = ['#465fff'];

  private computeCounts(question: QuestionItem): { labels: string[]; counts: number[] } | null {
    if (question.type === 'text') return { labels: [], counts: [] };
    const map = new Map<string, number>();
    for (const ans of question.answers) {
      if (Array.isArray(ans.value)) {
        // múltiplas escolhas
        for (const v of ans.value) {
          map.set(v, (map.get(v) || 0) + 1);
        }
      } else {
        const v = ans.value;
        map.set(v, (map.get(v) || 0) + 1);
      }
    }
    const labels = Array.from(map.keys());
    const counts = labels.map(l => map.get(l) || 0);
    return { labels, counts };
  }

  getQuestionChartSeries(question: QuestionItem): ApexAxisChartSeries {
    const agg = this.computeCounts(question)!;
    return [{ name: 'Respostas', data: agg.counts }];
  }

  getQuestionChartXAxis(question: QuestionItem): ApexXAxis {
    const agg = this.computeCounts(question)!;
    return {
      categories: agg.labels,
      axisBorder: { show: false },
      axisTicks: { show: false }
    };
  }

  getQuestionTotalResponses(question: QuestionItem): number {
    return question.answers.length;
  }

  // -----------------
  // Carregar respostas por pergunta
  // -----------------
  private loadResponsesForQuestions(idCode: string) {
    // zera total antes
    this.totalResponses = 0;
    for (const q of this.questions) {
      this.eventService.getEventResponses(idCode, { question_id: q.id }).subscribe({
        next: (items) => {
          const mapped = items.map((r) => this.mapApiResponseToAnswerItem(r, q.type));
          q.answers = mapped;
          this.totalResponses += mapped.length;
        },
        error: (err) => {
          const msg = (err?.error?.message || err?.message || 'Falha ao carregar respostas');
          this.triggerToast('error', 'Erro ao carregar respostas', msg);
        }
      });
    }
  }

  // Carrega respostas por pergunta a partir do endpoint administrativo agregado (user + answers)
  private loadAnswersFromAdminRespondents(idCode: string) {
    this.totalResponses = 0;
    this.eventService.getEventRespondentsAdmin(idCode, { page_size: 1000 }).subscribe({
      next: (respondents) => {
        // Para cada pergunta, derive a lista de AnswerItem a partir de respondents.answers['q<id>']
        for (const q of this.questions) {
          const answersForQ: AnswerItem[] = [];
          const key = `q${q.id}`;
          for (const resp of respondents) {
            const item = this.mapAdminRespondentToAnswerItem(resp, q);
            if (item) answersForQ.push(item);
          }
          q.answers = answersForQ;
          this.totalResponses += answersForQ.length;
        }
      },
      error: (err) => {
        const msg = (err?.error?.message || err?.message || 'Falha ao carregar respostas agregadas');
        this.triggerToast('error', 'Erro ao carregar respostas', msg);
      }
    });
  }

  private mapAdminRespondentToAnswerItem(resp: AdminRespondentItem, q: QuestionItem): AnswerItem | null {
    const key = `q${q.id}`;
    const raw = resp?.answers?.[key];
    if (raw === undefined || raw === null) return null;
    const name = (resp.user?.name || 'Usuário');
    const avatar = this.normalizeImageUrl(resp.user?.avatar_url || undefined) || '/images/user/default-avatar.jpg';

    // Parse robusto: valores podem vir como string simples ("op1"),
    // array em string ("[\"1\",\"2\"]"), ou array real.
    const parseValue = (val: any, type: QuestionType): string | string[] => {
      if (Array.isArray(val)) return val.map(v => String(v));
      if (typeof val === 'string') {
        const trimmed = val.trim();
        // tenta JSON.parse
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed.map(v => String(v));
            if (typeof parsed === 'string') return parsed;
            // objetos com 'options' ou 'selected'
            if (Array.isArray((parsed as any).options)) return (parsed as any).options.map((v: any) => String(v));
            if (typeof (parsed as any).selected === 'string') return String((parsed as any).selected);
            if (typeof (parsed as any).value === 'string') return String((parsed as any).value);
          } catch (_) {
            // não era JSON válido, segue
          }
        }
        // fallback para lista separada por vírgula
        if (type === 'multiple_choice' && trimmed.includes(',')) {
          return trimmed.split(',').map(s => s.trim());
        }
        return trimmed;
      }
      // outros tipos
      return String(val);
    };

    const value: string | string[] = parseValue(raw, q.type);
    return {
      user: { id: 0, image: avatar, name },
      value
    };
  }

  private mapApiResponseToAnswerItem(r: ApiResponseItem, qType: QuestionType): AnswerItem {
    const name = (r.user?.display_name || r.user?.name || r.guest_name || 'Convidado');
    const avatar = this.normalizeImageUrl(r.user?.avatar_url || r.guest_avatar_url || undefined);

    const value = ((): string | string[] => {
      const txt = (r.answer_text || '').trim();
      if (txt) return txt;
      const j = r.answer_json;
      if (Array.isArray(j)) return j.map(v => String(v));
      if (j && typeof j === 'object') {
        if (Array.isArray((j as any).options)) return (j as any).options.map((v: any) => String(v));
        if (typeof (j as any).selected === 'string') return String((j as any).selected);
        if (typeof (j as any).value === 'string') return String((j as any).value);
        const strVals = Object.values(j).filter(v => typeof v === 'string') as string[];
        if (strVals.length > 1) return strVals;
        if (strVals.length === 1) return strVals[0];
      }
      if (typeof j === 'string') return j as string;
      // fallback por tipo
      return qType === 'multiple_choice' ? [] : '';
    })();

    return {
      user: { id: r.user?.id || 0, image: avatar || '/images/user/default-avatar.jpg', name },
      value
    };
  }
}
