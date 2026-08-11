import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sheldrapps.epubfixer',
  appName: 'EPUB Fixer',
  webDir: 'www',
  android: {
    resolveServiceWorkerRequests: false,
  },
};

export default config;
