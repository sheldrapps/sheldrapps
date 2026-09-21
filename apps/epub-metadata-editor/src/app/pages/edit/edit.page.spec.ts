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

  it('advances to the file step after selecting single-file mode', () => {
    const context = createContext();

    context.selectEditMode('single');

    expect(context.editMode).toBe('single');
    expect(context.workflowStep).toBe(1);
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
    expect(context.workflowStep).toBe(1);
    expect(context.canUseMultipleFiles).toBeTrue();
    expect(context.selectFiles).toHaveBeenCalledTimes(1);
  });

  it('opens the single-file input when selecting one EPUB on web', async () => {
    const singleInputClick = jasmine.createSpy('singleInputClick');
    const context = Object.assign(createContext(), {
      editMode: 'single',
      isSelectingFiles: false,
      selectionErrorKey: null,
      metadataWorkflow: { isNativeSupported: false },
      singleEpubInput: { nativeElement: { click: singleInputClick } },
      multipleEpubInput: { nativeElement: { click: jasmine.createSpy('multipleInputClick') } },
    }) as EditPage;

    await context.selectFiles();

    expect(singleInputClick).toHaveBeenCalledTimes(1);
  });

  it('opens the multiple-file input when selecting several EPUBs on web', async () => {
    const multipleInputClick = jasmine.createSpy('multipleInputClick');
    const context = Object.assign(createContext(true), {
      editMode: 'multiple',
      isSelectingFiles: false,
      selectionErrorKey: null,
      metadataWorkflow: { isNativeSupported: false },
      singleEpubInput: { nativeElement: { click: jasmine.createSpy('singleInputClick') } },
      multipleEpubInput: { nativeElement: { click: multipleInputClick } },
    }) as EditPage;

    await context.selectFiles();

    expect(multipleInputClick).toHaveBeenCalledTimes(1);
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
