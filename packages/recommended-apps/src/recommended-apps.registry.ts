import { RecommendedApp } from './types';

export const RECOMMENDED_APPS_REGISTRY: RecommendedApp[] = [
  {
    appName: "E-Reader Cover Creator",
    packageName: "com.sheldrapps.covercreatorforkindle",
    icon: "assets/apps/ccfk/icon.png",
    playStoreUrl:
      "https://play.google.com/store/apps/details?id=com.sheldrapps.covercreatorforkindle",
    description: "Create e-reader covers from your images in just a few taps.",
  },
  {
    appName: "EPUB Cover Changer",
    packageName: "com.sheldrapps.epubcoverchanger",
    icon: "assets/apps/ecc/icon.png",
    playStoreUrl:
      "https://play.google.com/store/apps/details?id=com.sheldrapps.epubcoverchanger",
    description: "Replace EPUB covers and export updated files.",
  },
];
