import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, catchError, forkJoin, from, map, of, switchMap } from 'rxjs';
import { StoreInvite, StoreInviteService } from '../../../admin/stores/config/store-invite.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { StoreContextService, Store } from '../../../../shared/services/store-context.service';
import { ProjectService } from '../../project.service';
import { Project, ProjectStatus } from '../../project.types';
import { FinancialService } from '../../../../financial/financial.service';
import { Party } from '../../../../financial/models/party';
import { ImageUploadService } from '../../../../shared/services/image-upload.service';

type CreateTab = 'project' | 'stages' | 'team';

interface CollaboratorRow {
  user_id: string;
  email: string;
  role: string;
  selected: boolean;
}

interface StageRow {
  code: string;
  name: string;
  due_date: string;
  contract_value: number | null;
  hours_estimated: number | null;
  color: string;
}

@Component({
  selector: 'app-project-create',
  standalone: false,
  templateUrl: './project-create.component.html',
})
export class ProjectCreateComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private toast = inject(ToastService);
  private storeContext = inject(StoreContextService);
  private storeInviteService = inject(StoreInviteService);
  private financial = inject(FinancialService);
  private projectService = inject(ProjectService);
  private imageUploadService = inject(ImageUploadService);
  private sub = new Subscription();

  @ViewChild('logoFileInput') logoFileInput!: ElementRef<HTMLInputElement>;

  activeStore: Store | null = null;
  activeTab: CreateTab = 'project';
  isSubmitting = false;
  isProgressModalOpen = false;
  progressStep: 'idle' | 'creating' | 'uploading' | 'patching' | 'stages' | 'members' | 'done' | 'error' = 'idle';

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
    this.sub.add(
      this.storeContext.activeStore$.subscribe((st) => {
        this.activeStore = st;
        this.loadCollaborators();
        this.loadCustomers();
      })
    );
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
    this.storeInviteService.listInvites(storeId).subscribe({
      next: (res) => {
        const invites: StoreInvite[] = (res?.data || []) as StoreInvite[];
        const accepted = invites.filter((i) => i.status === 'accepted' && i.store_member_status === 'active');
        this.collaborators = accepted
          .map((i): CollaboratorRow | null => {
            const userId = String(i.member_id_code || i.store_member_id_code || '').trim();
            if (!userId) return null;
            const row: CollaboratorRow = {
              user_id: userId,
              email: i.invited_email,
              role: 'member',
              selected: false,
            };
            return row;
          })
          .filter((x): x is CollaboratorRow => x !== null);
      },
      error: () => {
        this.collaborators = [];
      },
    });
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

  save(): void {
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

        return {
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
    this.progressStep = 'creating';
    this.projectService
      .createProject({
        store_id: this.activeStore.id_code,
        name: this.name,
        client_party_id: this.selectedCustomerIdCode || null,
        responsible_name: this.responsible_name || null,
        logo_url: null,
        start_date: this.start_date || null,
        end_date: this.end_date || null,
        status: this.status,
      })
      .pipe(
        switchMap((created: Project) => {
          const projectIdCode = (created as any)?.id_code as string | undefined;
          if (!projectIdCode) return of(created);
          const patch: any = {};
          const desc = String(this.description || '').trim();
          if (desc) patch.description = desc;

          if (!this.pendingLogoFile) {
            if (Object.keys(patch).length === 0) return of(created);
            this.progressStep = 'patching';
            return this.projectService.updateProject(projectIdCode, patch).pipe(map(() => created));
          }

          this.progressStep = 'uploading';
          return from(
            this.imageUploadService.uploadImage(
              this.pendingLogoFile,
              'project-logo',
              projectIdCode,
              { maxWidth: 300, maxHeight: 300, quality: 0.8 },
              `projects/${projectIdCode}/branding`
            )
          ).pipe(
            switchMap((result) => {
              const filePath = this.sanitizeUrl(result?.filePath || '');
              if (result.success && filePath) patch.logo_url = filePath;
              if (Object.keys(patch).length === 0) return of(created);
              this.progressStep = 'patching';
              return this.projectService.updateProject(projectIdCode, patch).pipe(map(() => created));
            }),
            catchError(() => of(created))
          );
        }),
        switchMap((created: Project) => {
          const projectIdCode = (created as any)?.id_code as string | undefined;
          if (!projectIdCode) return of(created);
          this.progressStep = 'stages';
          const stages$ = stagePayloads.length
            ? forkJoin(stagePayloads.map((p) => this.projectService.createProjectStage(projectIdCode, p)))
            : of([]);
          return stages$.pipe(map(() => created));
        }),
        switchMap((created: Project) => {
          const projectIdCode = (created as any)?.id_code as string | undefined;
          if (!projectIdCode) return of(created);
          this.progressStep = 'members';
          const members$ = selectedMembers.length
            ? forkJoin(selectedMembers.map((m) => this.projectService.addProjectMember(projectIdCode, { user_id: m.user_id, role: m.role })))
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
          }, 500);
          this.toast.triggerToast('success', 'Sucesso', 'Projeto criado com sucesso.');
          this.router.navigate(['/project/admin/projects']);
        },
        error: () => {
          this.isSubmitting = false;
          this.progressStep = 'error';
          this.toast.triggerToast('error', 'Erro', 'Falha ao criar projeto.');
        },
      });
  }

  private sanitizeUrl(url: string): string {
    return String(url || '').trim().replace(/`/g, '');
  }

  private coerceMoneyToNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const s = String(value).trim();
    if (!s) return null;
    const cleaned = s.replace(/[^\d,.-]/g, '');
    if (!cleaned) return null;
    const negative = cleaned.includes('-');
    const core = cleaned.replace(/-/g, '');
    let normalized: string;
    if (core.includes(',')) {
      normalized = core.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = core.replace(/\./g, '');
    }
    const n = Number.parseFloat(normalized);
    if (!Number.isFinite(n)) return null;
    return negative ? -n : n;
  }
}
