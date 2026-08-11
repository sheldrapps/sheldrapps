import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sheldrapps.pdfmergerandsplitter',
  appName: 'PDF Merger & Splitter',
  webDir: 'www',
  android: {
    resolveServiceWorkerRequests: false,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
    },
  },
};

export default config;
