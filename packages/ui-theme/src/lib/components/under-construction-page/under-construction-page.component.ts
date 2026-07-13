import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { constructOutline } from 'ionicons/icons';

@Component({
  selector: 'sh-under-construction-page',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './under-construction-page.component.html',
  styleUrls: ['./under-construction-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnderConstructionPageComponent {
  @Input() backHref = '/tabs/home';

  constructor() {
    addIcons({
      constructOutline,
    });
  }
}
