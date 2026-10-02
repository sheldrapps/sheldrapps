import { EditPage } from './edit.page';

describe('EditPage', () => {
  function createContext(premium = false): EditPage {
    return Object.assign(Object.create(EditPage.prototype), {
      adsRemoved: () => premium,
      editMode: null,
      workflowStep: 0,
      selectFiles: jasmine.createSpy('selectFiles'),
    }) as EditPage;
  }

  it('opens single-file selection without advancing before a file is chosen', () => {
    const context = createContext();

    context.selectEditMode('single');

    expect(context.editMode).toBe('single');
    expect(context.workflowStep).toBe(0);
    expect(context.selectFiles).toHaveBeenCalledTimes(1);
  });

  it('keeps multiple-file mode locked without Pro', () => {
    const context = createContext();

    context.selectEditMode('multiple');

    expect(context.editMode).toBeNull();
    expect(context.workflowStep).toBe(0);
    expect(context.canUseMultipleFiles).toBeFalse();
  });

  it('allows multiple-file mode for Pro users', () => {
    const context = createContext(true);

    context.selectEditMode('multiple');

    expect(context.editMode).toBe('multiple');
    expect(context.workflowStep).toBe(0);
    expect(context.canUseMultipleFiles).toBeTrue();
    expect(context.selectFiles).toHaveBeenCalledTimes(1);
  });

  it('advances to the file step only after selection succeeds', async () => {
    const context = Object.assign(createContext(), {
      isSelectingFiles: false,
      selectionErrorKey: null,
    }) as EditPage;

    await (EditPage.prototype as any).runFileSelection.call(
      context,
      async () => undefined,
    );

    expect(context.workflowStep).toBe(1);
    expect(context.isSelectingFiles).toBeFalse();
  });

  it('reports a picker failure without hiding it on the mode step', async () => {
    const context = Object.assign(createContext(), {
      isSelectingFiles: false,
      selectionErrorKey: null,
    }) as EditPage;

    await (EditPage.prototype as any).runFileSelection.call(
      context,
      async () => {
        throw new Error('PICKER_UNAVAILABLE');
      },
    );

    expect(context.workflowStep).toBe(0);
    expect(context.selectionErrorKey).toBe('EDIT.SELECTION_ERROR');
    expect(context.isSelectingFiles).toBeFalse();
  });

  it('opens the native picker when selecting one EPUB', async () => {
    const startFromNativePicker = jasmine.createSpy('startFromNativePicker').and.resolveTo();
    const context = Object.assign(createContext(), {
      editMode: 'single',
      isSelectingFiles: false,
      selectionErrorKey: null,
      metadataWorkflow: { startFromNativePicker },
    }) as EditPage;

    await EditPage.prototype.selectFiles.call(context);

    expect(startFromNativePicker).toHaveBeenCalledOnceWith(false);
  });

  it('opens the native picker when selecting several EPUBs', async () => {
    const startFromNativePicker = jasmine.createSpy('startFromNativePicker').and.resolveTo();
    const context = Object.assign(createContext(true), {
      editMode: 'multiple',
      isSelectingFiles: false,
      selectionErrorKey: null,
      metadataWorkflow: { startFromNativePicker },
    }) as EditPage;

    await EditPage.prototype.selectFiles.call(context);

    expect(startFromNativePicker).toHaveBeenCalledOnceWith(true);
  });

  it('omits empty metadata fields from the completed summary', () => {
    const context = createContext();
    const rows = context.metadataSummaryRows({
      title: 'A title',
      creators: [{ name: 'An author' }],
      language: '',
      identifier: { value: '' },
      subjects: [],
      contributors: [],
      description: 'A description',
    });

    expect(rows.map((row) => row.labelKey)).toEqual([
      'EPUB_METADATA.TITLE',
      'EPUB_METADATA.DESCRIPTION',
      'EPUB_METADATA.AUTHORS',
    ]);
  });
});
