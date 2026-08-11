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

const FIX_PROMPT_SECTIONS = [
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
    rawFile: '02-invalid-file.png',
  },
  {
    heading: 'Screenshot 3',
    screenshot: true,
    rawFile: '03-repairable-blocker.png',
  },
  {
    heading: 'Screenshot 4',
    screenshot: true,
    rawFile: '04-my-epubs-open.png',
  },
  {
    heading: 'Screenshot 5',
    screenshot: true,
    rawFile: '05-my-epubs-two-corrected.png',
  },
];

const EMAS_PROMPT_SECTIONS = [
  {
    heading: 'Feature Graphic',
    screenshot: false,
    rawFile: null,
  },
  {
    heading: 'Screenshot 1',
    screenshot: true,
    rawFile: '01-home-empty.png',
  },
  {
    heading: 'Screenshot 2',
    screenshot: true,
    rawFile: '02-merge-sort.png',
  },
  {
    heading: 'Screenshot 3',
    screenshot: true,
    rawFile: '04-split-confirm.png',
  },
  {
    heading: 'Screenshot 4',
    screenshot: true,
    rawFile: '03-split-how-to.png',
  },
  {
    heading: 'Screenshot 5',
    screenshot: true,
    rawFile: '05-split-cover.png',
  },
];

const PMAS_PROMPT_SECTIONS = [
  {
    heading: 'Feature Graphic',
    screenshot: false,
    rawFile: null,
  },
  {
    heading: 'Screenshot 1',
    screenshot: true,
    rawFile: '01-merge-or-split.png',
  },
  {
    heading: 'Screenshot 2',
    screenshot: true,
    rawFile: '02-ordered-merge.png',
  },
  {
    heading: 'Screenshot 3',
    screenshot: true,
    rawFile: '03-bookmarks-pages.png',
  },
  {
    heading: 'Screenshot 4',
    screenshot: true,
    rawFile: '04-flexible-split.png',
  },
  {
    heading: 'Screenshot 5',
    screenshot: true,
    rawFile: '05-review-result.png',
  },
  {
    heading: 'Screenshot 6',
    screenshot: true,
    rawFile: '06-created-pdfs.png',
  },
];

const EMAS_PALETTES = {
  'en-US': { backgroundBase: '#13161A', backgroundSecondary: '#222830', mergeAccent: '#5578E8', splitAccent: '#66A6A1', title: '#FFFFFF', subline: '#D4DAE3', bullet: '#C8D4F0' },
  'es-MX': { backgroundBase: '#15171B', backgroundSecondary: '#242A31', mergeAccent: '#4E6FD6', splitAccent: '#5D9B93', title: '#FFFFFF', subline: '#D5DBE4', bullet: '#C7D3ED' },
  'de-DE': { backgroundBase: '#121416', backgroundSecondary: '#20262C', mergeAccent: '#6C86A3', splitAccent: '#7C9C97', title: '#F7F7F7', subline: '#CDD5DC', bullet: '#DCE6EE' },
  'fr-FR': { backgroundBase: '#151518', backgroundSecondary: '#24242A', mergeAccent: '#6878B8', splitAccent: '#78A19A', title: '#FFFFFF', subline: '#DDDCE4', bullet: '#CFD4EB' },
  'it-IT': { backgroundBase: '#181516', backgroundSecondary: '#2A2426', mergeAccent: '#6677C5', splitAccent: '#79A293', title: '#FFFFFF', subline: '#E4D8D8', bullet: '#D7D8EE' },
  'pt-BR': { backgroundBase: '#151719', backgroundSecondary: '#252A2E', mergeAccent: '#4F72D8', splitAccent: '#55A49A', title: '#FFFFFF', subline: '#D7DDE3', bullet: '#CAD6F2' },
  'ar-SA': { backgroundBase: '#101418', backgroundSecondary: '#1C252B', mergeAccent: '#B88A3A', splitAccent: '#5D8F8A', title: '#FFFFFF', subline: '#D7E0E3', bullet: '#E1D3AA' },
  'hi-IN': { backgroundBase: '#151515', backgroundSecondary: '#252018', mergeAccent: '#5D6FD5', splitAccent: '#D58A3A', title: '#FFFFFF', subline: '#E6D9CE', bullet: '#D2D7F5' },
  'ja-JP': { backgroundBase: '#121416', backgroundSecondary: '#1E2327', mergeAccent: '#5F7894', splitAccent: '#668F8B', title: '#F8F8F8', subline: '#CDD5D8', bullet: '#DCE5EA' },
  'ko-KR': { backgroundBase: '#121417', backgroundSecondary: '#1F2429', mergeAccent: '#5B6DD8', splitAccent: '#5F9993', title: '#FFFFFF', subline: '#CDD6DC', bullet: '#D1D8F4' },
  'ru-RU': { backgroundBase: '#141414', backgroundSecondary: '#20242A', mergeAccent: '#566DA8', splitAccent: '#6A9994', title: '#FFFFFF', subline: '#D2D6DA', bullet: '#D5DCEF' },
  'zh-CN': { backgroundBase: '#111417', backgroundSecondary: '#1D242A', mergeAccent: '#4C6DD0', splitAccent: '#4E9B91', title: '#FFFFFF', subline: '#D4DDE1', bullet: '#CFD8F2' },
  'zh-TW': { backgroundBase: '#121416', backgroundSecondary: '#20272C', mergeAccent: '#5D73B9', splitAccent: '#659C96', title: '#FFFFFF', subline: '#D6E0E3', bullet: '#D4DCF1' },
};

