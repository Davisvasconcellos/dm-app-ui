import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule, ApexAxisChartSeries, ApexChart, ApexPlotOptions, ApexDataLabels, ApexXAxis, ApexLegend, ApexYAxis } from 'ng-apexcharts';
import { CardSettingsComponent, CardSettings } from '../../../shared/components/cards/card-settings/card-settings.component';
import { Guest } from '../../../shared/interfaces/guest.interface';
import { EventService, CreateEventPayload, ApiEvent } from '../event.service';
import { ImageUploadService } from '../../../shared/services/image-upload.service';

interface TableRowData {
  id: number;
  user: { image: string | undefined; name: string };
  email: string;
  phone: string;
  status: 'Confirmado' | 'Pendente' | 'Cancelado';
}

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

interface EventData {
  id: number;
  name: string;
  description: string;
  location: string;
  responsibleName?: string;
  responsibleEmail?: string;
  responsiblePhone?: string;
  startDate: string;
  endDate: string;
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

@Component({
  selector: 'app-event-create',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, NgApexchartsModule, CardSettingsComponent],
  templateUrl: './event-create.component.html',
  styleUrls: ['./event-create.component.css']
})
export class EventCreateComponent {
  activeTab: string = 'detalhes';

  event: EventData = {
    id: 1,
    name: '',
    description: '',
    location: '',
    responsibleName: '',
    responsibleEmail: '',
    responsiblePhone: '',
    startDate: '',
    endDate: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    showLogo: true,
    showQRCode: true,
    image: '',
    cardBackgroundType: 'image',
    cardBackgroundImage: '/images/cards/event3.jpg',
    requiresAutoCheckin: false,
    autoCheckinFlowQuest: true
  };

  cardSettings: CardSettings = {
    backgroundType: 'image',
    backgroundImage: '/images/cards/event4.jpg',
    primaryColor: this.event.primaryColor,
    secondaryColor: this.event.secondaryColor,
    showLogo: this.event.showLogo,
    showQRCode: this.event.showQRCode
  };

  tableData: TableRowData[] = [];

  guests: Guest[] = [
    { id: 1, image: '/images/user/user-20.jpg', name: 'João Silva', email: 'joao.silva@email.com', phone: '(11) 99999-9999', status: 'Confirmado' },
    { id: 2, image: '/images/user/user-21.jpg', name: 'Maria Santos', email: 'maria.santos@email.com', phone: '(11) 88888-8888', status: 'Pendente' },
    { id: 3, image: '/images/user/user-22.jpg', name: 'Pedro Costa', email: 'pedro.costa@email.com', phone: '(11) 77777-7777', status: 'Confirmado' },
    { id: 4, image: '/images/user/user-23.jpg', name: 'Ana Oliveira', email: 'ana.oliveira@email.com', phone: '(11) 66666-6666', status: 'Cancelado' },
    { id: 5, image: '/images/user/user-24.jpg', name: 'Carlos Ferreira', email: 'carlos.ferreira@email.com', phone: '(11) 55555-5555', status: 'Confirmado' }
  ];

  isGuestCardModalOpen = false;
  isEditGuestModalOpen = false;
  selectedGuest: Guest | null = null;

