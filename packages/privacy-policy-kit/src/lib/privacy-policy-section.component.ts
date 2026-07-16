import { Component, Input } from '@angular/core';
import {
  SelectableButtonListComponent,
  type SelectableButtonListItem,
} from '@sheldrapps/ui-theme';

@Component({
  selector: 'sh-privacy-policy-section',
  standalone: true,
  imports: [SelectableButtonListComponent],
  templateUrl: './privacy-policy-section.component.html',
})
export class PrivacyPolicySectionComponent {
  private _url = '';
  readonly privacyPolicyItems: readonly SelectableButtonListItem[] = [
    {
      value: 'privacy-policy',
      titleKey: 'SETTINGS.PRIVACY_POLICY',
      trailingIconName: 'chevron-forward-outline',
      ariaLabelKey: 'SETTINGS.PRIVACY_POLICY',
    },
  ];

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
