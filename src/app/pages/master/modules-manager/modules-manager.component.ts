import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MasterService } from '../services/master.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-modules-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modules-manager.component.html',
})
export class ModulesManagerComponent implements OnInit {
  users: any[] = [];
  filteredUsers: any[] = [];
  modules: any[] = [];
  loading = false;
  searchTerm: string = '';

  constructor(private masterService: MasterService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    forkJoin({
      modules: this.masterService.getModules(),
      users: this.masterService.getUsers()
    }).subscribe({
      next: (result: any) => {
        console.log('Modules response:', result.modules);
        console.log('Users response:', result.users);

        // Tratamento robusto para módulos
        if (Array.isArray(result.modules)) {
          this.modules = result.modules;
        } else if (result.modules?.data && Array.isArray(result.modules.data)) {
          this.modules = result.modules.data;
        } else {
          this.modules = [];
          console.warn('Formato de resposta de módulos inesperado', result.modules);
        }

        // Tratamento robusto para usuários
        if (Array.isArray(result.users)) {
          this.users = result.users;
        } else if (result.users?.data && Array.isArray(result.users.data)) {
          this.users = result.users.data;
        } else if (result.users?.users && Array.isArray(result.users.users)) {
             // Caso venha { success: true, users: [...] } ou similar
            this.users = result.users.users;
        } else {
          this.users = [];
          console.warn('Formato de resposta de usuários inesperado', result.users);
        }
        
        this.filterUsers();
        this.loading = false;
      },
      error: (err) => {
        console.error('Erro ao carregar dados:', err);
        this.loading = false;
      }
    });
  }

  filterUsers() {
    if (!this.searchTerm) {
      this.filteredUsers = this.users;
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredUsers = this.users.filter(user => 
      user.name?.toLowerCase().includes(term) || 
      user.email?.toLowerCase().includes(term) ||
      user.role?.toLowerCase().includes(term)
    );
  }

  toggleModule(user: any, module: any, event: any) {
    const isChecked = event.target.checked;
    
    if (!user.modules) user.modules = [];

    // Mapeia para IDs (agora UUIDs/id_code) para enviar ao backend
    // user.modules pode conter objetos com {id_code, ...}
    // O backend espera um array de strings (UUIDs)
    let currentModuleIds = user.modules.map((m: any) => m.id_code).filter((id: any) => id != null);

    if (isChecked) {
        if (!currentModuleIds.includes(module.id_code)) {
            currentModuleIds.push(module.id_code);
        }
    } else {
        currentModuleIds = currentModuleIds.filter((id: string) => id !== module.id_code);
    }

    this.masterService.updateUserModules(user.id_code, currentModuleIds).subscribe({
      next: () => {
         if (isChecked) {
            // Adiciona objeto completo para refletir na UI imediatamente
            // Garante que tenha id_code para as próximas operações
            user.modules.push(module);
         } else {
            user.modules = user.modules.filter((m: any) => m.id_code !== module.id_code);
         }
      },
      error: (err) => {
        console.error('Erro ao atualizar módulos', err);
        event.target.checked = !isChecked; // Reverter checkbox visualmente
        alert('Erro ao atualizar módulos');
      }
    });
  }
  
  hasModule(user: any, moduleIdCode: string): boolean {
    return user.modules?.some((m: any) => m.id_code === moduleIdCode);
  }
}
