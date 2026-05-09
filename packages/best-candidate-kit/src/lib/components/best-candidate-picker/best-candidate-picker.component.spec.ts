import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BestCandidatePickerComponent } from './best-candidate-picker.component';

describe('BestCandidatePickerComponent', () => {
  let component: BestCandidatePickerComponent;
  let fixture: ComponentFixture<BestCandidatePickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BestCandidatePickerComponent, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(BestCandidatePickerComponent);
    component = fixture.componentInstance;
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en-US', {
      BEST_CANDIDATE: {
        PICKER: {
          TITLE: 'title',
          DESCRIPTION: 'desc',
          LONG_PRESS_HINT: 'hint',
          UNKNOWN_IMAGE: 'unknown',
          CANDIDATE_ALT: 'candidate {{index}}',
        },
        EMPTY: {
          TITLE: 'empty',
          DESCRIPTION: 'empty desc',
        },
        LOADING: { TITLE: 'loading' },
        REASON: {
          FIRST_LARGE_IMAGE: 'first',
          COVER_RATIO: 'ratio',
          NEAR_BOOK_START: 'start',
          FILENAME_COVER: 'filename',
          LARGE_RESOLUTION: 'large',
          METADATA_COVER: 'metadata',
          SMALL_ICON_RISK: 'icon',
          DECORATIVE_RISK: 'decorative',
        },
      },
    });
    translate.use('en-US');
  });

  it('renders empty state', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('empty');
  });

  it('emits selected candidate on pointer up', () => {
    const emitSpy = spyOn(component.candidateSelected, 'emit');
    component.candidates = [
      {
        image: { id: 'one', src: 'blob:one', width: 600, height: 900 },
        score: 100,
        reasons: ['cover-ratio'],
      },
    ];

    fixture.detectChanges();
    component.onCandidatePointerUp(component.candidates[0].image);

    expect(emitSpy).toHaveBeenCalledWith(component.candidates[0].image);
  });

  it('does not emit when disabled', () => {
    const emitSpy = spyOn(component.candidateSelected, 'emit');
    component.disabled = true;
    component.candidates = [
      {
        image: { id: 'one', src: 'blob:one', width: 600, height: 900 },
        score: 100,
        reasons: ['cover-ratio'],
      },
    ];

    fixture.detectChanges();
    component.onCandidatePointerUp(component.candidates[0].image);

    expect(emitSpy).not.toHaveBeenCalled();
  });
});
