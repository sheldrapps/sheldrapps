import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SiteTitleControlsComponent } from '../../components/site-title-controls/site-title-controls.component';

@Component({
  selector: 'app-privacy-ecc-page',
  standalone: true,
  imports: [TranslateModule, RouterLink, SiteTitleControlsComponent],
  templateUrl: './privacy-ecc.page.html',
  styleUrl: './privacy-ecc.page.scss'
})
export class PrivacyEccPageComponent {}
