import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { MasterService, SysModule } from '../services/master.service';

type SysModuleFormModel = {
  name: string;
  slug: string;
  description: string;
  home_path: string;
  active: boolean;
};

@Component({
  selector: 'app-sys-modules-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './sys-modules-management.component.html',
})
export class SysModulesManagementComponent implements OnInit {
  private masterService = inject(MasterService);

  loading = false;
  saving = false;
  errorMessage = '';

  showAll = true;
  searchTerm = '';

  modules: SysModule[] = [];

  isFormOpen = false;
  isEditing = false;
  editingIdCode: string | null = null;

  form: SysModuleFormModel = {
    name: '',
    slug: '',
    description: '',
    home_path: '',
    active: true,
  };

  ngOnInit(): void {
    this.loadModules();
  }

  loadModules(): void {
    this.loading = true;
    this.errorMessage = '';
    this.masterService.listSysModules(this.showAll).subscribe({
      next: (res: any) => {
        const list = this.extractModules(res);
        this.modules = list;
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || err?.message || 'Falha ao carregar módulos.';
      },
    });
  }

  get filteredModules(): SysModule[] {
    const term = String(this.searchTerm || '').trim().toLowerCase();
    const list = [...(this.modules || [])];
    list.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'));
    if (!term) return list;
    return list.filter((m) => {
      const name = String(m?.name || '').toLowerCase();
      const slug = String(m?.slug || '').toLowerCase();
      const path = String(m?.home_path || '').toLowerCase();
      return name.includes(term) || slug.includes(term) || path.includes(term);
    });
  }

  toggleShowAll(): void {
    this.showAll = !this.showAll;
    this.loadModules();
  }

  openCreate(): void {
    this.isEditing = false;
    this.editingIdCode = null;
    this.form = { name: '', slug: '', description: '', home_path: '', active: true };
    this.isFormOpen = true;
  }

  openEdit(m: SysModule): void {
    const idCode = String(m?.id_code || '');
    if (!idCode) return;
    this.isEditing = true;
    this.editingIdCode = idCode;
    this.form = {
      name: String(m?.name || ''),
      slug: String(m?.slug || ''),
      description: String(m?.description || ''),
      home_path: String(m?.home_path || ''),
      active: m?.active !== false,
    };
    this.isFormOpen = true;

    this.masterService.getSysModule(idCode).subscribe({
      next: (res: any) => {
        const mod = this.extractOne(res);
        if (!mod) return;
        this.form = {
          name: String(mod?.name || ''),
          slug: String(mod?.slug || ''),
          description: String(mod?.description || ''),
          home_path: String(mod?.home_path || ''),
          active: mod?.active !== false,
        };
      },
      error: () => {},
    });
  }

  closeForm(): void {
    this.isFormOpen = false;
    this.saving = false;
  }

  save(): void {
    const payload = this.buildPayload();
    if (!payload) return;
    if (this.saving) return;
    this.saving = true;

    if (!this.isEditing) {
      this.masterService.createSysModule(payload).subscribe({
        next: () => {
          this.saving = false;
          this.isFormOpen = false;
          this.loadModules();
        },
        error: (err: any) => {
          this.saving = false;
          this.errorMessage = err?.error?.message || err?.message || 'Falha ao criar módulo.';
        },
      });
      return;
    }

    const idCode = String(this.editingIdCode || '');
    if (!idCode) {
      this.saving = false;
      return;
    }
    this.masterService.updateSysModule(idCode, payload).subscribe({
      next: () => {
        this.saving = false;
        this.isFormOpen = false;
        this.loadModules();
      },
      error: (err: any) => {
        this.saving = false;
        this.errorMessage = err?.error?.message || err?.message || 'Falha ao atualizar módulo.';
      },
    });
  }

  toggleActive(m: SysModule): void {
    const idCode = String(m?.id_code || '');
    if (!idCode) return;
    if (this.saving) return;
    this.saving = true;
    const nextActive = !(m?.active !== false);
    this.masterService.updateSysModule(idCode, { active: nextActive }).subscribe({
      next: () => {
        this.saving = false;
        m.active = nextActive;
      },
      error: (err: any) => {
        this.saving = false;
        this.errorMessage = err?.error?.message || err?.message || 'Falha ao atualizar status.';
      },
    });
  }

  private buildPayload(): { name: string; slug: string; description?: string | null; home_path?: string | null; active?: boolean } | null {
    const name = String(this.form.name || '').trim();
    const slug = String(this.form.slug || '').trim();
    if (!name || !slug) {
      this.errorMessage = 'Nome e slug são obrigatórios.';
      return null;
    }
    const description = String(this.form.description || '');
    const homePath = String(this.form.home_path || '');
    return {
      name,
      slug,
      description: description.trim() ? description : null,
      home_path: homePath.trim() ? homePath : null,
      active: !!this.form.active,
    };
  }

  private extractModules(res: any): SysModule[] {
    const data = res?.data ?? res;
    const list = data?.modules ?? data?.sys_modules ?? data;
    if (Array.isArray(list)) return list as SysModule[];
    return [];
  }

  private extractOne(res: any): SysModule | null {
    const data = res?.data ?? res;
    const mod = data?.module ?? data?.sys_module ?? data;
    if (mod && typeof mod === 'object') return mod as SysModule;
    return null;
  }
}

