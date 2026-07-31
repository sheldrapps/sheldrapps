// @ts-check

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');

const { getAppSpec, getSupportedAppIds } = require('./playstore-specs.cjs');

async function runScreenshotCli(appId, argv = process.argv.slice(2)) {
  const app = getAppSpec(appId ?? resolveAppId(argv));
  const locales = resolveLocales(argv, app.supportedLocales, app.localeEnv);
  await runScreenshotCapture(app, locales);
}

async function runScreenshotCapture(app, locales) {
  const fixtures = await createFixtures(app);
  fs.mkdirSync(resolveRoot(app.outputRoot), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    for (const locale of locales) {
      await captureLocale(browser, app, locale, fixtures);
    }
  } finally {
    await browser.close();
  }

  console.log('\nAll screenshots saved under:', resolveRoot(app.outputRoot));
}

async function captureLocale(browser, app, locale, fixtures) {
  const outDir = path.join(resolveRoot(app.outputRoot), locale);
  fs.mkdirSync(outDir, { recursive: true });

  const context = await browser.newContext({
    viewport: {
      width: app.capture.width,
      height: app.capture.height,
    },
    deviceScaleFactor: app.capture.deviceScaleFactor,
    locale,
  });
  await seedCaptureTourSettings(context, app, locale);

  try {
    const page = await context.newPage();
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith(`[${app.logPrefix}:`) || text.startsWith(`[${app.logPrefix}][`)) {
        console.log(`   ${text}`);
      }
    });
    page.on('pageerror', (error) => {
      console.log(`   [pageerror] ${error.message}`);
    });

    for (const scenario of app.scenarios) {
      const routeUrl = buildRouteUrl(app, scenario);
      console.log(`-> [${locale}] ${scenario.id}: ${routeUrl}`);

      await page.goto(routeUrl, { waitUntil: 'networkidle' });
      await applyAppLocale(page, locale);
      await forcePlaystoreTheme(page, resolveThemeIdForLocale(app, locale));
      await dismissAnyTour(page);

      if (scenario.page === 'library') {
        await ensureLibrarySeed(page, app, fixtures);
        await dismissAnyTour(page);
      }

      for (const action of scenario.actions ?? []) {
        await runScenarioAction(action, page, app, fixtures, locale);
        await dismissAnyTour(page);
      }

      await dismissAnyTour(page);
      await page.waitForTimeout(600);
      await dismissAnyTour(page);

      const outPath = path.join(outDir, scenario.filename);
      await page.screenshot({
        path: outPath,
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: app.capture.width,
          height: app.capture.height,
        },
      });

      console.log(`   [ok] saved ${outPath}`);
    }
  } finally {
    await context.close();
  }
}

async function runScenarioAction(action, page, app, fixtures, locale) {
  if (typeof action === 'string') {
    switch (action) {
      case 'prepareAdjustContrastFlow':
        await prepareAdjustContrastFlow(page, app, fixtures);
        return;
      case 'prepareCropOpenFlow':
        await prepareCropOpenFlow(page, app, fixtures);
        return;
      case 'hideEditorLoaderOverlay':
        await hideEditorLoaderOverlay(page);
        return;
      case 'openLibraryPreview':
        await openLibraryPreview(page, app, fixtures);
        return;
      case 'seedFixInvalidFileState':
        await seedFixInvalidFileState(page, app);
        return;
      case 'seedFixRepairableBlockerState':
        await seedFixRepairableBlockerState(page, app);
        return;
      case 'seedFixDiagnosisState':
        await seedFixDiagnosisState(page, app);
        return;
      case 'seedFixRepairFlowState':
        await seedFixRepairFlowState(page, app);
        return;
      case 'seedFixRepairResultState':
        await seedFixRepairResultState(page, app);
        return;
      case 'seedEmasMergeSortState':
        await seedEmasMergeSortState(page, app, locale);
        return;
      case 'seedEmasSplitHowToState':
        await seedEmasSplitHowToState(page, app, locale);
        return;
      case 'seedEmasSplitConfirmState':
        await seedEmasSplitConfirmState(page, app, locale);
        return;
      case 'seedEmasSplitCoverState':
        await seedEmasSplitCoverState(page, app, locale);
        return;
      case 'seedLibraryWithTwoCorrectedItems':
        await seedLibraryWithTwoCorrectedItems(page, app, fixtures);
        return;
      case 'openFixSaveModal':
        await openFixSaveModal(page, app);
        return;
      default:
        throw new Error(`Unknown screenshot action "${action}".`);
    }
  }

  if (action?.type === 'wait') {
    await page.waitForTimeout(action.ms);
    return;
  }

  throw new Error(`Unsupported screenshot action: ${JSON.stringify(action)}`);
}

function buildRouteUrl(app, scenario) {
  const route = scenario.page === 'library' ? app.routes.library : app.routes.change;
  const url = new URL(route, resolveBaseUrl(app));
  if (scenario.query) {
    url.search = scenario.query;
  }
  return url.toString();
}

