import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SiteTitleControlsComponent } from '../../components/site-title-controls/site-title-controls.component';

@Component({
  selector: 'app-privacy-pcm-page',
  standalone: true,
  imports: [TranslateModule, RouterLink, SiteTitleControlsComponent],
  templateUrl: './privacy-pcm.page.html',
  styleUrl: './privacy-pcm.page.scss'
})
export class PrivacyPcmPageComponent {}
