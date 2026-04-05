import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LocalStorageService } from '../../../shared/services/local-storage.service';

type TimerEntry = {
  running: boolean;
  startedAtMs: number | null;
  accumulatedMs: number;
};

type TimerState = {
  version: 1;
  entries: Record<string, TimerEntry>;
};

@Injectable({ providedIn: 'root' })
export class ProjectTimerService {
  private localStorage = inject(LocalStorageService);
  private readonly KEY = 'project_timer_v1';

  private stateSubject = new BehaviorSubject<TimerState>(this.load());
  state$ = this.stateSubject.asObservable();

  start(projectIdCode: string, dateKey: string, stageIdCode?: string | null): void {
    this.stopAllRunning();
    const key = this.entryKey(projectIdCode, dateKey, stageIdCode);
    const st = this.stateSubject.value;
    const entry = st.entries[key] || { running: false, startedAtMs: null, accumulatedMs: 0 };
    if (entry.running) return;
    const next: TimerState = {
      version: 1,
      entries: {
        ...st.entries,
        [key]: { ...entry, running: true, startedAtMs: Date.now() },
      },
    };
    this.persist(next);
  }

  stop(projectIdCode: string, dateKey: string, stageIdCode?: string | null): void {
    const key = this.entryKey(projectIdCode, dateKey, stageIdCode);
    const st = this.stateSubject.value;
    const entry = st.entries[key];
    if (!entry || !entry.running || !entry.startedAtMs) return;
    const delta = Math.max(0, Date.now() - entry.startedAtMs);
    const next: TimerState = {
      version: 1,
      entries: {
        ...st.entries,
        [key]: { running: false, startedAtMs: null, accumulatedMs: entry.accumulatedMs + delta },
      },
    };
    this.persist(next);
  }

  isRunning(projectIdCode: string, dateKey: string, stageIdCode?: string | null): boolean {
    const key = this.entryKey(projectIdCode, dateKey, stageIdCode);
    return !!this.stateSubject.value.entries[key]?.running;
  }

  getElapsedMs(projectIdCode: string, dateKey: string, nowMs: number, stageIdCode?: string | null): number {
    const key = this.entryKey(projectIdCode, dateKey, stageIdCode);
    const entry = this.stateSubject.value.entries[key];
    if (!entry) return 0;
    if (!entry.running || !entry.startedAtMs) return entry.accumulatedMs;
    return entry.accumulatedMs + Math.max(0, nowMs - entry.startedAtMs);
  }

  hasAnyRunning(dateKey: string): boolean {
    const prefix = `${dateKey}:`;
    for (const [k, v] of Object.entries(this.stateSubject.value.entries)) {
      if (!k.startsWith(prefix)) continue;
      if (v?.running) return true;
    }
    return false;
  }

  getTotalElapsedMsForDate(dateKey: string, nowMs: number): number {
    const prefix = `${dateKey}:`;
    let total = 0;
    for (const [k, entry] of Object.entries(this.stateSubject.value.entries)) {
      if (!k.startsWith(prefix)) continue;
      if (!entry) continue;
      const current = entry.running && entry.startedAtMs ? entry.accumulatedMs + Math.max(0, nowMs - entry.startedAtMs) : entry.accumulatedMs;
      total += current;
    }
    return total;
  }

  getDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  stopAllRunning(): void {
    const st = this.stateSubject.value;
    const now = Date.now();
    let changed = false;
    const entries: Record<string, TimerEntry> = { ...st.entries };
    for (const [key, entry] of Object.entries(entries)) {
      if (!entry.running || !entry.startedAtMs) continue;
      const delta = Math.max(0, now - entry.startedAtMs);
      entries[key] = { running: false, startedAtMs: null, accumulatedMs: entry.accumulatedMs + delta };
      changed = true;
    }
    if (!changed) return;
    this.persist({ version: 1, entries });
  }

  private entryKey(projectIdCode: string, dateKey: string, stageIdCode?: string | null): string {
    const project = String(projectIdCode || '').trim();
    const stage = String(stageIdCode || '').trim() || '__project__';
    return `${dateKey}:${project}:${stage}`;
  }

  private persist(next: TimerState): void {
    this.localStorage.saveData(this.KEY, next);
    this.stateSubject.next(next);
  }

  private load(): TimerState {
    const raw = this.localStorage.getData<TimerState>(this.KEY);
    if (raw && raw.version === 1 && raw.entries && typeof raw.entries === 'object') return raw;
    return { version: 1, entries: {} };
  }
}
