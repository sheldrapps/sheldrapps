import { EpubFixerWebMockAdapter } from './epub-fixer-web-mock.adapter';

describe('EpubFixerWebMockAdapter', () => {
  it('returns the Android-shaped diagnosis preview and complete summary', async () => {
    const adapter = new EpubFixerWebMockAdapter();
    const prepared = await adapter.prepare({
      file: new File(['ui fixture'], 'ui-fixture.epub', {
        type: 'application/epub+zip',
      }),
    });

    const diagnosis = await adapter.diagnose({ sessionId: prepared.sessionId });

    expect(diagnosis.status).toBe('repairable');
    expect(diagnosis.issues.length).toBe(532);
    expect(diagnosis.summary?.totalFindings).toBe(532);
    expect(diagnosis.page?.total).toBe(532);
    expect(diagnosis.page?.nextCursor).toBe('50');
  });

  it('paginates the remaining findings without reading the EPUB', async () => {
    const adapter = new EpubFixerWebMockAdapter();
    const prepared = await adapter.prepare({
      file: new File(['not an epub'], 'anything.bin'),
    });
    const diagnosis = await adapter.diagnose({ sessionId: prepared.sessionId });

    const page = await adapter.getDiagnosisIssues({
      sessionId: 'stale-session-after-reload',
      diagnosisId: diagnosis.diagnosisId as string,
      cursor: diagnosis.page?.nextCursor,
      pageSize: 250,
    });

    expect(page.items.length).toBe(250);
    expect(page.total).toBe(532);
    expect(page.nextCursor).toBe('300');
  });
});
