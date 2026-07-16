import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { constructOutline } from 'ionicons/icons';
import { UiThemeI18nService } from '../../translations/ui-theme-i18n.service';

@Component({
  selector: 'sh-under-construction-page',
  standalone: true,
  imports: [
    CommonModule,
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
  private readonly i18n = inject(UiThemeI18nService);
  readonly texts = this.i18n.texts;

  constructor() {
    addIcons({
      constructOutline,
    });
  }
}
