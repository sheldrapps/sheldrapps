import { Component } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-home-page',
  templateUrl: './home.page.html',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, TranslateModule],
})
export class HomePage {}
