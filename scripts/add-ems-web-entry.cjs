const fs = require('fs');
const path = require('path');

const dirs = [
  'apps/sheldrapps-web/src/assets/i18n',
  'apps/sheldrapps-web/public/assets/i18n',
];

const privacy = {
  TITLE: 'Privacy Policy - EPUB Merger & Splitter',
  LAST_UPDATED: 'Last updated: 2026-07-12',
  INTRO:
    'EPUB Merger & Splitter (<strong>the App</strong>) is developed and maintained by <strong>Sheldrapps</strong>. This Privacy Policy explains how information is handled when you use the App.',
  SECTION_1_TITLE: '1. Information We Collect',
  SECTION_1_BODY:
    'The App does not require account creation and does not directly collect personally identifiable information such as your name, email address, or phone number.',
  SECTION_2_TITLE: '2. Files and Content',
  SECTION_2_ITEM_1: 'Files you select are processed <strong>locally on your device</strong>.',
  SECTION_2_ITEM_2:
    'The App does <strong>not</strong> upload or store your files on external servers.',
  SECTION_2_ITEM_3: 'Generated files remain on your device unless you explicitly share them.',
  SECTION_3_TITLE: '3. Advertising',
  SECTION_3_BODY:
    'The App may display ads using <strong>Google AdMob</strong>. AdMob may collect and process certain data such as device identifiers, approximate location (country/region), and ad interaction data (impressions/clicks) to deliver and measure advertising.',
  GOOGLE_POLICY_LABEL: 'Google Privacy Policy:',
  GOOGLE_POLICY_URL: 'https://policies.google.com/privacy',
  SECTION_4_TITLE: '4. Consent (GDPR / Regional Regulations)',
  SECTION_4_BODY:
    "Where required by law (for example, in the EEA/UK/Switzerland), the App uses Google's User Messaging Platform (UMP) to request consent for personalized advertising.",
  SECTION_4_ITEM_1: 'You can accept or decline personalized advertising.',
  SECTION_4_ITEM_2:
    "You can review or change your choices via the App's <code>Privacy options</code> (when available).",
  SECTION_4_ITEM_3:
    'If consent is not granted, ads may still be shown in a non-personalized form.',
  SECTION_5_TITLE: '5. Data Sharing',
  SECTION_5_BODY:
    'We do not sell personal information. Data may be processed by third-party services strictly for providing ads and complying with legal requirements.',
  SECTION_6_TITLE: '6. Data Security',
  SECTION_6_BODY:
    'The App processes files locally to minimize exposure. We take reasonable measures to protect information handled by the App.',
  SECTION_7_TITLE: '7. User Content Responsibility',
  SECTION_7_BODY:
    'You are solely responsible for the content of files and images you process through the App.',
  SECTION_7_ITEM_1: 'The App does not analyze, validate, or monitor the content of files you process.',
  SECTION_7_ITEM_2:
    'We do not verify copyright ownership, publication rights, or licenses for any files.',
  SECTION_7_ITEM_3:
    'You must ensure you have the necessary rights and permissions for any content you process.',
  SECTION_7_ITEM_4:
    'We are not responsible for any legal issues arising from your use of copyrighted or unauthorized content.',
  SECTION_8_TITLE: "8. Children's Privacy",
  SECTION_8_BODY:
    'The App is not directed at children under 13. We do not knowingly collect personal data from children.',
  SECTION_9_TITLE: '9. Changes to This Policy',
  SECTION_9_BODY:
    'We may update this Privacy Policy from time to time. Updates will be posted on this page with a new "Last updated" date.',
  SECTION_10_TITLE: '10. Contact',
  SECTION_10_BODY: 'If you have questions about this Privacy Policy, contact:',
};

for (const dir of dirs) {
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    const filePath = path.join(dir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data.HOME ??= {};
    data.HOME.APPS ??= {};
    data.HOME.APPS.EMS = {
      NAME: 'EPUB Merger & Splitter',
      DESCRIPTION: 'Merge and split EPUB files.',
      BADGE: 'Coming soon',
    };
    data.HOME.LEGAL_EMS_LINK = 'Privacy Policy - EPUB Merger & Splitter';
    data.PRIVACY ??= {};
    data.PRIVACY.EMS = privacy;
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }
}

process.stdout.write('Added EMS web entry to localized files.\n');
