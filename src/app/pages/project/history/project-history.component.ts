import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { StoreContextService } from '../../../shared/services/store-context.service';
import { ProjectService } from '../project.service';
import { DatePickerComponent } from '../../../shared/components/form/date-picker/date-picker.component';

@Component({
  selector: 'app-project-history',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePickerComponent],
  templateUrl: './project-history.component.html',
})
export class ProjectHistoryComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private storeCtx = inject(StoreContextService);
  private projectService = inject(ProjectService);
  private sub = new Subscription();

  form: FormGroup;
  isLoading = false;
  data: any = null;
  nowMs = Date.now();
  private tickInterval: any;

  constructor() {
    const today = new Date();
    const startObj = new Date(today.getFullYear(), today.getMonth(), 1);
    const endObj = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    this.form = this.fb.group({
      start_date: [this.formatDateObj(startObj), Validators.required],
      end_date: [this.formatDateObj(endObj), Validators.required]
    });
  }

  ngOnInit(): void {
    this.sub.add(
      this.storeCtx.activeStore$.subscribe(() => {
        this.loadData();
      })
    );

    this.tickInterval = setInterval(() => {
      this.nowMs = Date.now();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  private formatDateObj(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  formatDateShow(dStr: string): string {
    if (!dStr) return '';
    const [y, m, d] = dStr.split('-');
    return `${d}/${m}/${y}`;
  }

  formatTime(dStr: string | null): string {
    if (!dStr) return '--:--';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  onStartDateChange(event: any): void {
    if (event.selectedDates && event.selectedDates.length > 0) {
      const d = event.selectedDates[0];
      this.form.get('start_date')?.setValue(this.formatDateObj(d));
    }
  }

  onEndDateChange(event: any): void {
    if (event.selectedDates && event.selectedDates.length > 0) {
      const d = event.selectedDates[0];
      this.form.get('end_date')?.setValue(this.formatDateObj(d));
    }
  }

  formatSecondsToHms(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  getLiveSeconds(m: any): number {
    if (!m.is_running) return (m.minutes || 0) * 60;
    const start = new Date(m.start_at).getTime();
    return Math.max(0, Math.floor((this.nowMs - start) / 1000));
  }

  getLiveTotalPeriodSeconds(): number {
    if (!this.data?.days) return 0;
    return this.data.days.reduce((acc: number, day: any) => acc + this.getLiveDayTotalSeconds(day), 0);
  }

  getLiveDayTotalSeconds(day: any): number {
    return day.markings.reduce((acc: number, m: any) => acc + this.getLiveSeconds(m), 0);
  }

  loadData(): void {
    if (this.form.invalid) return;
    const v = this.form.value;
    if (v.start_date > v.end_date) {
      alert('Data inicial não pode ser maior que a data final.');
      return;
    }

    const storeId = this.storeCtx.getActiveStore()?.id_code;
    if (!storeId) return;

    this.isLoading = true;
    this.projectService.getTimemarker(storeId, v.start_date, v.end_date).subscribe({
      next: (resp) => {
        this.data = resp?.data || null;
        this.isLoading = false;
      },
      error: () => {
        this.data = null;
        this.isLoading = false;
      }
    });
  }
}

