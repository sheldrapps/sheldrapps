import { TestBed } from '@angular/core/testing';

import { EReaderPreviewFrameComponent } from '@sheldrapps/image-workflow';

describe('EReaderPreviewFrameComponent', () => {
  const previewSrc = 'data:image/png;base64,AAA';
  const beforeSrc = 'data:image/png;base64,BBB';
  const afterSrc = 'data:image/png;base64,CCC';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EReaderPreviewFrameComponent],
    }).compileComponents();
  });

  it('renders the frame when frameEnabled is not false', () => {
    const fixture = TestBed.createComponent(EReaderPreviewFrameComponent);
    fixture.componentRef.setInput('imageSrc', previewSrc);
    fixture.detectChanges();

    const frame = fixture.nativeElement.querySelector('.ereader-preview__frame');
    expect(frame).withContext('expected SVG overlay frame').not.toBeNull();
    expect(frame.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not render an image when imageSrc is empty', () => {
    const fixture = TestBed.createComponent(EReaderPreviewFrameComponent);
    fixture.componentRef.setInput('imageSrc', '');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.ereader-preview__cover'),
    ).toBeNull();
  });

  it('applies the contain fit class', () => {
    const fixture = TestBed.createComponent(EReaderPreviewFrameComponent);
    fixture.componentRef.setInput('imageSrc', previewSrc);
    fixture.componentRef.setInput('fit', 'contain');
    fixture.detectChanges();

    const cover = fixture.nativeElement.querySelector('.ereader-preview__cover');
    expect(cover.classList.contains('ereader-preview__cover--contain')).toBeTrue();
  });

  it('applies the cover fit class', () => {
    const fixture = TestBed.createComponent(EReaderPreviewFrameComponent);
    fixture.componentRef.setInput('imageSrc', previewSrc);
    fixture.componentRef.setInput('fit', 'cover');
    fixture.detectChanges();

    const cover = fixture.nativeElement.querySelector('.ereader-preview__cover');
    expect(cover.classList.contains('ereader-preview__cover--cover')).toBeTrue();
  });

  it('applies the dithered class when isDithered is true', () => {
    const fixture = TestBed.createComponent(EReaderPreviewFrameComponent);
    fixture.componentRef.setInput('imageSrc', previewSrc);
    fixture.componentRef.setInput('renderMode', 'eReader');
    fixture.componentRef.setInput('isDithered', true);
    fixture.detectChanges();

    const cover = fixture.nativeElement.querySelector('.ereader-preview__cover');
    expect(cover.classList.contains('ereader-preview__cover--dithered')).toBeTrue();
  });

  it('renders before and after panels in compare mode', () => {
    const fixture = TestBed.createComponent(EReaderPreviewFrameComponent);
    fixture.componentRef.setInput('mode', 'compare');
    fixture.componentRef.setInput('beforeSrc', beforeSrc);
    fixture.componentRef.setInput('afterSrc', afterSrc);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('.ereader-preview__cover').length,
    ).toBe(2);
  });

  it('keeps rendering with only the after panel when beforeSrc is missing', () => {
    const fixture = TestBed.createComponent(EReaderPreviewFrameComponent);
    fixture.componentRef.setInput('mode', 'compare');
    fixture.componentRef.setInput('afterSrc', afterSrc);
    fixture.componentRef.setInput('afterLabel', 'New cover');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('.ereader-preview__cover').length,
    ).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('New cover');
  });

  it('renders visible labels when they are provided', () => {
    const fixture = TestBed.createComponent(EReaderPreviewFrameComponent);
    fixture.componentRef.setInput('imageSrc', previewSrc);
    fixture.componentRef.setInput('label', 'Preview');
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('.ereader-preview__label');
    expect(label).not.toBeNull();
    expect(label.textContent.trim()).toBe('Preview');
  });
});
