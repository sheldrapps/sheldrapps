import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sheldrapps.epubmergersplitter',
  appName: 'EPUB Merger & Splitter',
  webDir: 'www',
  plugins: {
    StatusBar: {
      overlaysWebView: false,
    },
  },
};

export default config;