  eventData = {
    id: 1,
    name: this.event.name,
    description: this.event.description,
    location: this.event.location,
    responsibleName: this.event.responsibleName,
    responsibleEmail: this.event.responsibleEmail,
    responsiblePhone: this.event.responsiblePhone,
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

  columns = [
    { key: 'name', label: 'Convidado' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Telefone' },
    { key: 'actions', label: 'Ações' }
  ];

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
  saveMessage: string = '';
  saveError: string = '';

  imageFile?: File;
  imagePreview?: string;

  constructor(private eventService: EventService, private router: Router, private imageUploadService: ImageUploadService) {
    this.tableData = this.guests.map(guest => ({
      id: guest.id,
      user: { image: guest.image, name: guest.name },
      email: guest.email,
      phone: guest.phone,
      status: guest.status
    }));
  }

  get filteredAndSortedData() {
    return this.tableData
      .filter((item) =>
        item.user.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        item.email.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        item.phone.toLowerCase().includes(this.searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        let valueA: any, valueB: any;

        if (this.sortKey === 'name') {
          valueA = a.user.name;
          valueB = b.user.name;
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

  get totalItems() { return this.filteredAndSortedData.length; }
  get totalPages() { return Math.ceil(this.totalItems / this.itemsPerPage); }
  get startIndex() { return (this.currentPage - 1) * this.itemsPerPage; }
  get endIndex() { return Math.min(this.startIndex + this.itemsPerPage, this.totalItems); }
  get currentData() { return this.filteredAndSortedData.slice(this.startIndex, this.endIndex); }

  handlePageChange(page: number) { this.currentPage = page; }

  handleSort(key: string) {
    if (this.sortKey === key) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortOrder = 'asc';
    }
  }

  onItemsPerPageChange() { this.currentPage = 1; }
  setActiveTab(tab: string) { this.activeTab = tab; }

  onImageUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.imageFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => { this.imagePreview = e.target.result; };
      reader.readAsDataURL(file);
    }
  }

  onDateChange(field: string, event: Event) {
    const target = event.target as HTMLInputElement;
    const newDate = target.value;
    if (field === 'start') {
      if (this.event.endDate && newDate > this.event.endDate) { this.event.endDate = ''; }
      this.event.startDate = newDate;
    } else if (field === 'end') {
      if (this.event.startDate && newDate < this.event.startDate) {
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
      this.saveError = 'Preencha os campos obrigatórios: nome, descrição, datas, local e responsável.';
      return;
    }
    const name = (this.event.name || '').trim();
    const description = (this.event.description || '').trim();
    // Não usar base64 no payload; envia imagem padrão ou a de fundo do cartão
    const banner = this.cardSettings.backgroundImage || this.event.cardBackgroundImage || '/images/cards/event2.jpg';
    const startIso = this.toIsoZ(this.event.startDate);
    const endIso = this.toIsoZ(this.event.endDate);

    const place = (this.event.location || '').trim();
    const respEmail = (this.event.responsibleEmail || '').trim();
    const respName = (this.event.responsibleName || '').trim();
    const respPhone = (this.event.responsiblePhone || '').replace(/\D+/g, '').trim();

    // Determina o tipo efetivo do fundo do cartão com fallbacks
    const bgTypeRequested: 'image' | 'gradient' = this.cardSettings.backgroundType;
    const bgImg = this.cardSettings.backgroundImage || this.event.cardBackgroundImage || '';
    const hasBgImage = !!bgImg;
    const hasBgColors = !!(this.cardSettings.primaryColor && this.cardSettings.secondaryColor);
    let effectiveBgType: 'image' | 'gradient' = bgTypeRequested;
    if (bgTypeRequested === 'image' && !hasBgImage) {
      effectiveBgType = hasBgColors ? 'gradient' : 'image';
    } else if (bgTypeRequested === 'gradient' && !hasBgColors) {
      effectiveBgType = hasBgImage ? 'image' : 'gradient';
    }

    const payload: CreateEventPayload = {
      name,
      slug: this.slugify(name),
      banner_url: this.normalizeBannerUrl(banner),
      start_datetime: startIso,
      end_datetime: endIso,
      description,
      place,
      resp_email: respEmail,
      resp_name: respName,
      resp_phone: respPhone,
      color_1: this.cardSettings.primaryColor,
      color_2: this.cardSettings.secondaryColor,
      card_background: this.normalizeBannerUrl(bgImg),
      card_background_type: effectiveBgType === 'image' ? 1 : 0,
      requires_auto_checkin: !!this.event.requiresAutoCheckin,
      auto_checkin_flow_quest: !!this.event.autoCheckinFlowQuest
    };

    this.eventService.createEventRaw(payload).subscribe({
      next: async (created: ApiEvent) => {
        try {
          // Obtém id_code do evento criado e prepara as pastas do evento
          const idCode = created?.id_code as string | undefined;
          if (idCode) {
            try {
              await this.imageUploadService.prepareEventFolders(idCode);
            } catch (prepErr) {
              console.warn('Falha ao preparar pastas do evento, seguindo com fluxo:', prepErr);
            }
          }
          // Se houver arquivo selecionado, faz upload e atualiza banner_url no evento criado
          if (this.imageFile && idCode) {
            const slugName = this.slugify(name);
            const folderPath = `events/${idCode}_${slugName}`;

            const upload = await this.imageUploadService.uploadImage(
              this.imageFile,
              'event-banner',
              idCode,
              { maxWidth: 1200, maxHeight: 800, quality: 0.9, format: 'jpeg' },
              folderPath
            );
            if (upload.success && upload.filePath) {
              await this.eventService.updateEvent(idCode, { banner_url: upload.filePath }).toPromise();
            }
          }
          this.isSaving = false;
          this.saveMessage = 'Evento inserido com sucesso!';
          this.router.navigate(['/events/event-list-admin']);
        } catch (e) {
          console.error('Erro ao finalizar upload/atualização do banner:', e);
          this.isSaving = false;
          this.saveError = 'Evento criado, mas houve falha ao atualizar o banner.';
          this.router.navigate(['/events/event-list-admin']);
        }
      },
      error: (err) => {
        console.error('Erro ao criar evento:', err);
        this.isSaving = false;
        this.saveError = 'Erro ao inserir evento. Tente novamente.';
      }
    });
  }

  saveCardSettings() {
    // Mesma função do botão da primeira aba: insere todos os campos no evento
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
    // Retorna a string local diretamente (ex: "2026-03-30T03:00")
    // O input datetime-local já fornece o formato ISO local. 
    // Adicionamos os segundos (:00) se necessário para compatibilidade.
    return localValue.length === 16 ? `${localValue}:00` : localValue;
  }

  private normalizeBannerUrl(url: string): string {
    const clean = (url || '').trim();
    if (!clean) return '';
    if (/^https?:\/\//.test(clean)) return clean;
    // Converte caminho relativo para URL absoluta com base no origin atual
    const path = clean.startsWith('/') ? clean : `/images/cards/${clean}`;
    try {
      const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
      return origin ? `${origin}${path}` : path;
    } catch {
      return path;
    }
  }

  isDetailsValid(): boolean {
    const nameOk = !!(this.event.name && this.event.name.trim());
    const descOk = !!(this.event.description && this.event.description.trim());
    const startOk = !!(this.event.startDate && this.event.startDate.trim());
    const endOk = !!(this.event.endDate && this.event.endDate.trim());
    const locOk = !!(this.event.location && this.event.location.trim());
    const respNameOk = !!(this.event.responsibleName && this.event.responsibleName.trim());
    const respEmailOk = !!(this.event.responsibleEmail && this.event.responsibleEmail.trim());
    return nameOk && descOk && startOk && endOk && locOk && respNameOk && respEmailOk;
  }

  exportGuestList() {
    const csvData = this.filteredAndSortedData.map(item => ({ 'Nome': item.user.name, 'Email': item.email, 'Telefone': item.phone }));
    const csvContent = this.convertToCSV(csvData);
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
    csvRows.push(headers.join(','));
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      });
      csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  }

  trackByGuestId(index: number, item: TableRowData): number { return item.id; }

  viewGuest(item: TableRowData) {
    const guest = this.guests.find(g => g.id === item.id);
    if (guest) { this.selectedGuest = guest; this.isGuestCardModalOpen = true; }
  }
  closeGuestCardModal() { this.isGuestCardModalOpen = false; this.selectedGuest = null; }

  editGuest(item: TableRowData) {
    const guest = this.guests.find(g => g.id === item.id);
    if (guest) { this.selectedGuest = guest; this.isEditGuestModalOpen = true; }
  }
  closeEditGuestModal() { this.isEditGuestModalOpen = false; this.selectedGuest = null; }

  saveGuestChanges(updatedGuest: Guest) {
    const index = this.guests.findIndex(g => g.id === updatedGuest.id);
    if (index !== -1) {
      this.guests[index] = updatedGuest;
      const tableIndex = this.tableData.findIndex(t => t.id === updatedGuest.id);
      if (tableIndex !== -1) {
        this.tableData[tableIndex] = {
          id: updatedGuest.id,
          user: { image: updatedGuest.image, name: updatedGuest.name },
          email: updatedGuest.email,
          phone: updatedGuest.phone,
          status: updatedGuest.status
        };
      }
    }
    this.closeEditGuestModal();
  }

  onCardSettingsChange(settings: any) { this.cardSettings = { ...settings }; }
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


  questions: QuestionItem[] = [
    {
      id: 101, title: 'Qual foi sua experiência no evento? (texto aberto)', type: 'text', answers: [
        { user: { id: 1, image: '/images/user/user-20.jpg', name: 'João Silva' }, value: 'Excelente, organização impecável!' },
        { user: { id: 2, image: '/images/user/user-21.jpg', name: 'Maria Santos' }, value: 'Gostei muito, mas faltou água nos banheiros.' }
      ]
    },
    {
      id: 102, title: 'Qual atração você mais gostou? (múltipla escolha - uma resposta)', type: 'single_choice', answers: [
        { user: { id: 3, image: '/images/user/user-22.jpg', name: 'Pedro Costa' }, value: 'Banda Sunrise' },
        { user: { id: 4, image: '/images/user/user-23.jpg', name: 'Ana Oliveira' }, value: 'DJ Nightfall' }
      ]
    },
    {
      id: 103, title: 'Quais áreas você visitou? (múltipla escolha - múltiplas respostas)', type: 'multiple_choice', answers: [
        { user: { id: 5, image: '/images/user/user-24.jpg', name: 'Carlos Ferreira' }, value: ['Palco Principal', 'Área VIP', 'Food Trucks'] },
        { user: { id: 1, image: '/images/user/user-20.jpg', name: 'João Silva' }, value: ['Palco Secundário', 'Área VIP'] }
      ]
    },
    {
      id: 104, title: 'Você indicaria o evento para um amigo? (enquete)', type: 'poll', answers: [
        { user: { id: 2, image: '/images/user/user-21.jpg', name: 'Maria Santos' }, value: 'Sim' },
        { user: { id: 3, image: '/images/user/user-22.jpg', name: 'Pedro Costa' }, value: 'Não' }
      ]
    }
  ];

  private expandedQuestionIds = new Set<number>();
  private questionTableState: Record<number, { currentPage: number; itemsPerPage: number; searchTerm: string }> = {};

  getQuestionState(id: number) {
    if (!this.questionTableState[id]) { this.questionTableState[id] = { currentPage: 1, itemsPerPage: 8, searchTerm: '' }; }
    return this.questionTableState[id];
  }
  toggleQuestion(id: number) { if (this.expandedQuestionIds.has(id)) { this.expandedQuestionIds.delete(id); } else { this.expandedQuestionIds.add(id); this.getQuestionState(id); } }
  isQuestionExpanded(id: number): boolean { return this.expandedQuestionIds.has(id); }

  exportQuestionAnswersCSV(question: QuestionItem) {
    const rows = question.answers.map(ans => ({ 'Pergunta': question.title, 'Usuário': ans.user.name, 'Resposta': Array.isArray(ans.value) ? (ans.value as string[]).join(', ') : (ans.value as string) }));
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
    this.questions.forEach(q => { q.answers.forEach(ans => { rows.push({ 'Pergunta': q.title, 'Usuário': ans.user.name, 'Resposta': Array.isArray(ans.value) ? (ans.value as string[]).join(', ') : (ans.value as string) }); }); });
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

  updateQuestionSearchTerm(id: number, term: string) { const state = this.getQuestionState(id); state.searchTerm = term || ''; state.currentPage = 1; }
  onQuestionItemsPerPageChange(id: number) { const state = this.getQuestionState(id); state.currentPage = 1; }
  handleQuestionPageChange(id: number, page: number) { const state = this.getQuestionState(id); const total = this.getQuestionTotalPagesById(id); if (page >= 1 && page <= total) { state.currentPage = page; } }
  private normalizeAnswerValue(value: string | string[]): string { return Array.isArray(value) ? value.join(', ') : value; }
  getQuestionFilteredAnswers(question: QuestionItem): AnswerItem[] { const state = this.getQuestionState(question.id); const term = state.searchTerm.toLowerCase(); return question.answers.filter(ans => { const nameMatch = ans.user.name.toLowerCase().includes(term); const answerText = this.normalizeAnswerValue(ans.value).toLowerCase(); const answerMatch = answerText.includes(term); return nameMatch || answerMatch; }); }
  getQuestionTotalItems(question: QuestionItem): number { return this.getQuestionFilteredAnswers(question).length; }
  getQuestionTotalPages(question: QuestionItem): number { const state = this.getQuestionState(question.id); return Math.ceil(this.getQuestionTotalItems(question) / state.itemsPerPage); }
  private getQuestionTotalPagesById(id: number): number { const q = this.questions.find(x => x.id === id); if (!q) return 1; return this.getQuestionTotalPages(q); }
  getQuestionStartIndex(question: QuestionItem): number { const state = this.getQuestionState(question.id); return (state.currentPage - 1) * state.itemsPerPage; }
  getQuestionEndIndex(question: QuestionItem): number { return Math.min(this.getQuestionStartIndex(question) + this.getQuestionState(question.id).itemsPerPage, this.getQuestionTotalItems(question)); }
  getQuestionPageAnswers(question: QuestionItem): AnswerItem[] { const filtered = this.getQuestionFilteredAnswers(question); const start = this.getQuestionStartIndex(question); const end = this.getQuestionEndIndex(question); return filtered.slice(start, end); }
  toAnswerText(value: string | string[]): string { return Array.isArray(value) ? value.join(', ') : value; }

  questionBarChart: ApexChart = { fontFamily: 'Outfit, sans-serif', type: 'bar', height: 220, toolbar: { show: false } };
  questionBarPlotOptions: ApexPlotOptions = { bar: { horizontal: true, barHeight: '60%', borderRadius: 6, borderRadiusApplication: 'end' } };
  questionBarDataLabels: ApexDataLabels = { enabled: false };
  questionBarLegend: ApexLegend = { show: false };
  questionBarYAxis: ApexYAxis = { title: { text: undefined } };
  questionBarColors: string[] = ['#465fff'];

  private computeCounts(question: QuestionItem): { labels: string[]; counts: number[] } | null {
    if (question.type === 'text') return null;
    const map = new Map<string, number>();
    question.answers.forEach(ans => {
      if (Array.isArray(ans.value)) {
        (ans.value as string[]).forEach(val => { map.set(val, (map.get(val) || 0) + 1); });
      } else {
        const v = ans.value as string; map.set(v, (map.get(v) || 0) + 1);
      }
    });
    const labels = Array.from(map.keys());
    const counts = labels.map(l => map.get(l) || 0);
    return { labels, counts };
  }
  getQuestionChartSeries(question: QuestionItem): ApexAxisChartSeries { const data = this.computeCounts(question); return [{ name: 'Respostas', data: data ? data.counts : [] }]; }
  getQuestionChartXAxis(question: QuestionItem): ApexXAxis { const data = this.computeCounts(question); return { categories: data ? data.labels : [] }; }
  getQuestionTotalResponses(question: QuestionItem): number { return question.answers.length; }
}