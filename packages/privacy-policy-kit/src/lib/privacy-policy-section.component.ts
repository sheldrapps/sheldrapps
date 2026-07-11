import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'sh-privacy-policy-section',
  standalone: true,
  imports: [CommonModule, TranslateModule, IonItem, IonLabel, IonList],
  templateUrl: './privacy-policy-section.component.html',
})
export class PrivacyPolicySectionComponent {
  private _url = '';

  @Input({ required: true })
  set url(value: string) {
    this._url = value?.trim?.() ?? '';
  }

  get url(): string {
    return this._url;
  }

  async openPrivacyPolicy(): Promise<void> {
    if (!this._url) {
      return;
    }

    globalThis.open(this._url, '_blank', 'noopener,noreferrer');
  }
}
