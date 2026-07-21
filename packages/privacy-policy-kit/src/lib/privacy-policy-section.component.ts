import { Component, Input } from '@angular/core';
import {
  SelectableButtonListComponent,
  type SelectableButtonListItem,
} from '@sheldrapps/ui-theme';

const PRIVACY_POLICY_LANGUAGE_PARAM = 'lang';

export function buildLocalizedPrivacyPolicyUrl(
  url: string,
  language = typeof document !== 'undefined'
    ? document.documentElement?.lang
    : undefined,
): string {
  const normalizedUrl = url?.trim?.() ?? '';
  const normalizedLanguage = language?.trim?.();
  if (!normalizedUrl || !normalizedLanguage) {
    return normalizedUrl;
  }

  try {
    const localizedUrl = new URL(normalizedUrl);
    localizedUrl.searchParams.set(PRIVACY_POLICY_LANGUAGE_PARAM, normalizedLanguage);
    return localizedUrl.toString();
  } catch {
    return normalizedUrl;
  }
}

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

    globalThis.open(
      buildLocalizedPrivacyPolicyUrl(this._url),
      '_blank',
      'noopener,noreferrer',
    );
  }
}
