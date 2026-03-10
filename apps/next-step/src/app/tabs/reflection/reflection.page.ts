import { Component } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  standalone: true,
  selector: 'app-reflection',
  templateUrl: './reflection.page.html',
  styleUrls: ['./reflection.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonTextarea,
    TranslateModule,
  ],
})
export class ReflectionPage {}
