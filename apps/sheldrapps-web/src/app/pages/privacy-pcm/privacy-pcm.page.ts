import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-privacy-pcm-page',
  standalone: true,
  imports: [TranslateModule, RouterLink],
  templateUrl: './privacy-pcm.page.html',
  styleUrl: './privacy-pcm.page.scss'
})
export class PrivacyPcmPageComponent {}
