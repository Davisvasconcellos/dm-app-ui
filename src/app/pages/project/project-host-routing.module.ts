import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { GuestGuard } from '../../shared/guards/guest.guard';
import { SignInComponent } from '../auth-pages/sign-in/sign-in.component';
import { SignoutComponent } from '../auth/signout/signout.component';
import { ProjectLayoutComponent } from './layout/project-layout/project-layout.component';

const routes: Routes = [
  {
    path: '',
    component: ProjectLayoutComponent,
    children: [
      { path: '', redirectTo: 'project', pathMatch: 'full' },
      {
        path: 'project',
        canActivate: [AuthGuard],
        loadChildren: () => import('./project.module').then((m) => m.ProjectModule),
      },
    ],
  },
  {
    path: 'login',
    component: SignInComponent,
    canActivate: [GuestGuard],
    title: 'Projetos - Login',
  },
  { path: 'signin', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'signout',
    component: SignoutComponent,
    title: 'Projetos - Logout',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProjectHostRoutingModule {}
