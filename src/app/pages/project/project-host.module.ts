import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AppHeaderComponent } from '../../shared/layout/app-header/app-header.component';
import { ProjectFooterComponent } from './layout/project-footer/project-footer.component';
import { ProjectLayoutComponent } from './layout/project-layout/project-layout.component';
import { ProjectHostRoutingModule } from './project-host-routing.module';

@NgModule({
  imports: [CommonModule, RouterModule, ProjectHostRoutingModule, AppHeaderComponent],
  declarations: [ProjectLayoutComponent, ProjectFooterComponent],
})
export class ProjectHostModule {}

