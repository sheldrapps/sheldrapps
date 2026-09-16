import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sheldrapps.epubmetadataeditor',
  appName: 'EPUB Metadata Editor',
  webDir: 'www',
  android: {
    resolveServiceWorkerRequests: false,
  },
};

export default config;
