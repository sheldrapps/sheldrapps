import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sheldrapps.covercreatorforkindle',
  appName: 'Cover Creator for Kindle',
  webDir: 'www',
  android: {
    resolveServiceWorkerRequests: false,
  },
};

export default config;
