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
  it('should create the app', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: SettingsStore,
          useValue: {
            get: () => ({ language: 'en-US' }),
            set: jasmine.createSpy('set').and.resolveTo({ language: 'en-US' }),
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
            set: jasmine.createSpy('set').and.resolveTo(),
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
            setTitle: jasmine.createSpy('setTitle'),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
