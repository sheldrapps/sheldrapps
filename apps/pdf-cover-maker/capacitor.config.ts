import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sheldrapps.pdfcovermaker',
  appName: 'PDF Cover Maker',
  webDir: 'www',
  android: {
    resolveServiceWorkerRequests: false,
  },
};

export default config;

