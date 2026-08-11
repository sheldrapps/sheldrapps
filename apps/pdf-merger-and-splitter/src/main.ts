async function bootstrap(): Promise<void> {
  const { bootstrapPdfMergerAndSplitterApp } = await import('./bootstrap');

  await bootstrapPdfMergerAndSplitterApp();
}

void bootstrap().catch((error) => {
  console.error('[pdf-merger-and-splitter] bootstrap failed', error);
});

export {};
