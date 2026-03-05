import test from "node:test";
import assert from "node:assert/strict";
import {
  createCurrentPackageResolver,
  filterRecommended,
  hasRecommendedApps,
  buildHomeHeaderItems,
  handleHomeHeaderAction,
  isValidApp,
  openRecommendedApp,
  resolveLocaleWithFallbackAsync,
  resolveLocaleWithFallback,
} from "../src/recommended-apps.runtime.js";

const CCFK = {
  appName: "Cover Creator for Kindle",
  packageName: "com.sheldrapps.covercreatorforkindle",
  icon: "assets/apps/ccfk/icon.png",
  playStoreUrl:
    "https://play.google.com/store/apps/details?id=com.sheldrapps.covercreatorforkindle",
  description: "Create Kindle-ready covers from your images.",
};

const ECC_INVALID_NO_URL = {
  appName: "EPUB Cover Changer",
  packageName: "com.sheldrapps.epubcoverchanger",
  icon: "assets/apps/ecc/icon.png",
  playStoreUrl: "",
  description: "Replace EPUB covers and export updated files.",
};

const ECC_VALID_WITH_URL = {
  ...ECC_INVALID_NO_URL,
  playStoreUrl:
    "https://play.google.com/store/apps/details?id=com.sheldrapps.epubcoverchanger",
};

test("service case A: currentPackage=CCFK and ECC has no URL => empty list and hasRecommended=false", async () => {
  const resolveCurrentPackage = createCurrentPackageResolver(async () => ({
    id: CCFK.packageName,
  }));

  const currentPackage = await resolveCurrentPackage();
  const registry = [CCFK, ECC_INVALID_NO_URL];
  const recommended = filterRecommended(registry, currentPackage);

  assert.deepEqual(recommended, []);
  assert.equal(hasRecommendedApps(registry, currentPackage), false);
});

test("service case B: currentPackage=ECC => list contains CCFK and hasRecommended=true", async () => {
  const resolveCurrentPackage = createCurrentPackageResolver(async () => ({
    id: "com.sheldrapps.epubcoverchanger",
  }));

  const currentPackage = await resolveCurrentPackage();
  const registry = [CCFK, ECC_INVALID_NO_URL];
  const recommended = filterRecommended(registry, currentPackage);

  assert.equal(recommended.length, 1);
  assert.equal(recommended[0].packageName, CCFK.packageName);
  assert.equal(hasRecommendedApps(registry, currentPackage), true);
});

test("service case C: app with any empty required field is always excluded", () => {
  const invalid = {
    ...CCFK,
    icon: "",
  };

  assert.equal(isValidApp(invalid), false);

  const recommended = filterRecommended(
    [CCFK, invalid],
    "com.sheldrapps.epubcoverchanger",
  );
  assert.equal(recommended.length, 1);
  assert.equal(recommended[0].packageName, CCFK.packageName);
});

test("service case D: when ECC has URL and currentPackage=CCFK => list contains ECC", () => {
  const registry = [CCFK, ECC_VALID_WITH_URL];
  const recommended = filterRecommended(registry, CCFK.packageName);

  assert.equal(recommended.length, 1);
  assert.equal(recommended[0].packageName, ECC_VALID_WITH_URL.packageName);
  assert.equal(hasRecommendedApps(registry, CCFK.packageName), true);
});

test("service package resolver caches getInfo result in memory", async () => {
  let calls = 0;
  const resolveCurrentPackage = createCurrentPackageResolver(async () => {
    calls += 1;
    return { id: CCFK.packageName };
  });

  const first = await resolveCurrentPackage();
  const second = await resolveCurrentPackage();

  assert.equal(first, CCFK.packageName);
  assert.equal(second, CCFK.packageName);
  assert.equal(calls, 1);
});

test("home header: 0 recommended => no recommended item", () => {
  const items = buildHomeHeaderItems(false);
  assert.equal(items.some((item) => item.id === "recommended"), false);
  assert.equal(items.some((item) => item.id === "guide"), true);
});

test("home header: >=1 recommended => has recommended item and handler navigates", async () => {
  const items = buildHomeHeaderItems(true);
  assert.equal(items.some((item) => item.id === "recommended"), true);
  assert.equal(items.some((item) => item.id === "guide"), true);

  let navigated = false;
  let toggled = false;
  let closed = false;

  await handleHomeHeaderAction("recommended", {
    closeInfo: () => {
      closed = true;
    },
    toggleInfo: () => {
      toggled = true;
    },
    navigateToRecommended: async () => {
      navigated = true;
    },
  });

  assert.equal(navigated, true);
  assert.equal(closed, true);
  assert.equal(toggled, false);
});

test("home header: guide action toggles info panel", async () => {
  let toggled = false;

  await handleHomeHeaderAction("guide", {
    closeInfo: () => {},
    toggleInfo: () => {
      toggled = true;
    },
    navigateToRecommended: async () => {},
  });

  assert.equal(toggled, true);
});

test("home header: supports translated labels from host", () => {
  const items = buildHomeHeaderItems(true, {
    appsLabel: "Apps",
    guideLabel: "Guia",
  });

  const appsItem = items.find((item) => item.id === "recommended");
  const guideItem = items.find((item) => item.id === "guide");

  assert.equal(appsItem?.label, "Apps");
  assert.equal(guideItem?.label, "Guia");
});

test("landing click: click item calls openUrl callback", async () => {
  const calls = [];
  await openRecommendedApp(CCFK.playStoreUrl, async (url) => {
    calls.push(url);
  });
  assert.deepEqual(calls, [CCFK.playStoreUrl]);
});

test("i18n fallback: unsupported locale falls back to en-US", () => {
  const locale = resolveLocaleWithFallback(
    ["es-MX", "en-US", "de-DE", "fr-FR", "it-IT", "pt-BR"],
    "ja-JP",
    "en-US",
  );

  assert.equal(locale, "en-US");
});

test("i18n runtime locale: uses document lang when available", async () => {
  const previousDocument = globalThis.document;

  globalThis.document = { documentElement: { lang: "es-MX" } };

  try {
    const locale = await resolveLocaleWithFallbackAsync(
      ["es-MX", "en-US", "de-DE", "fr-FR", "it-IT", "pt-BR"],
      undefined,
      "en-US",
    );

    assert.equal(locale, "es-MX");
  } finally {
    globalThis.document = previousDocument;
  }
});
