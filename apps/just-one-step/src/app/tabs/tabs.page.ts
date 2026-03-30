import { Component } from '@angular/core';
import {
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import {
  calendarOutline,
  checkboxOutline,
  createOutline,
  listOutline,
  settingsOutline,
} from 'ionicons/icons';
import { addIcons } from 'ionicons';

@Component({
  standalone: true,
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  imports: [
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    TranslateModule,
  ],
})
export class TabsPage {
  constructor() {
    addIcons({
      calendarOutline,
      listOutline,
      checkboxOutline,
      createOutline,
      settingsOutline,
    });
  }
}
