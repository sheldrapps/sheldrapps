import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonItemDivider,
  IonIcon
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { ModalController } from '@ionic/angular';

import { checkmark } from 'ionicons/icons';
import { addIcons } from 'ionicons';

export interface KindleModel {
  id: string;
  i18nKey: string;
  width: number;
  height: number;
}

export interface KindleGroup {
  id: string;
  i18nKey: string;
  items: KindleModel[];
}

@Component({
  selector: 'app-kindle-model-picker',
  standalone: true,
  templateUrl: './kindle-model-picker.component.html',
  styleUrls: ['./kindle-model-picker.component.scss'],
  imports: [ 
    CommonModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonItemDivider,
    IonIcon,
  ],
})
export class KindleModelPickerComponent {
  @Input({ required: true }) groups: KindleGroup[] = [];
  @Input() selectedId?: string;

  constructor(private modalCtrl: ModalController) {
    addIcons({ checkmark });
  }

  close() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  pick(model: KindleModel) {
    this.modalCtrl.dismiss(model, 'selected');
  }

  isSelected(id: string) {
    return this.selectedId === id;
  }
}
