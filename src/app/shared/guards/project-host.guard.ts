import { CanMatchFn } from '@angular/router';
import { inject } from '@angular/core';
import { AppContextService } from '../services/app-context.service';

export const projectHostGuard: CanMatchFn = () => {
  const ctx = inject(AppContextService).getContext();
  return ctx === 'project';
};
