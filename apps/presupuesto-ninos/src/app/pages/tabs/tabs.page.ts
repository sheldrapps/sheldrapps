import { Component } from '@angular/core';
import {
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonIcon,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoUsd, settingsOutline } from 'ionicons/icons';

@Component({
  standalone: true,
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class TabsPage {
  constructor() {
    addIcons({ logoUsd, settingsOutline });
  }
}