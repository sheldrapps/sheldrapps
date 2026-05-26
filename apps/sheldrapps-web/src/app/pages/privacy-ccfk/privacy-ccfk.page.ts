import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-privacy-ccfk-page',
  standalone: true,
  imports: [TranslateModule, RouterLink],
  templateUrl: './privacy-ccfk.page.html',
  styleUrl: './privacy-ccfk.page.scss'
})
export class PrivacyCcfkPageComponent {}
