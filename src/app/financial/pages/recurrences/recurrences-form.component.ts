import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { FinancialService } from '../../financial.service';
import { Recurrence } from '../../models/recurrence';
import { LocalStorageService } from '../../../shared/services/local-storage.service';
import { Store } from '../../../pages/admin/stores/store.service';
import { FinancialToastService } from '../../financial-toast.service';
import { TranslateModule } from '@ngx-translate/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-recurrences-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TranslateModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './recurrences-form.component.html',
})
export class RecurrencesFormComponent implements OnInit {
  @Input() recurrence: Recurrence | null = null;
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  form: FormGroup;
  selectedStore: Store | null = null;
  STORE_KEY = 'selectedStore';

  // Options
  typeOptions = [
    { value: 'PAYABLE', label: 'A Pagar' },
    { value: 'RECEIVABLE', label: 'A Receber' },
    { value: 'TRANSFER', label: 'Transferência' }
  ];

  frequencyOptions = [
    { value: 'monthly', label: 'Mensal' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'yearly', label: 'Anual' }
  ];

  statusOptions = [
    { value: 'active', label: 'Ativa' },
    { value: 'paused', label: 'Pausada' },
    { value: 'finished', label: 'Finalizada' }
  ];

  categoryOptions: any[] = [];
  costCenterOptions: any[] = [];
  partyOptions: any[] = [];

  constructor(
    private fb: FormBuilder,
    private financialService: FinancialService,
    private localStorage: LocalStorageService,
    private toast: FinancialToastService
  ) {
    this.form = this.fb.group({
      description: ['', Validators.required],
      type: ['PAYABLE', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      frequency: ['monthly', Validators.required],
      status: ['active', Validators.required],
      start_date: [new Date().toISOString().split('T')[0], Validators.required],
      has_end_date: [false],
      end_date: [null],
      day_of_month: [5, [Validators.required, Validators.min(1), Validators.max(31)]],
      party_id: [''],
      category_id: [''],
      cost_center_id: ['']
    });
  }

  ngOnInit() {
    this.selectedStore = this.localStorage.getData<Store>(this.STORE_KEY);
    if (this.selectedStore?.id_code) {
      this.loadAuxiliaryData();
    }

    if (this.recurrence) {
      this.form.patchValue(this.recurrence);
      if (this.recurrence.end_date) {
        this.form.patchValue({ has_end_date: true, end_date: this.recurrence.end_date });
      }
    }

    this.form.get('has_end_date')?.valueChanges.subscribe(hasEndDate => {
      const endDateControl = this.form.get('end_date');
      if (hasEndDate) {
        endDateControl?.setValidators(Validators.required);
      } else {
        endDateControl?.clearValidators();
        endDateControl?.setValue(null);
      }
      endDateControl?.updateValueAndValidity();
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.triggerToast('warning', 'Atenção', 'Preencha todos os campos obrigatórios.');
      return;
    }

    if (!this.selectedStore?.id_code) {
      this.toast.triggerToast('error', 'Erro', 'Loja não selecionada.');
      return;
    }

    const formValue = this.form.value;

    // Convert Date objects to YYYY-MM-DD strings
    if (formValue.start_date instanceof Date) {
      formValue.start_date = formValue.start_date.toISOString().split('T')[0];
    }
    if (formValue.end_date instanceof Date) {
      formValue.end_date = formValue.end_date.toISOString().split('T')[0];
    }

    const payload = {
      ...formValue,
      store_id: this.selectedStore.id_code,
      party_id: formValue.party_id || null,
      category_id: formValue.category_id || null,
      cost_center_id: formValue.cost_center_id || null,
      end_date: formValue.has_end_date ? formValue.end_date : null
    };
    
    // Remove UI-only fields
    delete payload.has_end_date;

    if (this.recurrence) {
      this.financialService.updateRecurrence(this.recurrence.id, payload).subscribe({
        next: () => {
          this.toast.triggerToast('success', 'Sucesso', 'Recorrência atualizada.');
          this.save.emit();
        },
        error: (err) => {
          console.error(err);
          this.toast.triggerToast('error', 'Erro', 'Falha ao atualizar recorrência.');
        }
      });
    } else {
      this.financialService.createRecurrence(payload).subscribe({
        next: () => {
          this.toast.triggerToast('success', 'Sucesso', 'Recorrência criada.');
          this.save.emit();
        },
        error: (err) => {
          console.error(err);
          this.toast.triggerToast('error', 'Erro', 'Falha ao criar recorrência.');
        }
      });
    }
  }

  loadAuxiliaryData() {
    if (!this.selectedStore?.id_code) return;
    const storeId = this.selectedStore.id_code;

    // Load Categories
    this.financialService.getCategorias(storeId).subscribe(data => {
      this.categoryOptions = data.map(c => ({ value: c.id, label: c.name }));
    });

    // Load Cost Centers
    this.financialService.getCentrosDeCusto(storeId).subscribe(data => {
      this.costCenterOptions = data.map(c => ({ value: c.id, label: c.name }));
    });

    // Load Parties
    this.financialService.getParties(storeId).subscribe(data => {
      this.partyOptions = data.map(p => ({ value: p.id_code, label: p.name }));
    });
  }


}
