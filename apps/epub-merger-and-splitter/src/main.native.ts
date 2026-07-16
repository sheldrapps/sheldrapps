import { bootstrapEpubMergerAndSplitterApp } from './bootstrap';

void bootstrapEpubMergerAndSplitterApp().catch((error) => {
  console.error('[epub-merger-and-splitter] bootstrap failed', error);
});
