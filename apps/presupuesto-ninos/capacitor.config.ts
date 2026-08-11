import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: "com.sheldrapps.presupuestoninos",
  appName: "Control presupuestal",
  webDir: "www",
  android: {
    resolveServiceWorkerRequests: false,
  },
};

export default config;
