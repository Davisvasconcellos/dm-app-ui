import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MasterService } from '../services/master.service';

type MasterUser = {
  id_code?: string;
  id?: string | number;
  name?: string;
  email?: string;
  role?: string;
};

@Component({
  selector: 'app-master-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './master-user-management.component.html',
})
export class MasterUserManagementComponent implements OnInit {
  private masterService = inject(MasterService);

  users: MasterUser[] = [];
  filteredUsers: MasterUser[] = [];
  loading = false;
  searchTerm = '';

  roleOptions = [
    'master',
    'admin',
    'manager',
    'waiter',
    'customer',
    'user',
  ];

  updatingByUserId = new Set<string>();

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.masterService.getUsers().subscribe({
      next: (resp: any) => {
        const raw = Array.isArray(resp) ? resp : (resp?.data || resp?.users || []);
        this.users = Array.isArray(raw) ? raw : [];
        this.filterUsers();
        this.loading = false;
      },
      error: () => {
        this.users = [];
        this.filteredUsers = [];
        this.loading = false;
      },
    });
  }

  filterUsers(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredUsers = this.users;
      return;
    }
    this.filteredUsers = this.users.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      return name.includes(term) || email.includes(term) || role.includes(term);
    });
  }

  getUserKey(u: MasterUser): string {
    return String(u.id_code || u.id || '');
  }

  isUpdating(u: MasterUser): boolean {
    const key = this.getUserKey(u);
    if (!key) return false;
    return this.updatingByUserId.has(key);
  }

  onRoleChange(u: MasterUser, nextRole: string): void {
    const key = this.getUserKey(u);
    if (!key) return;
    const prevRole = u.role || '';
    if (prevRole === nextRole) return;

    this.updatingByUserId.add(key);
    u.role = nextRole;

    this.masterService.updateUserRole(key, nextRole).subscribe({
      next: () => {
        this.updatingByUserId.delete(key);
      },
      error: () => {
        u.role = prevRole;
        this.updatingByUserId.delete(key);
      },
    });
  }
}
