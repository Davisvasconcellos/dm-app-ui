import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProjectRoutingModule } from './project-routing.module';

import { ModalComponent } from '../../shared/components/ui/modal/modal.component';
import { DatePickerComponent } from '../../shared/components/form/date-picker/date-picker.component';
import { CurrencyMaskDirective } from '../../shared/directives/currency-mask.directive';

import { HomeProjectComponent } from './home-project/home-project.component';
import { ProjectHistoryComponent } from './history/project-history.component';
import { ProjectWorkComponent } from './work/project-work.component';

import { ProjectAdminDashboardComponent } from './admin/project-admin-dashboard/project-admin-dashboard.component';
import { ProjectBackofficeComponent } from './admin/project-backoffice/project-backoffice.component';
import { ProjectCreateComponent } from './admin/project-create/project-create.component';
import { ProjectListComponent } from './admin/project-list/project-list.component';
import { ProjectSessionsComponent } from './admin/project-sessions/project-sessions.component';
import { ProjectMeComponent } from './me/project-me/project-me.component';

import { ProjectSummaryCardComponent } from './components/project-summary-card/project-summary-card.component';
import { ReactiveFormsModule } from '@angular/forms';

import { NgApexchartsModule } from 'ng-apexcharts';
import { DropdownComponent } from '../../shared/components/ui/dropdown/dropdown.component';
import { DropdownItemComponent } from '../../shared/components/ui/dropdown/dropdown-item/dropdown-item.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    ProjectRoutingModule,
    ModalComponent,
    DatePickerComponent,
    CurrencyMaskDirective,
    ProjectHistoryComponent,
    NgApexchartsModule,
    DropdownComponent,
    DropdownItemComponent,
  ],
  declarations: [
    HomeProjectComponent,
    ProjectWorkComponent,
    ProjectAdminDashboardComponent,
    ProjectBackofficeComponent,
    ProjectCreateComponent,
    ProjectListComponent,
    ProjectSessionsComponent,
    ProjectMeComponent,
    ProjectSummaryCardComponent,
  ],
})
export class ProjectModule {}
// Rebuild for Timesheet 123
