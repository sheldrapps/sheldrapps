import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SiteTitleControlsComponent } from '../../components/site-title-controls/site-title-controls.component';

interface FeaturedApp {
  nameKey: string;
  descriptionKey: string;
  icon: string;
  playStoreUrl?: string;
  privacyRoute: string;
  badgeKey?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    SiteTitleControlsComponent,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss'
})
export class HomePageComponent {
  readonly playStoreIconSrc = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path fill="currentColor" d="M96 64l320 192-320 192V64z"></path>
</svg>
`)}`;

  readonly apps: FeaturedApp[] = [
    {
      nameKey: 'HOME.APPS.CCFK.NAME',
      descriptionKey: 'HOME.APPS.CCFK.DESCRIPTION',
      icon: 'assets/apps/ccfk/icon.png',
      playStoreUrl:
        'https://play.google.com/store/apps/details?id=com.sheldrapps.covercreatorforkindle&hl=es_MX',
      privacyRoute: '/privacy-policies/cover-creator-for-kindle',
    },
    {
      nameKey: 'HOME.APPS.ECC.NAME',
      descriptionKey: 'HOME.APPS.ECC.DESCRIPTION',
      icon: 'assets/apps/ecc/icon.png',
      playStoreUrl:
        'https://play.google.com/store/apps/details?id=com.sheldrapps.epubcoverchanger&hl=es_MX',
      privacyRoute: '/privacy-policies/epub-cover-changer',
    },
    {
      nameKey: 'HOME.APPS.EPF.NAME',
      descriptionKey: 'HOME.APPS.EPF.DESCRIPTION',
      icon: 'assets/apps/epub-fixer/icon.png',
      playStoreUrl:
        'https://play.google.com/store/apps/details?id=com.sheldrapps.epubfixer',
      privacyRoute: '/privacy-policies/epub-fixer',
    },
    {
      nameKey: 'HOME.APPS.EMS.NAME',
      descriptionKey: 'HOME.APPS.EMS.DESCRIPTION',
      icon: 'assets/apps/epub-merger-and-splitter/icon.png',
      privacyRoute: '/privacy-policies/epub-merger-and-splitter',
      badgeKey: 'HOME.APPS.EMS.BADGE',
      disabled: true,
    },
    {
      nameKey: 'HOME.APPS.PCM.NAME',
      descriptionKey: 'HOME.APPS.PCM.DESCRIPTION',
      icon: 'assets/apps/pcm/icon.png',
      playStoreUrl:
        'https://play.google.com/store/apps/details?id=com.sheldrapps.pdfcovermaker',
      privacyRoute: '/privacy-policies/pdf-cover-maker',
    },
  ];

}
