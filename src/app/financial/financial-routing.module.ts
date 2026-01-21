import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FinancialDashboardComponent } from './pages/dashboard/financial-dashboard.component';
import { LancamentosListComponent } from './pages/lancamentos/lancamentos-list.component';
import { LancamentosFormComponent } from './pages/lancamentos/lancamentos-form.component';
import { FornecedoresListComponent } from './pages/fornecedores/fornecedores-list.component';
import { FornecedoresFormComponent } from './pages/fornecedores/fornecedores-form.component';
import { ClientesListComponent } from './pages/clientes/clientes-list.component';
import { ClientesFormComponent } from './pages/clientes/clientes-form.component';
import { FinancialSettingsComponent } from './pages/configuracoes/financial-settings.component';
import { DespesasMenoresListComponent } from './pages/despesas-menores/despesas-menores-list.component';
import { ComissoesListComponent } from './pages/comissoes/comissoes-list.component';
import { FinancialReportsComponent } from './pages/relatorios/financial-reports.component';
import { SaldosBancariosListComponent } from './pages/saldos-bancarios/saldos-bancarios-list.component';
import { FinancialPartiesComponent } from './pages/parties/financial-parties.component';

import { HomeFinancialComponent } from './pages/home-financial/home-financial.component';

const routes: Routes = [
  { path: '', component: HomeFinancialComponent },
  { path: 'dashboard', component: FinancialDashboardComponent },
  // Lançamentos (antes: Contas a Pagar)
  { path: 'lancamentos', component: LancamentosListComponent },
  { path: 'lancamentos/novo', component: LancamentosFormComponent },
  { path: 'lancamentos/:id_code', component: LancamentosFormComponent },
  // Fornecedores
  { path: 'fornecedores', component: FornecedoresListComponent },
  { path: 'fornecedores/novo', component: FornecedoresFormComponent },
  { path: 'fornecedores/:id_code', component: FornecedoresFormComponent },
  // Clientes
  { path: 'clientes', component: ClientesListComponent },
  { path: 'clientes/novo', component: ClientesFormComponent },
  { path: 'clientes/:id_code', component: ClientesFormComponent },
  
  // New Routes
  { path: 'despesas-menores', component: DespesasMenoresListComponent },
  { path: 'comissoes', component: ComissoesListComponent },
  { path: 'relatorios', component: FinancialReportsComponent },
  { path: 'saldos-bancarios', component: SaldosBancariosListComponent },
  { path: 'configuracoes', component: FinancialSettingsComponent },
  { path: 'parceiros', component: FinancialPartiesComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FinancialRoutingModule {}
