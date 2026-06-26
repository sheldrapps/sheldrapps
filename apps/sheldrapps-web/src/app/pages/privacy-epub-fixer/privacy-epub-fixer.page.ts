import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SiteTitleControlsComponent } from '../../components/site-title-controls/site-title-controls.component';

@Component({
  selector: 'app-privacy-epub-fixer-page',
  standalone: true,
  imports: [TranslateModule, RouterLink, SiteTitleControlsComponent],
  templateUrl: './privacy-epub-fixer.page.html',
  styleUrl: './privacy-epub-fixer.page.scss'
})
export class PrivacyEpubFixerPageComponent {}
