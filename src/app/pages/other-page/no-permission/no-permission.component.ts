import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { GridShapeComponent } from '../../../shared/components/common/grid-shape/grid-shape.component';
import { RouterModule, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-no-permission',
  imports: [
    CommonModule,
    RouterModule,
    GridShapeComponent,
  ],
  templateUrl: './no-permission.component.html',
  styles: ``
})
export class NoPermissionComponent {
  currentYear = new Date().getFullYear();
  message: string = 'Você não tem permissão para acessar este recurso.';

  constructor(private route: ActivatedRoute) {
    this.route.queryParams.subscribe(params => {
      if (params['message']) {
        this.message = params['message'];
      }
    });
  }
}
