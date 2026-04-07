import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, catchError, forkJoin, from, map, of, switchMap } from 'rxjs';
import { StoreInvite, StoreInviteService } from '../../../admin/stores/config/store-invite.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { StoreContextService, Store } from '../../../../shared/services/store-context.service';
import { ProjectService } from '../../project.service';
import { Project, ProjectStatus } from '../../project.types';
import { FinancialService } from '../../../../financial/financial.service';
import { Party } from '../../../../financial/models/party';
import { ImageUploadService } from '../../../../shared/services/image-upload.service';
import { MemberCostsService, MemberCost } from '../../../admin/organizations/member-costs.service';

type CreateTab = 'project' | 'stages' | 'team';

interface CollaboratorRow {
  user_id: string;
  email: string;
  role: string;
  selected: boolean;
  // Dados base da unidade
  base_hourly_rate?: number;
  base_overhead_multiplier?: number;
  timezone?: string;
  // Overrides específicos do projeto
  hourly_rate_override?: number | null;
  overhead_multiplier_override?: number | null;
  timezone_override?: string | null;
}

interface StageRow {
  id_code?: string;
  code: string;
  name: string;
  due_date: string;
  contract_value: number | null;
  hours_estimated: number | null;
  color: string;
}

const TIMEZONES = [
  { value: 'UTC', label: 'Universal Standard Time (UTC)' },
  // --- BRASIL ---
  { value: "America/Sao_Paulo", label: "Brasil - Brasília (SP, RJ, Sul, MG, NE)" },
  { value: "America/Manaus", label: "Brasil - Amazonas (AM, RR, RO)" },
  { value: "America/Cuiaba", label: "Brasil - Mato Grosso (MT)" },
  { value: "America/Campo_Grande", label: "Brasil - Mato Grosso do Sul (MS)" },
  { value: "America/Rio_Branco", label: "Brasil - Acre (AC)" },
  { value: "America/Noronha", label: "Brasil - Fernando de Noronha" },

  // --- PORTUGAL & EUROPA ---
  { value: "Europe/Lisbon", label: "Portugal - Lisboa/Porto" },
  { value: "Atlantic/Madeira", label: "Portugal - Ilha da Madeira" },
  { value: "Atlantic/Azores", label: "Portugal - Açores" },
  { value: "Europe/London", label: "Reino Unido - Londres" },
  { value: "Europe/Madrid", label: "Espanha - Madrid/Barcelona" },
  { value: "Europe/Paris", label: "França - Paris" },
  { value: "Europe/Berlin", label: "Alemanha - Berlim" },
  { value: "Europe/Zurich", label: "Suíça - Zurique/Genebra" },
  { value: "Europe/Dublin", label: "Irlanda - Dublin" },
  { value: "Europe/Rome", label: "Itália - Roma/Milão" },

  // --- OCEANIA ---
  { value: "Australia/Sydney", label: "Austrália - Sydney, Melbourne, Canberra" },
  { value: "Australia/Adelaide", label: "Austrália - Adelaide" },
  { value: "Australia/Brisbane", label: "Austrália - Brisbane (Queensland)" },
  { value: "Australia/Perth", label: "Austrália - Perth" },
  { value: "Pacific/Auckland", label: "Nova Zelândia - Auckland/Wellington" },

  // --- AMÉRICA DO NORTE ---
  { value: "America/New_York", label: "EUA - Nova York, Miami, Orlando (Eastern)" },
  { value: "America/Chicago", label: "EUA - Chicago, Texas (Central)" },
  { value: "America/Denver", label: "EUA - Denver (Mountain)" },
  { value: "America/Los_Angeles", label: "EUA - Los Angeles, San Francisco (Pacific)" },
  { value: "America/Toronto", label: "Canadá - Toronto, Montreal" },
  { value: "America/Vancouver", label: "Canadá - Vancouver" },

  // --- AMÉRICA DO SUL & CENTRAL ---
  { value: "America/Argentina/Buenos_Aires", label: "Argentina - Buenos Aires" },
  { value: "America/Montevideo", label: "Uruguai - Montevidéu" },
  { value: "America/Santiago", label: "Chile - Santiago" },
  { value: "America/Asuncion", label: "Paraguai - Assunção" },
  { value: "America/La_Paz", label: "Bolívia - La Paz" },
  { value: "America/Bogota", label: "Colômbia - Bogotá" },
  { value: "America/Lima", label: "Peru - Lima" },
  { value: "America/Mexico_City", label: "México - Cidade do México" },

  // --- ÁSIA & ORIENTE MÉDIO ---
  { value: "Asia/Tokyo", label: "Japão - Tóquio" },
  { value: "Asia/Shanghai", label: "China - Xangai/Pequim" },
  { value: "Asia/Dubai", label: "EAU - Dubai" },
  { value: "Asia/Qatar", label: "Catar - Doha" },
  { value: "Asia/Jerusalem", label: "Israel - Jerusalém/Tel Aviv" },
  { value: "Asia/Singapore", label: "Singapura" },

  // --- ÁFRICA ---
  { value: "Africa/Luanda", label: "Angola - Luanda" },
  { value: "Africa/Maputo", label: "Moçambique - Maputo" },
  { value: "Africa/Johannesburg", label: "África do Sul - Joanesburgo" },
  { value: "Africa/Cairo", label: "Egito - Cairo" }
];