const PMAS_PALETTES = EMAS_PALETTES;
const PMAS_COMPACT_LOCALES = ['ar-SA', 'fr-FR', 'ja-JP', 'zh-CN', 'zh-TW'];

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

const COMMON_FIX_SCENARIOS = [
  {
    id: 'invalid-file',
    page: 'change',
    query: 'screen=invalid-file',
    filename: '02-invalid-file.png',
    actions: ['seedFixInvalidFileState'],
  },
  {
    id: 'repairable-blocker',
    page: 'change',
    query: 'screen=repairable-blocker',
    filename: '03-repairable-blocker.png',
    actions: ['seedFixRepairableBlockerState'],
  },
  {
    id: 'my-epubs-open',
    page: 'library',
    query: 'screen=my-epubs-open',
    filename: '04-my-epubs-open.png',
    actions: ['openLibraryPreview'],
  },
  {
    id: 'my-epubs-two-corrected',
    page: 'library',
    query: 'screen=my-epubs-two-corrected',
    filename: '05-my-epubs-two-corrected.png',
    actions: ['seedLibraryWithTwoCorrectedItems'],
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
    librarySelector: 'app-my-epubs-page',
  }),
  ef: buildFixAppSpec({
    id: 'ef',
    displayName: 'EPUB Fixer',
    shortName: 'EF',
    baseUrlEnv: 'EF_BASE_URL',
    baseUrlDefault: 'http://localhost:8100',
    localeEnv: 'EF_SCREENSHOT_LOCALES',
    outputRoot: 'tools/playstore/raw/ef',
    storageKey: 'epub-fixer.settings',
    settingsVersion: 1,
    homeTourVersion: 1,
    editorTourVersion: 1,
    sampleDocumentFilename: 'ef-screenshot-sample.epub',
    fixRoute: '/tabs/fix-page',
    libraryRoute: '/tabs/my-epubs',
    fixSelector: 'app-fix-page',
    librarySelector: 'app-my-epubs-page',
    previewModalSelector: 'ion-modal.cover-preview-modal',
    saveModalSelector: 'app-save-cover-modal-shared',
    themeIdByLocale: {
      'en-US': 'obsidian-red',
      'es-MX': 'obsidian-red',
      'de-DE': 'silver-tech',
      'fr-FR': 'obsidian-red',
      'it-IT': 'warm-reading',
      'pt-BR': 'warm-reading',
      'ar-SA': 'gold-luxe',
      'hi-IN': 'warm-reading',
      'ja-JP': 'obsidian-red',
      'ko-KR': 'obsidian-red',
      'ru-RU': 'obsidian-red',
      'zh-CN': 'obsidian-red',
      'zh-TW': 'obsidian-red',
    },
  }),
  emas: buildEpubWorkflowAppSpec({
    id: 'emas',
    displayName: 'EPUB Merge & Split',
    shortName: 'EMAS',
    baseUrlEnv: 'EMAS_BASE_URL',
    baseUrlDefault: 'http://localhost:8100',
    localeEnv: 'EMAS_SCREENSHOT_LOCALES',
    outputRoot: 'tools/playstore/raw/emas',
    storageKey: 'epub-merger-and-splitter.settings',
    settingsVersion: 1,
    homeTourVersion: 1,
    editorTourVersion: 1,
    sampleDocumentFilename: 'emas-screenshot-sample.epub',
    homeRoute: '/tabs/home',
    homeSelector: 'app-home',
    themeIdByLocale: {
      'en-US': 'dark',
      'es-MX': 'dark',
      'de-DE': 'silver-tech',
      'fr-FR': 'dark',
      'it-IT': 'nocturne-violet',
      'pt-BR': 'dark',
      'ar-SA': 'gold-luxe',
      'hi-IN': 'nocturne-violet',
      'ja-JP': 'silver-tech',
      'ko-KR': 'dark',
      'ru-RU': 'silver-tech',
      'zh-CN': 'dark',
      'zh-TW': 'dark',
    },
    promptGuidance: {
      palettes: EMAS_PALETTES,
      screenshotAspectRatio: '9:16',
      rawCompositionRule: 'Use the provided raw screenshot as the exact composition reference. Keep its layout, UI, cards, icons, controls, typography, spacing, hierarchy, and element count unchanged. Do not modify the screenshot internally, add elements, remove elements, rearrange elements, or restyle any other part.',
      allowedReplacements: 'Only replace these visible contents: EPUB names using popular public-domain books from the locale or region (prefer a recognizable public-domain trilogy when practical), the displayed filename, the displayed chapter names, and the white placeholder boxes with plausible in-book images. Do not use copyrighted text, modern copyrighted translations, or identifiable copyrighted cover art.',
    },
  }),
  pmas: buildPdfWorkflowAppSpec({
    id: 'pmas',
    displayName: 'PDF Merger & Splitter',
    shortName: 'PMAS',
    baseUrlEnv: 'PMAS_BASE_URL',
    baseUrlDefault: 'http://localhost:8100',
    localeEnv: 'PMAS_SCREENSHOT_LOCALES',
    outputRoot: 'tools/playstore/raw/pmas',
    storageKey: 'pdf-merger-and-splitter.settings',
    settingsVersion: 1,
    homeTourVersion: 1,
    editorTourVersion: 1,
    sampleDocumentFilename: 'pmas-screenshot-sample.pdf',
    homeRoute: '/tabs/home',
    homeSelector: 'app-home',
    libraryRoute: '/tabs/my-pdfs',
    librarySelector: 'app-my-pdfs',
    themeIdByLocale: {
      'en-US': 'dark',
      'es-MX': 'dark',
      'de-DE': 'silver-tech',
      'fr-FR': 'dark',
      'it-IT': 'nocturne-violet',
      'pt-BR': 'dark',
      'ar-SA': 'gold-luxe',
      'hi-IN': 'nocturne-violet',
      'ja-JP': 'silver-tech',
      'ko-KR': 'dark',
      'ru-RU': 'silver-tech',
      'zh-CN': 'dark',
      'zh-TW': 'dark',
    },
    promptGuidance: {
      palettes: PMAS_PALETTES,
      screenshotAspectRatio: '9:16',
      rawCompositionRule: 'Use the provided raw screenshot as the exact composition reference. Keep its layout, PDF cards, icons, controls, typography, spacing, hierarchy, and element count unchanged. Do not modify the screenshot internally, add elements, remove elements, rearrange elements, or restyle any other part.',
      allowedReplacements: 'Only replace these visible contents: fictional PDF filenames, bookmark titles, page ranges, result names, and neutral document thumbnails. Do not use real personal data, official forms, signatures, account numbers, QR codes, barcodes, or copyrighted document content.',
    },
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

function buildFixAppSpec(options) {
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
    sampleDocumentFilename: options.sampleDocumentFilename,
    routes: {
      change: options.fixRoute,
      library: options.libraryRoute,
    },
    selectors: {
      appRoot: 'app-root',
      change: options.fixSelector,
      library: options.librarySelector,
      previewModal: options.previewModalSelector,
      saveModal: options.saveModalSelector,
    },
    capture: {
      width: captureWidth,
      height: captureHeight,
      deviceScaleFactor: 4,
    },
    themeId: 'nocturne-violet',
    themeIdByLocale: options.themeIdByLocale ?? null,
    supportedLocales: [...SUPPORTED_LOCALES],
    promptSections: FIX_PROMPT_SECTIONS.map((section) => ({ ...section })),
    scenarios: COMMON_FIX_SCENARIOS.map((scenario) => ({ ...scenario })),
    logPrefix: options.shortName,
  };
}

function buildEpubWorkflowAppSpec(options) {
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
    sampleDocumentFilename: options.sampleDocumentFilename,
    routes: {
      change: options.homeRoute,
      library: options.homeRoute,
    },
    selectors: {
      appRoot: 'app-root',
      change: options.homeSelector,
      library: options.homeSelector,
      previewModal: 'ion-modal.cover-preview-modal',
    },
    capture: {
      width: captureWidth,
      height: captureHeight,
      deviceScaleFactor: 4,
    },
    themeId: 'nocturne-violet',
    themeIdByLocale: options.themeIdByLocale ?? null,
    supportedLocales: [...SUPPORTED_LOCALES],
    promptSections: EMAS_PROMPT_SECTIONS.map((section) => ({ ...section })),
    promptGuidance: options.promptGuidance ?? null,
    scenarios: [
      {
        id: 'home-empty',
        page: 'change',
        query: 'screen=home-empty',
        filename: '01-home-empty.png',
        actions: [],
      },
      {
        id: 'merge-sort',
        page: 'change',
        query: 'screen=merge-sort',
        filename: '02-merge-sort.png',
        actions: ['seedEmasMergeSortState'],
      },
      {
        id: 'split-how-to',
        page: 'change',
        query: 'screen=split-how-to',
        filename: '04-split-how-to.png',
        actions: ['seedEmasSplitHowToState'],
      },
      {
        id: 'split-confirm',
        page: 'change',
        query: 'screen=split-confirm',
        filename: '03-split-confirm.png',
        actions: ['seedEmasSplitConfirmState'],
      },
      {
        id: 'split-cover',
        page: 'change',
        query: 'screen=split-cover',
        filename: '05-split-cover.png',
        actions: ['seedEmasSplitCoverState'],
      },
    ],
    logPrefix: options.shortName,
  };
}

