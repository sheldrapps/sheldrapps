import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButtons,
  IonBackButton,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-requisites',
  templateUrl: './requisites.page.html',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonButtons,
    IonBackButton,
  ],
})
export class RequisitesPage {
  links = {
    removeAds:
      'https://www.amazon.com/gp/help/customer/display.html?nodeId=GJHYWUURJ5A6YMBU',
    displayCover:
      'https://www.amazonforum.com/s/question/0D54P00008BNz2GSAT/displaying-the-book-cover-option',
    kindleAndroid:
      'https://play.google.com/store/apps/details?id=com.amazon.kindle&hl=es_MX',
    kindleIOS: 'https://apps.apple.com/mx/app/kindle/id302584613',
    sendToKindle: 'https://www.amazon.com/sendtokindle',
  };

  async openLink(url: string) {
    await Browser.open({ url });
  }
}
