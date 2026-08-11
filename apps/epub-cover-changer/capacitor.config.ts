import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sheldrapps.epubcoverchanger',
  appName: 'EPUB Cover Changer',
  webDir: 'www',
  android: {
    resolveServiceWorkerRequests: false,
  },
};

export default config;