async function createFixtures(app) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${app.id}-screenshot-`));
  const imagePath = path.join(tempDir, 'cover.png');
  await sharp({
    create: {
      width: 1600,
      height: 2400,
      channels: 4,
      background: '#f2f2f2',
    },
  })
    .png()
    .toFile(imagePath);

  const coverDataUrl = `data:image/png;base64,${(
    await fs.promises.readFile(imagePath)
  ).toString('base64')}`;

  return {
    tempDir,
    imagePath,
    documentFilename: app.sampleDocumentFilename,
    coverDataUrl,
  };
}

async function applyAppLocale(page, locale) {
  await page.evaluate(
    async (expected) => {
      const ngApi = window.ng;
      const appEl = document.querySelector('app-root');
      const component = ngApi?.getComponent?.(appEl);
      if (component?.lang?.set) {
        await component.lang.set(expected);
      } else if (component?.translate?.use) {
        const result = component.translate.use(expected);
        if (result?.subscribe) {
          await new Promise((resolve, reject) => {
            result.subscribe({ next: resolve, error: reject });
          });
        }
      } else {
        throw new Error('LanguageService is not available from AppComponent.');
      }

      document.documentElement.lang = expected;
      document.documentElement.lang = expected;
    },
    locale,
  );

  await page.waitForFunction(
    (expected) => {
      const ngApi = window.ng;
      const appEl = document.querySelector('app-root');
      const component = ngApi?.getComponent?.(appEl);
      return (
        document.documentElement.lang === expected ||
        component?.lang?.lang === expected ||
        component?.translate?.currentLang === expected ||
        component?.translate?.currentLang?.toString?.() === expected
      );
    },
    locale,
    { timeout: 15_000 },
  );
}

async function prepareAdjustContrastFlow(page, app, fixtures) {
  await seedDocumentIntoEditor(page, app, fixtures);
  await openEditor(page, 'adjustments');

  const adjustmentButtons = page.locator('cc-adjustments-page .bottom-bar ion-button');
  await adjustmentButtons.first().waitFor({ timeout: 12_000 });
  const adjustmentCount = await adjustmentButtons.count();
  let contrastOpened = false;
  if (adjustmentCount > 0) {
    const maxProbe = Math.min(adjustmentCount, 7);
    for (let i = 0; i < maxProbe; i += 1) {
      await adjustmentButtons.nth(i).evaluate((el) => {
        el.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true }),
        );
      });
      await page.waitForTimeout(220);
      const hasContrast = await page.locator('cc-contrast-panel').count();
      if (hasContrast > 0) {
        contrastOpened = true;
        break;
      }
    }
  }

  if (!contrastOpened) {
    contrastOpened = await page
      .evaluate(() => {
        const ngApi = window.ng;
        const shellEl = document.querySelector('cc-editor-shell-page');
        const component = ngApi?.getComponent?.(shellEl);
        if (!component?.ui?.openPanel) return false;
        component.ui.openPanel('adjustments', 'contrast');
        return true;
      })
      .catch(() => false);
    if (contrastOpened) {
      await page.waitForTimeout(280);
    }
  }

  if (!contrastOpened) {
    throw new Error('Could not open contrast panel for screenshot capture.');
  }

  const slider = page.locator('cc-contrast-panel ion-range').first();
  await slider.waitFor({ timeout: 8_000, state: 'visible' });
  await slider.evaluate((el) => {
    // @ts-ignore - Ion range internals
    el.value = 1.28;
    el.dispatchEvent(new Event('ionInput', { bubbles: true }));
  });
  await page.waitForTimeout(250);
}

async function prepareCropOpenFlow(page, app, fixtures) {
  await seedDocumentIntoEditor(page, app, fixtures);
  await openEditor(page, 'tools');

  await page.evaluate(async () => {
    const ngApi = window.ng;
    const shell = document.querySelector('cc-editor-shell-page');
    const component = ngApi?.getComponent?.(shell);
    if (!component?.ui?.openPanel) {
      throw new Error('Editor shell UI service is not available.');
    }
    component.ui.openPanel('tools', 'crop');
  });

  await page.locator(app.selectors.cropPanel).first().waitFor({
    timeout: 12_000,
    state: 'visible',
  });
  await page.evaluate(() => {
    const ngApi = window.ng;
    const shell = document.querySelector('cc-editor-shell-page');
    const component = ngApi?.getComponent?.(shell);
    if (component?.stopEditorTour) {
      component.stopEditorTour();
    }
  });
  await page.waitForTimeout(250);
}

async function seedDocumentIntoEditor(page, app, fixtures) {
  await page.evaluate(() => {
    const ngApi = window.ng;
    const appEl = document.querySelector('app-change');
    const component = ngApi?.getComponent?.(appEl);
    if (!component) {
      throw new Error('ChangePage component is not available.');
    }

    const placeholderPdf = new File(
      [new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 37, 69, 79, 70, 10])],
      'pcm-placeholder.pdf',
      { type: 'application/pdf' },
    );

    component.sourcePdfFile = placeholderPdf;
    component.workingPdfFile = placeholderPdf;
    component.workingPdfName = placeholderPdf.name;
    component.selectedPdfName = placeholderPdf.name;
    component.generatedPdfBytes = new Uint8Array(placeholderPdf.size);
    if (ngApi?.applyChanges) {
      ngApi.applyChanges(appEl);
    }
  });

  await page.evaluate(async (coverDataUrl) => {
    const ngApi = window.ng;
    const appEl = document.querySelector('app-change');
    const component = ngApi?.getComponent?.(appEl);
    if (!component?.applyImageSource) {
      throw new Error('ChangePage.applyImageSource is not available.');
    }

    const response = await fetch(coverDataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'pcm-cover.png', { type: blob.type || 'image/png' });
    window.__pcmCaptureCoverFile = file;
    await component.applyImageSource(file, true);
    component.originalImageFile = file;
    component.workingImageFile = file;
    component.editorSourceFile = file;
    component.selectedImageFile = file;
    component.selectedImageName = file.name;
    component.previewUrl = URL.createObjectURL(file);
    if (ngApi?.applyChanges) {
      ngApi.applyChanges(appEl);
    }
  }, fixtures.coverDataUrl);

  await page.waitForFunction(() => {
    const button = document.querySelector('ion-button[data-tour-id="adjust-button"]');
    return !!button && !button.hasAttribute('disabled');
  }, null, { timeout: 20_000 });

  await page.evaluate(
    async ({ selector, generateMethodName, saveMethodName, sampleFilename, title }) => {
      const ngApi = window.ng;
      const appEl = document.querySelector(selector);
      const component = ngApi?.getComponent?.(appEl);
      const coverFile =
        component?.originalImageFile ??
        component?.workingImageFile ??
        component?.selectedImageFile;

      if (!component?.fileService?.[generateMethodName]) {
        throw new Error('Document file service is not available.');
      }
      if (!coverFile) {
        throw new Error('Cover image file is missing.');
      }

      const generated = await component.fileService[generateMethodName]({
        modelId: 'pdf',
        coverFile,
        filename: sampleFilename,
        title,
      });

      await component.fileService[saveMethodName]({
        bytes: generated.bytes,
        filename: generated.filename,
        coverFileForThumb: coverFile,
        overwriteExisting: true,
      });

      const sourcePdfFile = new File(
        [generated.bytes],
        generated.filename,
        { type: 'application/pdf' },
      );
      component.sourcePdfFile = sourcePdfFile;
      component.workingPdfFile = sourcePdfFile;
      component.workingPdfName = generated.filename;
      component.selectedPdfName = generated.filename;
      component.generatedPdfBytes = generated.bytes;
      component.previewUrl = URL.createObjectURL(coverFile);
      component.originalImageFile = coverFile;
      component.workingImageFile = coverFile;
      component.editorSourceFile = coverFile;
      if (ngApi?.applyChanges) {
        ngApi.applyChanges(appEl);
      }
    },
    {
      selector: app.selectors.change,
      generateMethodName: 'generatePdfBytes',
      saveMethodName: 'saveGeneratedPdf',
      sampleFilename: fixtures.documentFilename,
      title: 'PDF Cover',
    },
  );

  await page.evaluate(async () => {
    const ngApi = window.ng;
    const appEl = document.querySelector('app-change');
    const component = ngApi?.getComponent?.(appEl);
    if (!component?.startCrop) {
      throw new Error('ChangePage.startCrop is not available.');
    }
    await component.startCrop();
  });

  await page.waitForURL(/\/editor(?:\/(tools|adjustments|text))?\?/, {
    timeout: 20_000,
  });
}

async function openEditor(page, panel) {
  const editorHref = new URL(page.url());
  if (!editorHref.searchParams.get('sid')) {
    throw new Error('Editor session sid missing for screenshot capture.');
  }

  const targetPath =
    panel === 'adjustments' ? '/editor/adjustments' : '/editor/tools';
  if (editorHref.pathname !== targetPath) {
    editorHref.pathname = targetPath;
    await page.evaluate(
      async ({ href, selector }) => {
        const ngApi = window.ng;
        const shell = document.querySelector(selector);
        const component = ngApi?.getComponent?.(shell);
        if (!component?.router?.navigateByUrl) {
          throw new Error('Editor shell router is not available.');
        }
        await component.router.navigateByUrl(href);
      },
      {
        href: editorHref.pathname + editorHref.search + editorHref.hash,
        selector: 'cc-editor-shell-page',
      },
    );
  }
}

async function ensureLibrarySeed(page, app, fixtures, filenames = [fixtures.documentFilename]) {
  await page.locator(app.selectors.library).first().waitFor({
    timeout: 15_000,
    state: 'attached',
  });

  const libraryState = await page.evaluate(
    async ({ selector, documentFilenames, coverDataUrl }) => {
      const ngApi = window.ng;
      const appEl = document.querySelector(selector);
      const component = ngApi?.getComponent?.(appEl);
      if (!component) {
        throw new Error('Library page component is not available.');
      }

      if (component.load) {
        await component.load(undefined, { silent: true });
      }

      component.items = documentFilenames.map((filename) => ({
        filename,
        thumbDataUrl: coverDataUrl,
      }));
      component.loading = false;
      component.pageErrorKey = null;
      component.pageErrorParams = null;
      component.previewOpen = false;
      component.previewFilename = null;
      component.previewDataUrl = null;

      if (ngApi?.applyChanges) {
        ngApi.applyChanges(appEl);
      }

      return {
        items: component.items?.length ?? 0,
      };
    },
    {
      selector: app.selectors.library,
      documentFilenames: filenames,
      coverDataUrl: fixtures.coverDataUrl,
    },
  );

  console.log(`   [debug] library seeded items=${libraryState.items}`);
}

async function openLibraryPreview(page, app, fixtures) {
  await ensureLibrarySeed(page, app, fixtures, ['epub-reparado.epub']);

  await page.waitForFunction(() => {
    const cards = document.querySelectorAll('.cover-card');
    return (
      cards.length > 0 &&
      Array.from(cards).some((card) => {
        const style = window.getComputedStyle(card);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
    );
  }, null, {
    timeout: 15_000,
  });

  await page.evaluate((coverDataUrl) => {
    const ngApi = window.ng;
    const appEl = document.querySelector('app-my-pdfs, app-my-epubs-page');
    const component = ngApi?.getComponent?.(appEl);
    if (!component) {
      throw new Error('Library page component is not available.');
    }
    if (!component.previewOpen || !component.previewDataUrl) {
      component.previewOpen = true;
      component.previewFilename = component.items?.[0]?.filename ?? null;
      component.previewDataUrl = coverDataUrl;
      component.previewIsDithered = false;
      component.previewLoading = false;
      component.previewUnavailable = false;
      component.previewGettingCover = false;
    }
    if (ngApi?.applyChanges && appEl) {
      ngApi.applyChanges(appEl);
    }
  }, fixtures.coverDataUrl);

  await page.locator(app.selectors.previewModal).first().waitFor({
    timeout: 12_000,
    state: 'visible',
  });
}

async function seedFixInvalidFileState(page, app) {
  await setFixPageState(page, app, {
    preparedSessionId: undefined,
    selectedEpubName: undefined,
    sourceEpubMeta: undefined,
    diagnosis: undefined,
    repairResult: undefined,
    exportResult: undefined,
    viewState: 'failed',
    epubErrorKey: 'FIX.EPUB_ERROR_CORRUPT',
    epubErrorParams: {
      name: 'archivo-no-valido.epub',
    },
    busyAction: undefined,
    busyProgressPercent: 0,
  });
}

async function seedFixRepairableBlockerState(page, app) {
  await setFixPageState(page, app, {
    preparedSessionId: 'session-blocker',
    selectedEpubName: 'bloqueante-reparable.epub',
    sourceEpubMeta: {
      name: 'bloqueante-reparable.epub',
      size: 2 * 1024 * 1024,
      lastModified: Date.now(),
      type: 'application/epub+zip',
    },
    diagnosis: {
      sessionId: 'session-blocker',
      status: 'repairable',
      issues: [
        {
          code: 'MIMETYPE_MISSING',
          severity: 'error',
          fixable: true,
          messageKey: 'FIX.ISSUE_MIMETYPE_MISSING',
          repairMode: 'automatic',
        },
        {
          code: 'CONTAINER_MISSING',
          severity: 'error',
          fixable: true,
          messageKey: 'FIX.ISSUE_CONTAINER_MISSING',
          repairMode: 'automatic',
        },
        {
          code: 'OPF_AMBIGUOUS',
          severity: 'warning',
          fixable: true,
          messageKey: 'FIX.ISSUE_OPF_AMBIGUOUS',
          repairMode: 'guided',
          options: ['OPS/package.opf', 'OPS/backup.opf'],
        },
      ],
    },
    repairResult: undefined,
    exportResult: undefined,
    viewState: 'diagnosed',
    epubErrorKey: undefined,
    epubErrorParams: {},
    busyAction: undefined,
    busyProgressPercent: 0,
  });
}

async function seedLibraryWithTwoCorrectedItems(page, app, fixtures) {
  await ensureLibrarySeed(page, app, fixtures, [
    'epub-reparado-1.epub',
    'epub-reparado-2.epub',
  ]);
}

async function seedFixDiagnosisState(page, app) {
  await setFixPageState(page, app, {
    preparedSessionId: 'session-diagnosis',
    selectedEpubName: 'broken-book.epub',
    sourceEpubMeta: {
      name: 'broken-book.epub',
      size: 2 * 1024 * 1024,
      lastModified: Date.now(),
      type: 'application/epub+zip',
    },
    diagnosis: {
      sessionId: 'session-diagnosis',
      status: 'repairable',
      issues: [
        {
          code: 'MIMETYPE_MISSING',
          severity: 'error',
          fixable: true,
          messageKey: 'FIX.ISSUE_MIMETYPE_MISSING',
          repairMode: 'automatic',
        },
        {
          code: 'CONTAINER_MISSING',
          severity: 'error',
          fixable: true,
          messageKey: 'FIX.ISSUE_CONTAINER_MISSING',
          repairMode: 'automatic',
        },
        {
          code: 'OPF_AMBIGUOUS',
          severity: 'warning',
          fixable: true,
          messageKey: 'FIX.ISSUE_OPF_AMBIGUOUS',
          repairMode: 'guided',
          options: ['OPS/package.opf', 'OPS/backup.opf'],
        },
      ],
    },
    repairResult: undefined,
    exportResult: undefined,
    viewState: 'diagnosed',
    epubErrorKey: undefined,
    epubErrorParams: {},
    busyAction: undefined,
    busyProgressPercent: 0,
  });
}

async function seedFixRepairFlowState(page, app) {
  await setFixPageState(page, app, {
    preparedSessionId: 'session-repair',
    selectedEpubName: 'broken-book.epub',
    sourceEpubMeta: {
      name: 'broken-book.epub',
      size: 2 * 1024 * 1024,
      lastModified: Date.now(),
      type: 'application/epub+zip',
    },
    diagnosis: {
      sessionId: 'session-repair',
      status: 'repairable',
      issues: [
        {
          code: 'MIMETYPE_MISSING',
          severity: 'error',
          fixable: true,
          messageKey: 'FIX.ISSUE_MIMETYPE_MISSING',
          repairMode: 'automatic',
        },
        {
          code: 'MANIFEST_ITEM_MISSING',
          severity: 'warning',
          fixable: true,
          messageKey: 'FIX.ISSUE_MANIFEST_ITEM_MISSING',
          repairMode: 'review',
        },
        {
          code: 'SPINE_EMPTY',
          severity: 'error',
          fixable: true,
          messageKey: 'FIX.ISSUE_SPINE_EMPTY',
          repairMode: 'partial_recovery',
        },
      ],
    },
    repairResult: undefined,
    exportResult: undefined,
    viewState: 'diagnosed',
    epubErrorKey: undefined,
    epubErrorParams: {},
    busyAction: 'repair',
    busyProgressPercent: 62,
  });
}

async function seedFixRepairResultState(page, app) {
  await setFixPageState(page, app, {
    preparedSessionId: 'session-result',
    selectedEpubName: 'broken-book.epub',
    sourceEpubMeta: {
      name: 'broken-book.epub',
      size: 2 * 1024 * 1024,
      lastModified: Date.now(),
      type: 'application/epub+zip',
    },
    diagnosis: {
      sessionId: 'session-result',
      status: 'repairable',
      issues: [
        {
          code: 'MIMETYPE_MISSING',
          severity: 'error',
          fixable: true,
          messageKey: 'FIX.ISSUE_MIMETYPE_MISSING',
          repairMode: 'automatic',
        },
        {
          code: 'CONTAINER_MISSING',
          severity: 'error',
          fixable: true,
          messageKey: 'FIX.ISSUE_CONTAINER_MISSING',
          repairMode: 'automatic',
        },
        {
          code: 'MANIFEST_ITEM_MISSING',
          severity: 'warning',
          fixable: true,
          messageKey: 'FIX.ISSUE_MANIFEST_ITEM_MISSING',
          repairMode: 'review',
        },
      ],
    },
    repairResult: {
      success: true,
      repairedIssues: ['MIMETYPE_MISSING', 'CONTAINER_MISSING'],
    },
    exportResult: {
      size: 2 * 1024 * 1024,
      outputName: 'broken-book_repaired.epub',
      outputUri: 'blob:broken-book-repaired',
    },
    viewState: 'repaired',
    epubErrorKey: undefined,
    epubErrorParams: {},
    busyAction: undefined,
    busyProgressPercent: 100,
  });
}

async function openFixSaveModal(page, app) {
  await seedFixRepairResultState(page, app);

  await page.evaluate(async () => {
    const ngApi = window.ng;
    const appEl = document.querySelector('app-fix-page');
    const component = ngApi?.getComponent?.(appEl);
    if (!component?.onSave) {
      throw new Error('FixPage.onSave is not available.');
    }
    void component.onSave();
  });

  await page.locator(app.selectors.saveModal ?? 'app-save-cover-modal-shared').first().waitFor({
    timeout: 12_000,
    state: 'visible',
  });
}

async function setFixPageState(page, app, state) {
  await page.evaluate(
    async ({ selector, value }) => {
      const ngApi = window.ng;
      const appEl = document.querySelector(selector);
      const component = ngApi?.getComponent?.(appEl);
      if (!component) {
        throw new Error('FixPage component is not available.');
      }

      Object.assign(component, value);

      if (ngApi?.applyChanges) {
        ngApi.applyChanges(appEl);
      }
    },
    {
      selector: app.selectors.change,
      value: state,
    },
  );
}

async function seedEmasMergeSortState(page, app, locale) {
  await setEmasHomeState(page, app, {
    selectedMode: 'merge',
    workflowStep: 1,
    mergeSelections: [
      buildEmasSelection('merge-1', 'EPUB 01.epub'),
      buildEmasSelection('merge-2', 'EPUB 02.epub'),
      buildEmasSelection('merge-3', 'EPUB 03.epub'),
    ],
  });
}

async function seedEmasSplitHowToState(page, app, locale) {
  await setEmasHomeState(page, app, {
    selectedMode: 'split',
    workflowStep: 1,
    splitSelection: buildEmasSelection('split-1', 'EPUB.epub', 12 * 1024 * 1024),
    splitMethod: 'by-chapters-or-sections',
  });
}

async function seedEmasSplitConfirmState(page, app, locale) {
  await setEmasHomeState(page, app, {
    selectedMode: 'split',
    workflowStep: 2,
    splitSelection: buildEmasSelection('split-1', 'EPUB.epub', 12 * 1024 * 1024),
    splitMethod: 'by-chapters-or-sections',
    splitChapterMode: 'chapter',
    splitAnalysis: buildEmasSplitAnalysis(locale),
  });
}

async function seedEmasSplitCoverState(page, app, locale) {
  const placeholder = buildEmasCoverPlaceholderDataUrl();
  await setEmasHomeState(page, app, {
    selectedMode: 'split',
    workflowStep: 3,
    splitSelection: buildEmasSelection('split-1', 'EPUB.epub', 12 * 1024 * 1024),
    splitMethod: 'by-chapters-or-sections',
    splitChapterMode: 'chapter',
    splitAnalysis: buildEmasSplitAnalysis(locale),
    coverCandidates: [1, 2, 3].map((index) => ({
      image: {
        id: `placeholder-${index}`,
        src: placeholder,
        fileName: '',
        width: 1236,
        height: 1648,
        mimeType: 'image/svg+xml',
        sizeBytes: 1024,
        index,
      },
      score: 0,
      reasons: [],
    })),
  });
}

function buildEmasSelection(id, selectedName, sourceSize = 4 * 1024 * 1024) {
  return {
    id,
    sessionId: null,
    selectedName,
    sourceSize,
    sourceLastModified: Date.now(),
    sourceMimeType: 'application/epub+zip',
    workingPath: '',
    workingName: selectedName,
    workingFile: null,
    workingNativePath: null,
    outputBaseName: selectedName.replace(/\.epub$/i, ''),
    sourceKind: 'web',
  };
}

function buildEmasSplitAnalysis(locale = 'en-US') {
  const fixtureLabels = {
    'en-US': ['Chapter 1 — Beginning', 'Chapter 2 — The Journey', 'Chapter 3 — New Paths', 'Chapter 4 — Turning Point', 'Chapter 5 — The Return', 'Chapter 6 — Afterword', 'Part One', 'Part Two'],
    'es-MX': ['Capítulo 1 — Inicio', 'Capítulo 2 — El viaje', 'Capítulo 3 — Nuevos caminos', 'Capítulo 4 — Punto de giro', 'Capítulo 5 — El regreso', 'Capítulo 6 — Epílogo', 'Parte uno', 'Parte dos'],
    'de-DE': ['Kapitel 1 — Anfang', 'Kapitel 2 — Die Reise', 'Kapitel 3 — Neue Wege', 'Kapitel 4 — Wendepunkt', 'Kapitel 5 — Die Rückkehr', 'Kapitel 6 — Nachwort', 'Teil eins', 'Teil zwei'],
    'fr-FR': ['Chapitre 1 — Début', 'Chapitre 2 — Le voyage', 'Chapitre 3 — Nouveaux chemins', 'Chapitre 4 — Tournant', 'Chapitre 5 — Le retour', 'Chapitre 6 — Épilogue', 'Première partie', 'Deuxième partie'],
    'it-IT': ['Capitolo 1 — Inizio', 'Capitolo 2 — Il viaggio', 'Capitolo 3 — Nuovi percorsi', 'Capitolo 4 — Svolta', 'Capitolo 5 — Il ritorno', 'Capitolo 6 — Postfazione', 'Parte prima', 'Parte seconda'],
    'pt-BR': ['Capítulo 1 — Início', 'Capítulo 2 — A jornada', 'Capítulo 3 — Novos caminhos', 'Capítulo 4 — Ponto de virada', 'Capítulo 5 — O retorno', 'Capítulo 6 — Epílogo', 'Parte um', 'Parte dois'],
    'ru-RU': ['Глава 1 — Начало', 'Глава 2 — Путешествие', 'Глава 3 — Новые пути', 'Глава 4 — Поворот', 'Глава 5 — Возвращение', 'Глава 6 — Послесловие', 'Часть первая', 'Часть вторая'],
    'ja-JP': ['第1章 — 始まり', '第2章 — 旅', '第3章 — 新しい道', '第4章 — 転機', '第5章 — 帰還', '第6章 — あとがき', '第1部', '第2部'],
    'ko-KR': ['챕터 1 — 시작', '챕터 2 — 여정', '챕터 3 — 새로운 길', '챕터 4 — 전환점', '챕터 5 — 귀환', '챕터 6 — 후기', '파트 1', '파트 2'],
    'zh-CN': ['第1章 — 开始', '第2章 — 旅程', '第3章 — 新道路', '第4章 — 转折点', '第5章 — 归来', '第6章 — 后记', '第一部分', '第二部分'],
    'zh-TW': ['第1章 — 開始', '第2章 — 旅程', '第3章 — 新道路', '第4章 — 轉折點', '第5章 — 歸來', '第6章 — 後記', '第一部分', '第二部分'],
    'ar-SA': ['الفصل 1 — البداية', 'الفصل 2 — الرحلة', 'الفصل 3 — طرق جديدة', 'الفصل 4 — نقطة التحول', 'الفصل 5 — العودة', 'الفصل 6 — الخاتمة', 'الجزء الأول', 'الجزء الثاني'],
    'hi-IN': ['अध्याय 1 — शुरुआत', 'अध्याय 2 — यात्रा', 'अध्याय 3 — नए रास्ते', 'अध्याय 4 — मोड़', 'अध्याय 5 — वापसी', 'अध्याय 6 — उपसंहार', 'भाग एक', 'भाग दो'],
  }[locale] ?? [];
  const titles = [
    ...fixtureLabels.slice(0, 6),
  ];
  const units = titles.map((title, order) => ({
    id: `unit-${order + 1}`,
    title,
    href: `chapter-${order + 1}.xhtml`,
    sourcePath: `chapter-${order + 1}.xhtml`,
    order,
    sizeBytes: 2 * 1024 * 1024,
    sectionId: order < 3 ? 'section-1' : 'section-2',
  }));

  return {
    fileName: 'EPUB.epub',
    fileSizeBytes: 12 * 1024 * 1024,
    units,
    sections: [
      {
        id: 'section-1',
        title: fixtureLabels[6],
        firstUnitOrder: 0,
        lastUnitOrder: 2,
      },
      {
        id: 'section-2',
        title: fixtureLabels[7],
        firstUnitOrder: 3,
        lastUnitOrder: 5,
      },
    ],
    tocEntries: [],
    hasUsableToc: true,
  };
}

function buildEmasCoverPlaceholderDataUrl() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1236 1648">',
    '<rect width="1236" height="1648" fill="#ffffff"/>',
    '<rect x="8" y="8" width="1220" height="1632" fill="none" stroke="#d9dfe6" stroke-width="16"/>',
    '</svg>',
  ].join('');
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

async function setEmasHomeState(page, app, state) {
  await page.evaluate(
    ({ selector, value }) => {
      const ngApi = window.ng;
      const appEl = document.querySelector(selector);
      const component = ngApi?.getComponent?.(appEl);
      if (!component) {
        throw new Error('EMAS HomePage component is not available.');
      }

      component.selectedMode?.set(value.selectedMode ?? null);
      component.mergeSelections?.set(value.mergeSelections ?? []);
      component.splitSelection?.set(value.splitSelection ?? null);
      component.splitAnalysis?.set(value.splitAnalysis ?? null);
      component.splitAnalysisPending?.set(false);
      component.coverCandidates?.set(value.coverCandidates ?? []);
      component.selectedCoverCandidateId?.set(undefined);
      component.coverSourceMode?.set(null);
      component.bestCandidateDismissed?.set(false);
      component.pickerErrorKey?.set(null);
      component.operationFeedback?.set(null);
      component.operationProgress?.set(null);
      component.isPicking?.set(false);
      component.isDetectingCoverCandidates?.set(false);
      component.isResettingFlow?.set(false);
      component.splitConfigurationRevision?.update((revision) => revision + 1);
      component.workflowStep = value.workflowStep;
      component.splitMethod = value.splitMethod ?? 'by-chapters-or-sections';
      component.splitChapterMode = value.splitChapterMode ?? 'chapter';
      component.splitEqualPartsValue = 2;
      component.splitEqualPartsSelectionValue = '2';
      component.splitMaximumSize = 10;
      component.splitMaximumSizeSelection = '10';

      if (ngApi?.applyChanges) {
        ngApi.applyChanges(appEl);
      }
    },
    {
      selector: app.selectors.change,
      value: state,
    },
  );

  await page.waitForFunction(
    ({ selector, selectedMode, workflowStep }) => {
      const ngApi = window.ng;
      const appEl = document.querySelector(selector);
      const component = ngApi?.getComponent?.(appEl);
      return component?.selectedMode?.() === selectedMode && component?.workflowStep === workflowStep;
    },
    {
      selector: app.selectors.change,
      selectedMode: state.selectedMode,
      workflowStep: state.workflowStep,
    },
    { timeout: 12_000 },
  );
}

async function hideEditorLoaderOverlay(page) {
  await page.addStyleTag({
    content:
      '.frame-loader{display:none !important;} .frame-loader ion-spinner{display:none !important;}',
  });
}

async function forcePlaystoreTheme(page, themeId) {
  await page.evaluate(async (resolvedThemeId) => {
    const ngApi = window.ng;
    const app = document.querySelector('app-root');
    const component = ngApi?.getComponent?.(app);
    if (component?.theme?.previewTheme) {
      await component.theme.previewTheme(resolvedThemeId);
      return;
    }

    const themeClasses = [
      'theme-light',
      'theme-dark',
      'theme-warm-reading',
      'theme-pop-rose',
      'theme-nocturne-violet',
      'theme-obsidian-red',
      'theme-terminal-green',
      'theme-mint-fresh',
      'theme-silver-tech',
      'theme-gold-luxe',
      'app-theme-light',
      'app-theme-dark',
      'ion-palette-dark',
    ];
    const className = `theme-${resolvedThemeId}`;
    const appearance = ['light', 'warm-reading', 'pop-rose', 'mint-fresh'].includes(resolvedThemeId)
      ? 'light'
      : 'dark';
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedThemeId);
    root.classList.remove(...themeClasses);
    root.classList.add(className);
    root.style.colorScheme = appearance;
    root.setAttribute('data-resolved-theme', resolvedThemeId);
    root.setAttribute('data-resolved-appearance', appearance);
  }, themeId);

  await page.waitForFunction(
    (expected) =>
      document.documentElement.getAttribute('data-resolved-theme') === expected,
    themeId,
    { timeout: 15_000 },
  );
}

function resolveThemeIdForLocale(app, locale) {
  return app.themeIdByLocale?.[locale] ?? app.themeId;
}

async function seedCaptureTourSettings(context, app, locale) {
  const prefix = app.shortName.toLowerCase();
  const payload = {
    version: app.settingsVersion,
    data: {
      language: locale,
      homeTourSeen: true,
      homeTourVersion: app.homeTourVersion,
      homeTourSeenAt: new Date().toISOString(),
      preferences: {
        [`${prefix}_editor_tour_seen_version`]: app.editorTourVersion,
        [`${prefix}_editor_artifact_reduction_info_seen`]: true,
      },
    },
  };

  await context.addInitScript(
    ({ storageKey, value }) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch {
        // Best effort only.
      }
    },
    {
      storageKey: app.storageKey,
      value: payload,
    },
  );
}

async function dismissAnyTour(page) {
  await page.evaluate(async () => {
    const candidates = [
      document.querySelector('app-change'),
      document.querySelector('app-my-pdfs'),
      document.querySelector('app-my-epubs'),
      document.querySelector('app-root'),
    ].filter(Boolean);

    for (const appEl of candidates) {
      const ngApi = window.ng;
      const component = ngApi?.getComponent?.(appEl);
      const tour = component?.homeTour;
      if (!tour) {
        continue;
      }

      if (tour.isActive?.()) {
        await tour.skip?.();
      }
    }
  });
}

function resolveLocales(argv, supportedLocales, localeEnv) {
  const rawArg = argv.find((arg) => arg.startsWith('--locales='));
  const rawEnv = process.env[localeEnv];
  const raw = rawEnv ?? (rawArg ? rawArg.slice('--locales='.length) : '');

  if (!raw) {
    return [...supportedLocales];
  }

  const requested = raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const normalized = [...new Set(
    requested.filter((locale) => supportedLocales.includes(locale)),
  )];
  if (normalized.length > 0) {
    return normalized;
  }

  throw new Error(
    `No valid locales in "${raw}". Supported: ${supportedLocales.join(', ')}`,
  );
}

function resolveAppId(argv) {
  const rawArg = argv.find((arg) => arg.startsWith('--app='));
  if (!rawArg) {
    return getSupportedAppIds()[0];
  }

  return rawArg.slice('--app='.length).trim();
}

function resolveBaseUrl(app) {
  return process.env[app.baseUrlEnv] ?? app.baseUrlDefault;
}

function resolveRoot(relativePath) {
  return path.resolve(__dirname, '../../', relativePath);
}

module.exports = {
  runScreenshotCli,
  runScreenshotCapture,
  createFixtures,
  resolveLocales,
  resolveBaseUrl,
};

if (require.main === module) {
  runScreenshotCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
