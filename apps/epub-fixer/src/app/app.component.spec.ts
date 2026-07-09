import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@sheldrapps/i18n-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { EdgeToEdgeService, ThemeService } from '@sheldrapps/ui-theme';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let settingsState: { language?: string };
  let settingsSetForScopeSpy: jasmine.Spy;
  let languageSetSpy: jasmine.Spy;
  let titleSetSpy: jasmine.Spy;

  beforeEach(() => {
    settingsState = {};
    settingsSetForScopeSpy = jasmine
      .createSpy('setForScope')
      .and.resolveTo({});
    languageSetSpy = jasmine.createSpy('set').and.resolveTo();
    titleSetSpy = jasmine.createSpy('setTitle');
  });

  it('persists the detected language through the language scope on first launch', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: SettingsStore,
          useValue: {
            get: () => settingsState,
            set: jasmine.createSpy('set').and.resolveTo({}),
            setForScope: settingsSetForScopeSpy,
          },
        },
        {
          provide: EdgeToEdgeService,
          useValue: {
            initEdgeToEdge: jasmine.createSpy('initEdgeToEdge').and.resolveTo(),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            initialize: jasmine.createSpy('initialize').and.resolveTo(),
          },
        },
        {
          provide: LanguageService,
          useValue: {
            set: languageSetSpy,
          },
        },
        {
          provide: TranslateService,
          useValue: {
            setDefaultLang: jasmine.createSpy('setDefaultLang'),
            instant: jasmine.createSpy('instant').and.returnValue('EPUB Fixer'),
            onLangChange: new Subject<unknown>(),
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
    await new Promise((resolve) => setTimeout(resolve, 50));
    await fixture.whenStable();

    expect(settingsSetForScopeSpy).toHaveBeenCalledOnceWith('language', {
      language: jasmine.any(String),
    });
    expect(languageSetSpy).toHaveBeenCalledOnceWith(jasmine.any(String));
    expect(titleSetSpy).toHaveBeenCalledWith('EPUB Fixer');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('does not rewrite language when it is already stored', async () => {
    settingsState = { language: 'en-US' };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: SettingsStore,
          useValue: {
            get: () => settingsState,
            set: jasmine.createSpy('set').and.resolveTo({}),
            setForScope: settingsSetForScopeSpy,
          },
        },
        {
          provide: EdgeToEdgeService,
          useValue: {
            initEdgeToEdge: jasmine.createSpy('initEdgeToEdge').and.resolveTo(),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            initialize: jasmine.createSpy('initialize').and.resolveTo(),
          },
        },
        {
          provide: LanguageService,
          useValue: {
            set: languageSetSpy,
          },
        },
        {
          provide: TranslateService,
          useValue: {
            setDefaultLang: jasmine.createSpy('setDefaultLang'),
            instant: jasmine.createSpy('instant').and.returnValue('EPUB Fixer'),
            onLangChange: new Subject<unknown>(),
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

    expect(settingsSetForScopeSpy).not.toHaveBeenCalled();
    expect(languageSetSpy).toHaveBeenCalledOnceWith('en-US');
    expect(fixture.componentInstance).toBeTruthy();
  });
});