function buildPdfWorkflowAppSpec(options) {
  const captureWidth = 360;
  const captureHeight = 800;
  const scenarios = [
    {
      id: 'merge-or-split',
      page: 'change',
      query: 'screen=merge-or-split',
      filename: '01-merge-or-split.png',
      actions: [],
    },
    {
      id: 'ordered-merge',
      page: 'change',
      query: 'screen=ordered-merge',
      filename: '02-ordered-merge.png',
      actions: ['seedPmasMergeOrderState'],
    },
    {
      id: 'bookmarks-pages',
      page: 'change',
      query: 'screen=bookmarks-pages',
      filename: '03-bookmarks-pages.png',
      actions: ['seedPmasBookmarksPagesState'],
    },
    {
      id: 'flexible-split',
      page: 'change',
      query: 'screen=flexible-split',
      filename: '04-flexible-split.png',
      actions: ['seedPmasFlexibleSplitState'],
    },
    {
      id: 'review-result',
      page: 'change',
      query: 'screen=review-result',
      filename: '05-review-result.png',
      actions: ['seedPmasReviewResultState'],
    },
    {
      id: 'created-pdfs',
      page: 'library',
      query: 'screen=created-pdfs',
      filename: '06-created-pdfs.png',
      actions: ['seedPmasLibraryState'],
    },
  ];

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
    sampleDocumentFilename: options.sampleDocumentFilename,
    routes: {
      change: options.homeRoute,
      library: options.libraryRoute,
    },
    selectors: {
      appRoot: 'app-root',
      change: options.homeSelector,
      library: options.librarySelector,
    },
    capture: {
      width: captureWidth,
      height: captureHeight,
      deviceScaleFactor: 4,
    },
    themeId: 'nocturne-violet',
    themeIdByLocale: options.themeIdByLocale ?? null,
    supportedLocales: [...SUPPORTED_LOCALES],
    promptSections: PMAS_PROMPT_SECTIONS.map((section) => ({ ...section })),
    promptSectionsByLocale: Object.fromEntries(
      PMAS_COMPACT_LOCALES.map((locale) => [locale, PMAS_PROMPT_SECTIONS.slice(0, 6).map((section) => ({ ...section }))]),
    ),
    promptGuidance: options.promptGuidance ?? null,
    scenarios,
    scenariosByLocale: Object.fromEntries(
      PMAS_COMPACT_LOCALES.map((locale) => [locale, scenarios.slice(0, 5).map((scenario) => ({ ...scenario }))]),
    ),
    logPrefix: options.shortName,
  };
}

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
    themeIdByLocale: options.themeIdByLocale ?? null,
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
  FIX_PROMPT_SECTIONS,
  EMAS_PROMPT_SECTIONS,
  PMAS_PROMPT_SECTIONS,
  PMAS_PALETTES,
  EMAS_PALETTES,
  STANDARD_PROMPT_SECTIONS,
  SUPPORTED_LOCALES,
  buildCoverAppSpec,
  buildFixAppSpec,
  getAppSpec,
  getSupportedAppIds,
};
