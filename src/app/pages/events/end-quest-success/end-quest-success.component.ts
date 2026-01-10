import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { GridShapeComponent } from '../../../shared/components/common/grid-shape/grid-shape.component';

@Component({
  selector: 'app-end-quest-success',
  standalone: true,
  imports: [RouterModule, GridShapeComponent, TranslateModule],
  templateUrl: './end-quest-success.component.html',
  styles: ``
})
export class EndQuestSuccessComponent {
  currentYear = new Date().getFullYear();
  idCode: string = '';
  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    try { this.idCode = this.route.snapshot.queryParamMap.get('id_code') || ''; } catch {}
    setTimeout(() => {
      if (this.idCode) {
        try { this.router.navigate([`/events/home-guest-v2/${this.idCode}`]); } catch {}
      } else {
        try { this.router.navigateByUrl('/events/home-guest-v2'); } catch {}
      }
    }, 3000);
  }
}
