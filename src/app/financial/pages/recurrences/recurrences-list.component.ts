import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FinancialService } from '../../financial.service';
import { Recurrence } from '../../models/recurrence';
import { LocalStorageService } from '../../../shared/services/local-storage.service';
import { Store } from '../../../pages/admin/stores/store.service';
import { ModalComponent } from '../../../shared/components/ui/modal/modal.component';
import { RecurrencesFormComponent } from './recurrences-form.component';
import { TranslateModule } from '@ngx-translate/core';
import { FinancialToastService } from '../../financial-toast.service';

@Component({
  selector: 'app-recurrences-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ModalComponent,
    RecurrencesFormComponent,
    TranslateModule
  ],
  templateUrl: './recurrences-list.component.html',
})
export class RecurrencesListComponent implements OnInit {
  recurrences: Recurrence[] = [];
  selectedStore: Store | null = null;
  STORE_KEY = 'selectedStore';

  isFormVisible = false;
  editingRecurrence: Recurrence | null = null;

  isGenerateModalOpen = false;
  generationDate: string = new Date().toISOString().split('T')[0];

  constructor(
    private financialService: FinancialService,
    private localStorage: LocalStorageService,
    private toast: FinancialToastService
  ) {}

  ngOnInit() {
    this.selectedStore = this.localStorage.getData<Store>(this.STORE_KEY);
    if (this.selectedStore?.id_code) {
      this.loadRecurrences();
    }
  }

  loadRecurrences() {
    if (!this.selectedStore?.id_code) return;
    this.financialService.getRecurrences(this.selectedStore.id_code).subscribe({
      next: (data) => this.recurrences = data,
      error: (err) => console.error('Error loading recurrences', err)
    });
  }

  toggleForm() {
    if (this.isFormVisible) {
      this.isFormVisible = false;
      this.editingRecurrence = null;
    } else {
      this.editingRecurrence = null;
      this.isFormVisible = true;
    }
  }

  editRecurrence(recurrence: Recurrence) {
    this.editingRecurrence = recurrence;
    this.isFormVisible = true;
    // Optional: Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteRecurrence(recurrence: Recurrence) {
    if (confirm('Tem certeza que deseja excluir esta recorrência?')) {
      this.financialService.deleteRecurrence(recurrence.id).subscribe({
        next: () => {
          this.toast.triggerToast('success', 'Sucesso', 'Recorrência excluída.');
          this.loadRecurrences();
        },
        error: (err) => this.toast.triggerToast('error', 'Erro', 'Falha ao excluir recorrência.')
      });
    }
  }

  toggleStatus(recurrence: Recurrence) {
    if (recurrence.status === 'finished') return;

    const newStatus = recurrence.status === 'active' ? 'paused' : 'active';
    
    this.financialService.updateRecurrence(recurrence.id, { status: newStatus }).subscribe({
      next: () => {
        recurrence.status = newStatus;
        const msg = newStatus === 'active' ? 'Recorrência ativada.' : 'Recorrência pausada.';
        this.toast.triggerToast('success', 'Sucesso', msg);
      },
      error: (err) => {
        console.error(err);
        this.toast.triggerToast('error', 'Erro', 'Falha ao atualizar status.');
      }
    });
  }

  onFormSave() {
    this.isFormVisible = false;
    this.editingRecurrence = null;
    this.loadRecurrences();
  }

  onFormCancel() {
    this.isFormVisible = false;
    this.editingRecurrence = null;
  }

  openGenerateModal() {
    this.generationDate = new Date().toISOString().split('T')[0];
    this.isGenerateModalOpen = true;
  }

  confirmGeneration() {
    if (!this.selectedStore?.id_code) return;
    this.financialService.generateRecurrenceTransactions(this.selectedStore.id_code, this.generationDate).subscribe({
      next: () => {
        this.toast.triggerToast('success', 'Sucesso', 'Transações geradas com sucesso.');
        this.isGenerateModalOpen = false;
      },
      error: (err) => this.toast.triggerToast('error', 'Erro', 'Falha ao gerar transações.')
    });
  }

  getStatusLabel(status: string) {
    switch (status) {
      case 'active': return 'Ativa';
      case 'paused': return 'Pausada';
      case 'finished': return 'Finalizada';
      default: return status;
    }
  }

  getFrequencyLabel(freq: string) {
    switch (freq) {
      case 'monthly': return 'Mensal';
      case 'weekly': return 'Semanal';
      case 'yearly': return 'Anual';
      default: return freq;
    }
  }
}
