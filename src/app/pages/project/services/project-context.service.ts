import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LocalStorageService } from '../../../shared/services/local-storage.service';
import { Project } from '../project.types';

@Injectable({ providedIn: 'root' })
export class ProjectContextService {
  private localStorage = inject(LocalStorageService);
  private readonly PROJECT_KEY = 'selectedProject';

  private activeProjectSubject = new BehaviorSubject<Project | null>(null);
  public activeProject$ = this.activeProjectSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const saved = this.localStorage.getData<Project>(this.PROJECT_KEY);
    if (saved) this.activeProjectSubject.next(saved);
  }

  setActiveProject(project: Project | null): void {
    if (project) this.localStorage.saveData(this.PROJECT_KEY, project);
    else this.localStorage.removeData(this.PROJECT_KEY);
    this.activeProjectSubject.next(project);
  }

  getActiveProject(): Project | null {
    return this.activeProjectSubject.value;
  }
}