@Component({
  selector: 'app-project-create',
  standalone: false,
  templateUrl: './project-create.component.html',
})
export class ProjectCreateComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private storeContext = inject(StoreContextService);
  private storeInviteService = inject(StoreInviteService);
  private financial = inject(FinancialService);
  private projectService = inject(ProjectService);
  private imageUploadService = inject(ImageUploadService);
  private memberCostsService = inject(MemberCostsService);
  private sub = new Subscription();

  @ViewChild('logoFileInput') logoFileInput!: ElementRef<HTMLInputElement>;

  activeStore: Store | null = null;
  activeTab: CreateTab = 'project';
  isLoading = false;
  isSubmitting = false;

  // Modal para editar detalhes do membro no projeto
  isMemberModalOpen = false;
  editingMember: CollaboratorRow | null = null;
  timezones = TIMEZONES;
  isProgressModalOpen = false;
  progressStep: 'idle' | 'creating' | 'uploading' | 'patching' | 'stages' | 'members' | 'done' | 'error' = 'idle';

  projectIdCode: string | null = null;
  projectData: Project | null = null;

  name = '';
  description = '';
  client_name = '';
  selectedCustomerIdCode = '';
  responsible_name = '';
  customers: Party[] = [];
  isLoadingCustomers = false;
  logo_url = '';
  logoPreviewUrl = '';
  pendingLogoFile: File | null = null;
  start_date = new Date().toISOString().slice(0, 10);
  end_date = '';
  status: ProjectStatus = 'draft';

  stages: StageRow[] = [];

  collaborators: CollaboratorRow[] = [];

  ngOnInit(): void {
    this.projectIdCode = this.route.snapshot.paramMap.get('id_code');
    this.sub.add(
      this.storeContext.activeStore$.subscribe((st) => {
        this.activeStore = st;
        this.loadCollaborators();
        this.loadCustomers();
        if (this.projectIdCode) {
           this.loadProjectForEdit();
        }
      })
    );
  }

  private loadProjectForEdit(): void {
    if (!this.projectIdCode) return;
    this.projectService.getProjectById(this.projectIdCode).subscribe({
      next: (p) => {
        if (!p) return;
        this.projectData = p;
        this.name = p.name || '';
        this.description = p.description || '';
        this.client_name = p.client_name || '';
        this.selectedCustomerIdCode = p.client_party_id || '';
        this.responsible_name = p.responsible_name || '';
        this.logoPreviewUrl = p.logo_url || '';
        this.start_date = p.start_date ? p.start_date.slice(0, 10) : '';
        this.end_date = p.end_date ? p.end_date.slice(0, 10) : '';
        this.status = p.status || 'draft';

        if (Array.isArray(p.stages)) {
           this.stages = p.stages.map(s => ({
             id_code: s.id_code,
             code: s.acronym || '',
             name: s.title || '',
             due_date: s.due_date ? s.due_date.slice(0, 10) : '',
             contract_value: s.contract_value || null,
             hours_estimated: s.estimated_hours || null,
             color: s.color_1 || '#3b82f6'
           }));
        }
        this.syncProjectMembers();
      },
      error: () => {
        this.toast.triggerToast('error', 'Erro', 'Erro ao carregar dados do projeto.');
      }
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private loadCollaborators(): void {
    const storeId = this.activeStore?.id_code;
    if (!storeId) {
      this.collaborators = [];
      return;
    }

    // Buscamos os custos base de todos primeiro
    this.memberCostsService.getMemberCosts(storeId).pipe(
      catchError(() => of({ data: { member_costs: [] } })),
      switchMap((costsResp: any) => {
        const baseCosts: MemberCost[] = costsResp?.data?.member_costs || [];
        
        return this.storeInviteService.listInvites(storeId).pipe(
          map(resp => {
            const invites: StoreInvite[] = (resp?.data || []) as StoreInvite[];
            const accepted = invites.filter((i) => i.status === 'accepted' && i.store_member_status === 'active');
            return accepted.map((i): CollaboratorRow | null => {
              // Pegamos o UUID do usuário (id_code da tabela users)
              const userId = String(i.user_id_code || '').trim();
              if (!userId) return null;
              
              const base = baseCosts.find(c => c.user_id === userId);

              return {
                user_id: userId,
                email: i.invited_email,
                role: 'member',
                selected: false,
                base_hourly_rate: base?.hourly_rate || 0,
                base_overhead_multiplier: base?.overhead_multiplier || 1,
                timezone: base?.timezone || 'UTC',
                hourly_rate_override: null,
                overhead_multiplier_override: null,
                timezone_override: null
              };
            }).filter((x): x is CollaboratorRow => x !== null);
          })
        );
      })
    ).subscribe({
      next: (rows) => {
        this.collaborators = rows;
        this.syncProjectMembers();
      },
      error: () => {
        this.collaborators = [];
      }
    });
  }

  private syncProjectMembers(): void {
    if (!this.collaborators.length || !this.projectData) return;
    const members = this.projectData.members || [];
    
    this.collaborators = this.collaborators.map(c => {
      // Procurar o usuário na lista de membros do projeto (Fonte da Verdade)
      const existing = members.find(m => {
        const u = (m as any).user;
        const targetId = String(c.user_id).trim().toLowerCase();
        
        // No novo formato, o user.id dentro do membro é o id_code (UUID)
        // Verificamos por id ou id_code para maior robustez
        const matchId = u?.id && String(u.id).trim().toLowerCase() === targetId;
        const matchIdCode = u?.id_code && String(u.id_code).trim().toLowerCase() === targetId;
        
        return !!(matchId || matchIdCode);
      });

      if (existing) {
        return {
          ...c,
          // Checkbox marcado apenas se estiver ativo no projeto
          selected: existing.status === 'active' || existing.status === 'working' || existing.status === 'idle',
          role: existing.role || 'member',
          hourly_rate_override: (existing as any).hourly_rate_override || null,
          overhead_multiplier_override: (existing as any).overhead_multiplier_override || null,
          timezone_override: (existing as any).timezone_override || null
        };
      }
      return { ...c, selected: false }; 
    });
  }

  openMemberEdit(member: CollaboratorRow): void {
    this.editingMember = { ...member };
    this.isMemberModalOpen = true;
  }

  saveMemberEdit(): void {
    if (!this.editingMember) return;
    const idx = this.collaborators.findIndex(c => c.user_id === this.editingMember?.user_id);
    if (idx !== -1) {
      this.collaborators[idx] = { ...this.editingMember };
    }
    this.isMemberModalOpen = false;
    this.editingMember = null;
  }

  private loadCustomers(): void {
    const storeId = this.activeStore?.id_code;
    if (!storeId) {
      this.customers = [];
      this.selectedCustomerIdCode = '';
      return;
    }
    this.isLoadingCustomers = true;
    this.financial.getParties(storeId, 'customer').subscribe({
      next: (rows) => {
        this.customers = Array.isArray(rows) ? rows : [];
        this.isLoadingCustomers = false;
      },
      error: () => {
        this.customers = [];
        this.isLoadingCustomers = false;
      },
    });
  }

  onCustomerChange(idCode: string): void {
    const id = String(idCode || '').trim();
    const party = this.customers.find((p) => p.id_code === id);
    this.client_name = party?.name || '';
  }

  triggerLogoInput(): void {
    this.logoFileInput?.nativeElement?.click();
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const maxBytes = 300 * 1024;
    if (file.size > maxBytes) {
      this.toast.triggerToast('warning', 'Logo muito grande', 'Envie um arquivo de até 300KB.');
      input.value = '';
      this.clearLogo();
      return;
    }
    this.pendingLogoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.logoPreviewUrl = (e.target?.result as string) || '';
    };
    reader.readAsDataURL(file);
  }

  clearLogo(): void {
    this.pendingLogoFile = null;
    this.logoPreviewUrl = '';
    if (this.logoFileInput?.nativeElement) this.logoFileInput.nativeElement.value = '';
  }

  get progressMessage(): string {
    if (this.progressStep === 'creating') return 'Criando projeto...';
    if (this.progressStep === 'uploading') return 'Enviando logo...';
    if (this.progressStep === 'patching') return 'Atualizando dados do projeto...';
    if (this.progressStep === 'stages') return 'Inserindo etapas...';
    if (this.progressStep === 'members') return 'Vinculando equipe...';
    if (this.progressStep === 'done') return 'Concluído.';
    if (this.progressStep === 'error') return 'Ocorreu um erro.';
    return 'Processando...';
  }

  stepLabel(step: 'creating' | 'uploading' | 'patching' | 'stages' | 'members'): string {
    const order = ['creating', 'uploading', 'patching', 'stages', 'members'] as const;
    const currentIdx = order.indexOf(this.progressStep as any);
    const stepIdx = order.indexOf(step);
    if (this.progressStep === 'error') return stepIdx <= currentIdx ? 'erro' : '—';
    if (this.progressStep === 'done') return 'ok';
    if (stepIdx < currentIdx) return 'ok';
    if (stepIdx === currentIdx) return '...';
    return '—';
  }

  closeProgressModal(): void {
    this.isProgressModalOpen = false;
  }

  addStage(): void {
    this.stages = [
      ...this.stages,
      { code: '', name: '', due_date: '', contract_value: null, hours_estimated: null, color: '#3b82f6' },
    ];
  }

  removeStage(s: StageRow): void {
    this.stages = this.stages.filter((x) => x !== s);
  }

  onStartPickerChange(event: any): void {
    const dateStr = String(event?.dateStr || '').trim();
    if (!dateStr) return;
    this.start_date = dateStr;
    if (this.end_date && this.end_date < this.start_date) {
      this.end_date = this.start_date;
    }
  }

  onEndPickerChange(event: any): void {
    const dateStr = String(event?.dateStr || '').trim();
    if (!dateStr) return;
    this.end_date = dateStr;
    if (this.start_date && this.end_date < this.start_date) {
      this.end_date = this.start_date;
    }
  }

  onStageDuePickerChange(index: number, event: any): void {
    const dateStr = String(event?.dateStr || '').trim();
    if (!dateStr) return;
    const row = this.stages[index];
    if (!row) return;
    row.due_date = dateStr;
  }

  sanitizeStageHours(s: StageRow): void {
    if (s.hours_estimated == null) return;
    const n = Number(s.hours_estimated);
    if (!Number.isFinite(n)) {
      s.hours_estimated = null;
      return;
    }
    s.hours_estimated = Math.max(0, Math.trunc(n));
  }

  saveProjectOnly(): void {
    if (!this.projectIdCode) return;
    this.isSubmitting = true;
    this.projectService.updateProject(this.projectIdCode, {
      name: this.name,
      client_party_id: this.selectedCustomerIdCode || null,
      responsible_name: this.responsible_name || null,
      start_date: this.start_date || null,
      end_date: this.end_date || null,
      status: this.status,
      description: this.description || null
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.toast.triggerToast('success', 'Atualizado', 'Dados do projeto atualizados!');
      },
      error: () => {
        this.isSubmitting = false;
        this.toast.triggerToast('error', 'Erro', 'Erro ao atualizar projeto.');
      }
    });
  }

  saveStagesOnly(): void {
    if (!this.projectIdCode) return;
    this.isSubmitting = true;
    const stagePayloads = this.stages.map((s, idx) => ({
      id_code: s.id_code,
      title: s.name,
      acronym: s.code,
      order_index: idx + 1,
      contract_value: s.contract_value,
      estimated_hours: s.hours_estimated,
      status: 'planned',
      color_1: s.color,
      color_2: null,
    })).filter(s => !!s.title);

    const toCreate = stagePayloads.filter(s => !s.id_code); 
    const toUpdate = stagePayloads.filter(s => !!s.id_code);

    const creation$ = toCreate.length
      ? forkJoin(toCreate.map((p) => this.projectService.createProjectStage(this.projectIdCode!, p)))
      : of([]);

    const update$ = toUpdate.length
      ? forkJoin(toUpdate.map((p) => this.projectService.updateProjectStage(p.id_code!, p)))
      : of([]);

    forkJoin([creation$, update$]).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.toast.triggerToast('success', 'Atualizado', 'Etapas atualizadas!');
        this.loadProjectForEdit();
      },
      error: () => {
        this.isSubmitting = false;
        this.toast.triggerToast('error', 'Erro', 'Erro ao atualizar etapas.');
      }
    });
  }

  saveTeamOnly(): void {
    if (!this.projectIdCode) return;
    this.isSubmitting = true;
    const selected = this.collaborators.filter(c => c.selected);
    
    // addProjectMember no back faz update se já existe
    forkJoin(selected.map((m) => this.projectService.addProjectMember(this.projectIdCode!, { 
      user_id: m.user_id, 
      role: m.role,
      hourly_rate_override: m.hourly_rate_override,
      overhead_multiplier_override: m.overhead_multiplier_override,
      timezone_override: m.timezone_override
    }))).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.toast.triggerToast('success', 'Atualizado', 'Equipe atualizada!');
      },
      error: () => {
        this.isSubmitting = false;
        this.toast.triggerToast('error', 'Erro', 'Erro ao atualizar equipe.');
      }
    });
  }

  save(): void {
    if (this.isSubmitting) return;

    if (this.projectIdCode) {
      if (this.activeTab === 'project') this.saveProjectOnly();
      else if (this.activeTab === 'stages') this.saveStagesOnly();
      else if (this.activeTab === 'team') this.saveTeamOnly();
      return;
    }

    if (!this.activeStore?.id_code) return;
    if (!this.name.trim()) {
      this.toast.triggerToast('warning', 'Campos pendentes', 'Informe o nome do projeto.');
      this.activeTab = 'project';
      return;
    }

    const stagePayloads = this.stages
      .map((s, idx) => {
        const acronym = (s.code || '').trim();
        const title = (s.name || '').trim() || acronym;
        const contractValue = this.coerceMoneyToNumber(s.contract_value);
        const hours = s.hours_estimated == null ? null : Math.max(0, Math.trunc(Number(s.hours_estimated)));
        const color1 = (s.color || '').trim() || null;
        const idCode = (s as any).id_code;

        return {
          id_code: idCode,
          title,
          acronym: acronym || null,
          order_index: idx + 1,
          due_date: (s.due_date || '').trim() || null,
          start_date: null,
          contract_value: contractValue,
          estimated_hours: Number.isFinite(hours as any) ? hours : null,
          status: 'planned',
          color_1: color1,
          color_2: null,
        };
      })
      .filter((s) => !!s.title);

    const selectedMembers = this.collaborators.filter((c) => c.selected);

    this.isSubmitting = true;
    this.isProgressModalOpen = true;
    this.progressStep = this.projectIdCode ? 'patching' : 'creating';
    
    const projectAction$ = this.projectIdCode 
      ? this.projectService.updateProject(this.projectIdCode, {
          name: this.name,
          client_party_id: this.selectedCustomerIdCode || null,
          responsible_name: this.responsible_name || null,
          start_date: this.start_date || null,
          end_date: this.end_date || null,
          status: this.status,
          description: this.description || null
        }).pipe(map(() => ({ id_code: this.projectIdCode }) as Project))
      : this.projectService.createProject({
          store_id: this.activeStore.id_code,
          name: this.name,
          client_party_id: this.selectedCustomerIdCode || null,
          responsible_name: this.responsible_name || null,
          logo_url: null,
          start_date: this.start_date || null,
          end_date: this.end_date || null,
          status: this.status,
        });

    projectAction$
      .pipe(
        switchMap((created: Project) => {
          const idCode = (created as any)?.id_code as string | undefined;
          if (!idCode) return of(created);
          
          if (!this.pendingLogoFile) return of(created);

          this.progressStep = 'uploading';
          return from(
            this.imageUploadService.uploadImage(
              this.pendingLogoFile,
              'project-logo',
              idCode,
              { maxWidth: 300, maxHeight: 300, quality: 0.8 },
              `projects/${idCode}/branding`
            )
          ).pipe(
            switchMap((result) => {
              const filePath = this.sanitizeUrl(result?.filePath || '');
              if (result.success && filePath) {
                this.progressStep = 'patching';
                return this.projectService.updateProject(idCode, { logo_url: filePath }).pipe(map(() => created));
              }
              return of(created);
            }),
            catchError(() => of(created))
          );
        }),
        switchMap((created: Project) => {
          const idCode = (created as any)?.id_code as string | undefined;
          if (!idCode) return of(created);

          this.progressStep = 'stages';
          const toCreate = stagePayloads.filter(s => !(s as any).id_code); 
          const toUpdate = stagePayloads.filter(s => !!(s as any).id_code);

          const creation$ = toCreate.length
            ? forkJoin(toCreate.map((p) => this.projectService.createProjectStage(idCode, p)))
            : of([]);

          const update$ = toUpdate.length
            ? forkJoin(toUpdate.map((p) => this.projectService.updateProjectStage((p as any).id_code, p)))
            : of([]);

          return forkJoin([creation$, update$]).pipe(map(() => created));
        }),
        switchMap((created: Project) => {
          const idCode = (created as any)?.id_code as string | undefined;
          if (!idCode) return of(created);
          
          this.progressStep = 'members';
          // addProjectMember no back faz update se já existe, então é seguro chamar para os selecionados.
          const members$ = selectedMembers.length
            ? forkJoin(selectedMembers.map((m) => this.projectService.addProjectMember(idCode, { 
                user_id: m.user_id, 
                role: m.role,
                hourly_rate_override: m.hourly_rate_override,
                overhead_multiplier_override: m.overhead_multiplier_override,
                timezone_override: m.timezone_override
              })))
            : of([]);
          return members$.pipe(map(() => created));
        })
      )
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.progressStep = 'done';
          setTimeout(() => {
            this.isProgressModalOpen = false;
            this.toast.triggerToast('success', 'Sucesso', this.projectIdCode ? 'Projeto atualizado.' : 'Projeto criado com sucesso.');
            this.router.navigate(['/project/admin/projects']);
          }, 800);
        },
        error: () => {
          this.isSubmitting = false;
          this.progressStep = 'error';
          this.toast.triggerToast('error', 'Erro', 'Falha ao salvar projeto.');
        },
      });
  }

  private sanitizeUrl(url: string): string {
    return String(url || '').trim().replace(/`/g, '');
  }

  private coerceMoneyToNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    
    let s = String(value).trim();
    if (!s) return null;

    // 1. Remover todos os pontos "."
    const r1 = s.split('.').join('');
    
    // 2. Substituir todas as vírgulas "," por pontos "."
    const r2 = r1.split(',').join('.');
    
    // 3. Remover caracteres antes do primeiro dígito (como "R$ ")
    const r3 = r2.replace(/^[^\d-]*/, ''); 
    
    const n = parseFloat(r3);
    return Number.isFinite(n) ? n : null;
  }
}
