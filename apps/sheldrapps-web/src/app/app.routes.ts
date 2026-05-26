import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePageComponent)
  },
  {
    path: 'privacy-policies/epub-cover-changer',
    loadComponent: () => import('./pages/privacy-ecc/privacy-ecc.page').then((m) => m.PrivacyEccPageComponent)
  },
  {
    path: 'privacy-policies/cover-creator-for-kindle',
    loadComponent: () => import('./pages/privacy-ccfk/privacy-ccfk.page').then((m) => m.PrivacyCcfkPageComponent)
  },
  {
    path: 'privacy-policies/pdf-cover-maker',
    loadComponent: () => import('./pages/privacy-pcm/privacy-pcm.page').then((m) => m.PrivacyPcmPageComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
