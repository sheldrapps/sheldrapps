// @ts-check

const SUPPORTED_LOCALES = [
  'ar-SA',
  'de-DE',
  'en-US',
  'es-MX',
  'fr-FR',
  'hi-IN',
  'it-IT',
  'ja-JP',
  'ko-KR',
  'pt-BR',
  'ru-RU',
  'zh-CN',
  'zh-TW',
];

const STANDARD_PROMPT_SECTIONS = [
  {
    heading: 'Feature Graphic',
    screenshot: false,
    rawFile: null,
  },
  {
    heading: 'Screenshot 1',
    screenshot: false,
    rawFile: null,
  },
  {
    heading: 'Screenshot 2',
    screenshot: true,
    rawFile: '02-color-source.png',
  },
  {
    heading: 'Screenshot 3',
    screenshot: true,
    rawFile: '03-editor-loaded.png',
  },
  {
    heading: 'Screenshot 4',
    screenshot: true,
    rawFile: '04-preview-final.png',
  },
  {
    heading: 'Screenshot 5',
    screenshot: true,
    rawFile: '05-library-updated.png',
  },
  {
    heading: 'Screenshot 6',
    screenshot: true,
    rawFile: '06-save-copy-success.png',
  },
];

const COMMON_COVER_SCENARIOS = [
  {
    id: 'editor-adjust-contrast',
    page: 'change',
    query: 'screen=editor',
    filename: '02-color-source.png',
    actions: ['prepareAdjustContrastFlow', 'hideEditorLoaderOverlay'],
  },
  {
    id: 'editor-crop-open',
    page: 'change',
    query: 'screen=editor',
    filename: '03-editor-loaded.png',
    actions: ['prepareCropOpenFlow', 'hideEditorLoaderOverlay'],
  },
  {
    id: 'preview-final',
    page: 'library',
    query: 'screen=library-updated',
    filename: '04-preview-final.png',
    actions: ['openLibraryPreview'],
  },
  {
    id: 'library-updated',
    page: 'change',
    query: 'screen=preview',
    filename: '05-library-updated.png',
    actions: [],
  },
  {
    id: 'save-copy-success',
    page: 'library',
    query: 'screen=save-copy',
    filename: '06-save-copy-success.png',
    actions: [],
  },
];

const APPS = {
  ecc: buildCoverAppSpec({
    id: 'ecc',
    displayName: 'EPUB Cover Changer',
    shortName: 'ECC',
    baseUrlEnv: 'ECC_BASE_URL',
    baseUrlDefault: 'http://localhost:8100',
    localeEnv: 'ECC_SCREENSHOT_LOCALES',
    outputRoot: 'tools/playstore/raw/ecc',
    storageKey: 'ecc.settings',
    settingsVersion: 9,
    homeTourVersion: 4,
    editorTourVersion: 5,
    documentKind: 'epub',
    sampleDocumentFilename: 'ecc-screenshot-sample.epub',
    changeRoute: '/tabs/change',
    libraryRoute: '/tabs/my-epubs',
    changeSelector: 'app-change',
    librarySelector: 'app-my-epubs',
  }),
  pcm: buildCoverAppSpec({
    id: 'pcm',
    displayName: 'PDF Cover Maker',
    shortName: 'PCM',
    baseUrlEnv: 'PCM_BASE_URL',
    baseUrlDefault: 'http://localhost:8100',
    localeEnv: 'PCM_SCREENSHOT_LOCALES',
    outputRoot: 'tools/playstore/raw/pcm',
    storageKey: 'pcm.settings',
    settingsVersion: 9,
    homeTourVersion: 4,
    editorTourVersion: 5,
    documentKind: 'pdf',
    sampleDocumentFilename: 'pcm-screenshot-sample.pdf',
    changeRoute: '/tabs/change',
    libraryRoute: '/tabs/my-pdfs',
    changeSelector: 'app-change',
    librarySelector: 'app-my-pdfs',
  }),
};

function buildCoverAppSpec(options) {
  const captureWidth = 360;
  const captureHeight = 800;

  return {
    id: options.id,
    displayName: options.displayName,
    shortName: options.shortName,
    baseUrlEnv: options.baseUrlEnv,
    baseUrlDefault: options.baseUrlDefault,
    localeEnv: options.localeEnv,
    outputRoot: options.outputRoot,
    storageKey: options.storageKey,
    settingsVersion: options.settingsVersion,
    homeTourVersion: options.homeTourVersion,
    editorTourVersion: options.editorTourVersion,
    documentKind: options.documentKind,
    sampleDocumentFilename: options.sampleDocumentFilename,
    routes: {
      change: options.changeRoute,
      library: options.libraryRoute,
    },
    selectors: {
      appRoot: 'app-root',
      change: options.changeSelector,
      library: options.librarySelector,
      previewModal: 'ion-modal.cover-preview-modal',
      cropPanel: 'cc-crop-panel',
    },
    capture: {
      width: captureWidth,
      height: captureHeight,
      deviceScaleFactor: 4,
    },
    themeId: 'nocturne-violet',
    supportedLocales: [...SUPPORTED_LOCALES],
    promptSections: STANDARD_PROMPT_SECTIONS.map((section) => ({ ...section })),
    scenarios: COMMON_COVER_SCENARIOS.map((scenario) => ({ ...scenario })),
    logPrefix: options.shortName,
  };
}

function getAppSpec(appId) {
  const spec = APPS[appId];
  if (!spec) {
    const supported = Object.keys(APPS).join(', ');
    throw new Error(`Unknown Play Store app "${appId}". Supported: ${supported}`);
  }

  return spec;
}

function getSupportedAppIds() {
  return Object.keys(APPS);
}

module.exports = {
  APPS,
  STANDARD_PROMPT_SECTIONS,
  SUPPORTED_LOCALES,
  buildCoverAppSpec,
  getAppSpec,
  getSupportedAppIds,
};
