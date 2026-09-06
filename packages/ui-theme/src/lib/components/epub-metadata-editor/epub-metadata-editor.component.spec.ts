import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EpubMetadataEditorComponent } from './epub-metadata-editor.component';
import type {
  EpubMetadataEditorInput,
  EpubMetadataFormValue,
} from './epub-metadata-editor.types';

describe('EpubMetadataEditorComponent', () => {
  let component: EpubMetadataEditorComponent;
  let fixture: ComponentFixture<EpubMetadataEditorComponent>;

  const emptyMetadata = (): EpubMetadataFormValue => ({
    title: '',
    creators: [],
    language: '',
    identifier: { value: '' },
    subjects: [],
    contributors: [],
  });

  const inputFor = (
    version: EpubMetadataEditorInput['version'] = 'epub2',
    metadata = emptyMetadata(),
  ): EpubMetadataEditorInput => ({
    version,
    detectedVersion: version === 'epub2' ? '2.0' : '3.2',
    fileName: 'book.epub',
    metadata,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EpubMetadataEditorComponent, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(EpubMetadataEditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('editorInput', inputFor());
    TestBed.inject(TranslateService).use('en-US');
    fixture.detectChanges();
  });

  it('loads existing metadata without mutating the input object', () => {
    const metadata = {
      ...emptyMetadata(),
      title: '  My book  ',
      creators: [{ name: 'Author', role: 'aut', fileAs: 'Author' }],
      language: 'es-MX',
      identifier: { value: 'urn:uuid:one', scheme: 'UUID' },
      subjects: ['Fiction'],
      contributors: [{ name: 'Editor' }],
    };
    const original = structuredClone(metadata);

    fixture.componentRef.setInput('editorInput', inputFor('epub2', metadata));
    fixture.detectChanges();

    expect(component.metadataForm.controls.title.value).toBe('  My book  ');
    expect(component.creators.length).toBe(1);
    expect(component.subjects.length).toBe(1);
    expect(component.contributors.length).toBe(1);
    expect(metadata).toEqual(original);
  });

  it('starts with one visible creator row and optional metadata fields', () => {
    expect(component.creators.length).toBe(1);
    expect(component.metadataForm.valid).toBeTrue();
  });

  it('validates language format without requiring title or identifier', () => {
    component.metadataForm.controls.title.setValue('   ');
    component.metadataForm.controls.language.setValue('es_MX');
    component.identifier.controls.value.setValue('   ');
    component.metadataForm.markAllAsTouched();

    expect(component.metadataForm.controls.title.valid).toBeTrue();
    expect(component.metadataForm.controls.language.hasError('languageTag')).toBeTrue();
    expect(component.identifier.controls.value.valid).toBeTrue();
  });


  it('emits empty metadata without requiring placeholder values', () => {
    let emitted: EpubMetadataFormValue | undefined;
    component.save.subscribe((value) => (emitted = value));

    component.saveMetadata();

    expect(emitted).toEqual({
      title: '',
      creators: [],
      language: '',
      identifier: { value: '', scheme: undefined },
      subjects: [],
      contributors: [],
      publisher: undefined,
      date: undefined,
      description: undefined,
      type: undefined,
      format: undefined,
      source: undefined,
      relation: undefined,
      coverage: undefined,
      rights: undefined,
    });
  });
  it('accepts language tags without imposing an identifier format', () => {
    component.metadataForm.controls.title.setValue('Book');
    component.metadataForm.controls.language.setValue('pt-BR');
    component.identifier.controls.value.setValue('custom-id-42');

    expect(component.metadataForm.controls.language.valid).toBeTrue();
    expect(component.identifier.controls.value.valid).toBeTrue();
  });

  it('adds and removes authors while retaining an empty initial row', () => {
    component.addCreator();
    expect(component.creators.length).toBe(2);

    component.removeCreator(1);
    expect(component.creators.length).toBe(1);

    component.creators.at(0).controls.name.setValue('Author');
    component.removeCreator(0);
    expect(component.creators.length).toBe(1);
    expect(component.creators.at(0).controls.name.value).toBe('');
  });

  it('requires a person name when role or sort metadata is present', () => {
    const creator = component.creators.at(0);
    creator.controls.role.setValue('aut');
    creator.updateValueAndValidity();

    expect(creator.hasError('personNameRequired')).toBeTrue();
  });

  it('adds and removes contributors and subjects', () => {
    component.addContributor();
    component.addSubject();
    expect(component.contributors.length).toBe(1);
    expect(component.subjects.length).toBe(1);

    component.removeContributor(0);
    component.removeSubject(0);
    expect(component.contributors.length).toBe(0);
    expect(component.subjects.length).toBe(0);
  });

  it('exposes EPUB 2 and EPUB 3 capabilities centrally', () => {
    expect(component.capabilities().identifierScheme).toBeTrue();
    expect(component.capabilities().modifiedDate).toBeFalse();

    fixture.componentRef.setInput('editorInput', inputFor('epub3'));
    fixture.detectChanges();

    expect(component.capabilities().identifierScheme).toBeFalse();
    expect(component.capabilities().epub3Refinements).toBeTrue();
    expect(component.capabilities().modifiedDate).toBeTrue();
  });

  it('updates capabilities without losing common fields when the family changes', () => {
    const metadata = {
      ...emptyMetadata(),
      title: 'Book',
      language: 'en',
      identifier: { value: 'id' },
    };
    fixture.componentRef.setInput('editorInput', inputFor('epub2', metadata));
    fixture.detectChanges();
    fixture.componentRef.setInput('editorInput', inputFor('epub3', metadata));
    fixture.detectChanges();

    expect(component.metadataForm.controls.title.value).toBe('Book');
    expect(component.metadataForm.controls.language.value).toBe('en');
    expect(component.identifier.controls.value.value).toBe('id');
  });

  it('emits a new normalized object and removes empty repeatable rows on save', () => {
    component.metadataForm.controls.title.setValue('  Book  ');
    component.metadataForm.controls.language.setValue(' es-MX ');
    component.identifier.controls.value.setValue('  custom-id  ');
    component.identifier.controls.scheme.setValue(' UUID ');
    component.creators.at(0).patchValue({ name: '  Author  ', role: ' aut ' });
    component.addCreator();
    component.addSubject();
    component.subjects.at(0).setValue('  Fiction  ');
    component.addContributor();

    let emitted: EpubMetadataFormValue | undefined;
    component.save.subscribe((value) => (emitted = value));
    component.saveMetadata();

    expect(emitted).toEqual({
      title: 'Book',
      creators: [{ name: 'Author', role: 'aut', fileAs: undefined }],
      language: 'es-MX',
      identifier: { value: 'custom-id', scheme: 'UUID' },
      subjects: ['Fiction'],
      contributors: [],
      publisher: undefined,
      date: undefined,
      description: undefined,
      type: undefined,
      format: undefined,
      source: undefined,
      relation: undefined,
      coverage: undefined,
      rights: undefined,
    });
    expect(emitted).not.toBe(component.metadataForm.getRawValue());
  });

  it('registers its own translations without unresolved keys', () => {
    const translate = TestBed.inject(TranslateService);
    expect(translate.instant('EPUB_METADATA.TITLE')).toBe('Title');
    expect(fixture.nativeElement.textContent).not.toContain('EPUB_METADATA.');
  });
});
