import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonItem,
} from '@ionic/angular/standalone';

const PLAY_STORE_ICON_MARKUP = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path fill="currentColor" d="M96 64l320 192-320 192V64z"></path>
</svg>
`;

@Component({
  selector: 'sh-recommended-app-card',
  standalone: true,
  templateUrl: './recommended-app-card.component.html',
  styleUrls: ['./recommended-app-card.component.scss'],
  imports: [IonButton, IonIcon, IonItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendedAppCardComponent {
  @Input() appName = '';
  @Input() icon = '';
  @Input() description = '';
  @Input() actionLabel = '';
  @Input() actionAriaLabel = '';
  @Input() actionIconSrc = `data:image/svg+xml;base64,${btoa(
    PLAY_STORE_ICON_MARKUP,
  )}`;
  @Output() readonly action = new EventEmitter<void>();
}
