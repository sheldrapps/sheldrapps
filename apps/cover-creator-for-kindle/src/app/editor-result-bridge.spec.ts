import { applyEditorResultBeforeExit } from '@sheldrapps/image-workflow/editor';

describe('editor Done result contract', () => {
  it('applies the rendered result before persisting it', async () => {
    const order: string[] = [];
    const result = {
      file: new File(['cover'], 'cover.png', { type: 'image/png' }),
      renderedBlob: new Blob(['rendered'], { type: 'image/png' }),
    };

    await applyEditorResultBeforeExit(
      result,
      async () => {
        await Promise.resolve();
        order.push('preview-applied');
      },
      async () => {
        order.push('persisted');
      },
    );

    expect(order).toEqual(['preview-applied', 'persisted']);
  });

  it('still persists when there is no host callback', async () => {
    const persist = jasmine.createSpy('persist').and.resolveTo(undefined);
    const result = {
      file: new File(['cover'], 'cover.png', { type: 'image/png' }),
    };

    await applyEditorResultBeforeExit(result, undefined, persist);

    expect(persist).toHaveBeenCalledWith(result);
  });
});
