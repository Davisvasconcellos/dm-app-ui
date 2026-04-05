import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { RoleGuard } from '../../shared/guards/role.guard';
import { HomeProjectComponent } from './home-project/home-project.component';
import { ProjectAdminDashboardComponent } from './admin/project-admin-dashboard/project-admin-dashboard.component';
import { ProjectBackofficeComponent } from './admin/project-backoffice/project-backoffice.component';
import { ProjectCreateComponent } from './admin/project-create/project-create.component';
import { ProjectListComponent } from './admin/project-list/project-list.component';
import { ProjectSessionsComponent } from './admin/project-sessions/project-sessions.component';
import { ProjectMeComponent } from './me/project-me/project-me.component';
import { ProjectWorkComponent } from './work/project-work.component';
import { ProjectHistoryComponent } from './history/project-history.component';

const routes: Routes = [
  {
    path: '',
    component: HomeProjectComponent,
    canActivate: [AuthGuard],
    title: 'Projetos',
  },
  {
    path: 'home-project',
    component: HomeProjectComponent,
    canActivate: [AuthGuard],
    title: 'Projetos',
  },
  {
    path: 'work',
    component: ProjectWorkComponent,
    canActivate: [AuthGuard],
    title: 'Trabalho',
  },
  {
    path: 'history',
    component: ProjectHistoryComponent,
    canActivate: [AuthGuard],
    title: 'History',
  },
  {
    path: 'me',
    component: ProjectMeComponent,
    canActivate: [AuthGuard],
    title: 'Meu dia (Projetos)',
  },
  {
    path: 'admin',
    component: ProjectAdminDashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { expectedRoles: ['admin', 'master', 'manager'] },
    title: 'Projetos (Admin)',
  },
  {
    path: 'admin/projects',
    component: ProjectListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { expectedRoles: ['admin', 'master', 'manager'] },
    title: 'Lista de Projetos',
  },
  {
    path: 'admin/projects/create',
    component: ProjectCreateComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { expectedRoles: ['admin', 'master', 'manager'] },
    title: 'Adicionar Projeto',
  },
  {
    path: 'admin/sessions',
    component: ProjectSessionsComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { expectedRoles: ['admin', 'master', 'manager'] },
    title: 'Sessões (Projetos)',
  },
  {
    path: 'admin/backoffice',
    component: ProjectBackofficeComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { expectedRoles: ['admin', 'master', 'manager'] },
    title: 'Backoffice (Projetos)',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProjectRoutingModule {}
