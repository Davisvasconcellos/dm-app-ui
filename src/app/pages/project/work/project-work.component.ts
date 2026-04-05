import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProjectContextService } from '../services/project-context.service';
import { Project } from '../project.types';

@Component({
  selector: 'app-project-work',
  standalone: false,
  templateUrl: './project-work.component.html',
})
export class ProjectWorkComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private projectContext = inject(ProjectContextService);
  private sub = new Subscription();

  project: Project | null = null;
  note = '';

  ngOnInit(): void {
    this.project = this.projectContext.getActiveProject();
    this.sub.add(this.projectContext.activeProject$.subscribe((p) => (this.project = p)));
    if (!this.project) {
      this.router.navigate(['/project']);
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
