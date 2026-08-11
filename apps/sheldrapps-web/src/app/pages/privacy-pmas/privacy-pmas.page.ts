import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SiteTitleControlsComponent } from '../../components/site-title-controls/site-title-controls.component';

@Component({
  selector: 'app-privacy-pmas-page',
  standalone: true,
  imports: [TranslateModule, RouterLink, SiteTitleControlsComponent],
  templateUrl: './privacy-pmas.page.html',
  styleUrl: '../privacy-policy.shared.scss'
})
export class PrivacyPmasPageComponent {}
