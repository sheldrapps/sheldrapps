import { buildLocalizedPrivacyPolicyUrl } from './privacy-policy-section.component';

describe('buildLocalizedPrivacyPolicyUrl', () => {
  it('adds the active language to a privacy policy URL', () => {
    expect(
      buildLocalizedPrivacyPolicyUrl(
        'https://sheldrapps.com/privacy-policies/epub-fixer',
        'es-MX',
      ),
    ).toBe('https://sheldrapps.com/privacy-policies/epub-fixer?lang=es-MX');
  });

  it('preserves existing query parameters', () => {
    expect(
      buildLocalizedPrivacyPolicyUrl(
        'https://sheldrapps.com/privacy-policies/epub-fixer?source=settings',
        'de-DE',
      ),
    ).toBe(
      'https://sheldrapps.com/privacy-policies/epub-fixer?source=settings&lang=de-DE',
    );
  });

  it('leaves the URL unchanged when no language is available', () => {
    const url = 'https://sheldrapps.com/privacy-policies/epub-fixer';
    expect(buildLocalizedPrivacyPolicyUrl(url, '')).toBe(url);
  });
});
