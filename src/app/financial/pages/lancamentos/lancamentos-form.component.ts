import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FinancialService } from '../../financial.service';

@Component({
  selector: 'app-lancamentos-form',
  templateUrl: './lancamentos-form.component.html',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule],
})
export class LancamentosFormComponent {
  form: FormGroup;
  evidenceFileNames: string[] = [];

  constructor(private fb: FormBuilder, public financial: FinancialService) {
    console.log('LancamentosFormComponent initialized');
    this.form = this.fb.group({
      vendor_id: ['', Validators.required],
      nf: [''],
      description: [''],
      amount: [0, Validators.required],
      currency: ['BRL'],
      issue_date: [new Date(), Validators.required],
      due_date: [new Date(), Validators.required],
      status: ['open'],
      category: [''],
      cost_center: [''],
      attachment_url: [''],
    });
  }

  save() {
    if (this.form.invalid) return;
    console.log('Salvar conta a pagar', this.form.value);
  }

  onEvidenceFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    this.evidenceFileNames = files.map(f => f.name);
  }
}
