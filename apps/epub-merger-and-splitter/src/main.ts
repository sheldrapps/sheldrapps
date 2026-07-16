async function bootstrap(): Promise<void> {
  const { bootstrapEpubMergerAndSplitterApp } = await import('./bootstrap');

  await bootstrapEpubMergerAndSplitterApp();
}

void bootstrap().catch((error) => {
  console.error('[epub-merger-and-splitter] bootstrap failed', error);
});

export {};
