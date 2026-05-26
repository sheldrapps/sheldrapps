import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-privacy-ecc-page',
  standalone: true,
  imports: [TranslateModule, RouterLink],
  templateUrl: './privacy-ecc.page.html',
  styleUrl: './privacy-ecc.page.scss'
})
export class PrivacyEccPageComponent {}
