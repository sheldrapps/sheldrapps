import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let onLangChange: Subject<unknown>;
  let titleSetSpy: jasmine.Spy;
  let translateInstantSpy: jasmine.Spy;

  beforeEach(() => {
    onLangChange = new Subject<unknown>();
    titleSetSpy = jasmine.createSpy('setTitle');
    translateInstantSpy = jasmine
      .createSpy('instant')
      .and.returnValue('EPUB Merger & Splitter');
  });

  async function createComponent(): Promise<AppComponent> {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: TranslateService,
          useValue: {
            instant: translateInstantSpy,
            onLangChange,
          },
        },
        {
          provide: Title,
          useValue: {
            setTitle: titleSetSpy,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('updates the document title on startup and language changes', async () => {
    const component = await createComponent();

    expect(component).toBeTruthy();
    expect(titleSetSpy).toHaveBeenCalledWith('EPUB Merger & Splitter');

    translateInstantSpy.and.returnValue('Combinador EPUB');
    onLangChange.next({});

    expect(titleSetSpy).toHaveBeenCalledWith('Combinador EPUB');
  });
});
