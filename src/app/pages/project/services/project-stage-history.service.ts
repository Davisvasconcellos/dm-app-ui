import { Injectable, inject } from '@angular/core';
import { LocalStorageService } from '../../../shared/services/local-storage.service';

type StageSnapshot = {
  id_code: string;
  title: string;
  acronym: string | null;
  color_1: string | null;
  description?: string | null;
};

type ProjectHistory = {
  active_stage_id_code: string | null;
  stages: StageSnapshot[];
};

type StageHistoryState = {
  version: 1;
  by_date: Record<string, Record<string, ProjectHistory>>;
};

@Injectable({ providedIn: 'root' })
export class ProjectStageHistoryService {
  private localStorage = inject(LocalStorageService);
  private readonly KEY = 'project_stage_history_v1';
  private readonly MAX_STAGES = 10;

  getProjectHistory(dateKey: string, projectIdCode: string): ProjectHistory {
    const st = this.load();
    const day = st.by_date[dateKey] || {};
    return day[projectIdCode] || { active_stage_id_code: null, stages: [] };
  }

  setActiveStage(dateKey: string, projectIdCode: string, stageIdCode: string | null): void {
    const st = this.load();
    const day = st.by_date[dateKey] || {};
    const proj = day[projectIdCode] || { active_stage_id_code: null, stages: [] };
    const next: StageHistoryState = {
      version: 1,
      by_date: {
        ...st.by_date,
        [dateKey]: {
          ...day,
          [projectIdCode]: { ...proj, active_stage_id_code: stageIdCode },
        },
      },
    };
    this.persist(next);
  }

  reorderStages(dateKey: string, projectIdCode: string, newOrder: StageSnapshot[]): void {
    const st = this.load();
    const day = st.by_date[dateKey] || {};
    const proj = day[projectIdCode] || { active_stage_id_code: null, stages: [] };
    const next: StageHistoryState = {
      version: 1,
      by_date: {
        ...st.by_date,
        [dateKey]: {
          ...day,
          [projectIdCode]: { ...proj, stages: newOrder.slice(0, this.MAX_STAGES) },
        },
      },
    };
    this.persist(next);
  }

  updateStageNote(dateKey: string, projectIdCode: string, stageIdCode: string, description: string | null): void {
    const st = this.load();
    const day = st.by_date[dateKey] || {};
    const proj = day[projectIdCode] || { active_stage_id_code: null, stages: [] };

    const stages = proj.stages.map((s) => (s.id_code === stageIdCode ? { ...s, description } : s));

    const next: StageHistoryState = {
      version: 1,
      by_date: {
        ...st.by_date,
        [dateKey]: {
          ...day,
          [projectIdCode]: { ...proj, stages },
        },
      },
    };
    this.persist(next);
  }

  addStage(dateKey: string, projectIdCode: string, stage: StageSnapshot): void {
    const st = this.load();
    const day = st.by_date[dateKey] || {};
    const proj = day[projectIdCode] || { active_stage_id_code: null, stages: [] };

    const without = (proj.stages || []).filter((s) => s.id_code !== stage.id_code);
    const nextStages = [stage, ...without].slice(0, this.MAX_STAGES);

    const next: StageHistoryState = {
      version: 1,
      by_date: {
        ...st.by_date,
        [dateKey]: {
          ...day,
          [projectIdCode]: {
            active_stage_id_code: stage.id_code,
            stages: nextStages,
          },
        },
      },
    };
    this.persist(next);
  }

  private persist(next: StageHistoryState): void {
    this.localStorage.saveData(this.KEY, next);
  }

  private load(): StageHistoryState {
    const raw = this.localStorage.getData<StageHistoryState>(this.KEY);
    if (raw && raw.version === 1 && raw.by_date && typeof raw.by_date === 'object') return raw;
    return { version: 1, by_date: {} };
  }
}

