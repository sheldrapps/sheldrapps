import { RecommendedApp } from './types';

export const RECOMMENDED_APPS_REGISTRY: RecommendedApp[] = [
  {
    appName: "E-Reader Cover Creator",
    packageName: "com.sheldrapps.covercreatorforkindle",
    icon: "assets/apps/ccfk/icon.png",
    playStoreUrl:
      "https://play.google.com/store/apps/details?id=com.sheldrapps.covercreatorforkindle",
    description: "Create e-reader covers from your images in just a few taps.",
    category: 'EPUB',
  },
  {
    appName: "EPUB Cover Changer",
    packageName: "com.sheldrapps.epubcoverchanger",
    icon: "assets/apps/ecc/icon.png",
    playStoreUrl:
      "https://play.google.com/store/apps/details?id=com.sheldrapps.epubcoverchanger",
    description: "Replace EPUB covers and export updated files.",
    category: 'EPUB',
  },
  {
    appName: "EPUB Fixer",
    packageName: "com.sheldrapps.epubfixer",
    icon: "assets/apps/epub-fixer/icon.png",
    playStoreUrl:
      "https://play.google.com/store/apps/details?id=com.sheldrapps.epubfixer",
    description: "Diagnose and repair common EPUB file issues.",
    category: 'EPUB',
  },
  {
    appName: "PDF Cover Maker",
    packageName: "com.sheldrapps.pdfcovermaker",
    icon: "assets/apps/pcm/icon.png",
    playStoreUrl:
      "https://play.google.com/store/apps/details?id=com.sheldrapps.pdfcovermaker",
    description: "Replace PDF covers and export updated files.",
    category: 'PDF',
  },
];
