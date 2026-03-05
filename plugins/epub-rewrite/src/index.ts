import { registerPlugin } from '@capacitor/core';

import type { EpubRewritePlugin } from './definitions';

const EpubRewrite = registerPlugin<EpubRewritePlugin>('EpubRewritePlugin', {
  web: () => import('./web').then((mod) => new mod.EpubRewriteWeb()),
});

export * from './definitions';
export { EpubRewrite };
