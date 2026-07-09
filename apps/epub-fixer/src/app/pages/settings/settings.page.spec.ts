import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { ThemeService, type Theme } from '@sheldrapps/ui-theme';
import { SettingsPage } from './settings.page';
import { LanguageService } from 'src/app/services/language.service';

describe('SettingsPage', () => {
  let component: SettingsPage;
  let fixture: ComponentFixture<SettingsPage>;
  let settingsSetForScopeSpy: jasmine.Spy;
  let languageSetSpy: jasmine.Spy;
  let languageService: { lang: string; set: jasmine.Spy };
  let restartForLocaleSpy: jasmine.Spy;
  let themeService: {
    currentTheme: Theme;
    setTheme: jasmine.Spy<(theme: Theme) => Promise<void>>;
  };

  beforeEach(async () => {
    settingsSetForScopeSpy = jasmine
      .createSpy('setForScope')
      .and.resolveTo({});
    languageSetSpy = jasmine.createSpy('set').and.resolveTo();
    languageService = {
      lang: 'en-US',
      set: languageSetSpy,
    };

    themeService = {
      currentTheme: 'system',
      setTheme: jasmine.createSpy('setTheme').and.resolveTo(),
    };
    restartForLocaleSpy = jasmine.createSpy('restartForLocale');
    (globalThis as typeof globalThis & {
      SheldrappsAppControl?: { restartForLocale: jasmine.Spy };
    }).SheldrappsAppControl = {
      restartForLocale: restartForLocaleSpy,
    };

    await TestBed.configureTestingModule({
      imports: [SettingsPage, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: SettingsStore,
          useValue: {
            get: () => ({}),
            set: jasmine.createSpy('set').and.resolveTo({}),
            setForScope: settingsSetForScopeSpy,
            load: jasmine.createSpy('load').and.resolveTo({ preferences: {} }),
          },
        },
        {
          provide: LanguageService,
          useValue: languageService,
        },
        { provide: ThemeService, useValue: themeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & {
      SheldrappsAppControl?: unknown;
    }).SheldrappsAppControl;
  });

  it('should render', () => {
    expect(component).toBeTruthy();
  });

  it('counts down completely before triggering restart for language change', async () => {
    const events: string[] = [];

    settingsSetForScopeSpy.and.callFake(async () => {
      events.push('settings:set');
    });

    languageSetSpy.and.callFake(async () => {
      events.push('language:set');
      languageService.lang = 'es-MX';
    });

    restartForLocaleSpy.and.callFake(() => {
      events.push('restart:signal');
    });

    spyOn<any>(component, 'waitForLoadingToRender').and.resolveTo();
    spyOn<any>(component, 'delay').and.callFake(async () => {
      events.push(`count:${component.languageRestartCountdown}`);
    });

    await component.onLangChange('es-MX');

    expect(events).toEqual([
      'settings:set',
      'language:set',
      'count:4',
      'count:3',
      'count:2',
      'count:1',
      'restart:signal',
    ]);
    expect(settingsSetForScopeSpy).toHaveBeenCalledOnceWith('language', {
      language: 'es-MX',
    });
    expect(restartForLocaleSpy).toHaveBeenCalledOnceWith('es-MX');
    expect(component.isLanguageRestartLoading).toBeFalse();
  });

  it('does not trigger restart when selecting current language', async () => {
    await component.onLangChange('en-US');

    expect(settingsSetForScopeSpy).not.toHaveBeenCalled();
    expect(languageSetSpy).not.toHaveBeenCalled();
    expect(restartForLocaleSpy).not.toHaveBeenCalled();
  });
});
