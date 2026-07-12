import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SiteTitleControlsComponent } from '../../components/site-title-controls/site-title-controls.component';

@Component({
  selector: 'app-privacy-epub-merger-and-splitter-page',
  standalone: true,
  imports: [TranslateModule, RouterLink, SiteTitleControlsComponent],
  templateUrl: './privacy-epub-merger-and-splitter.page.html',
  styleUrl: './privacy-epub-merger-and-splitter.page.scss'
})
export class PrivacyEpubMergerAndSplitterPageComponent {}
