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
  IonIcon,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-instructions',
  templateUrl: './instructions.page.html',
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
export class InstructionsPage {
  private readonly sendToKindleUrl = 'https://www.amazon.com/sendtokindle';

  async openSendToKindle() {
    await Browser.open({ url: this.sendToKindleUrl });
  }
}
