import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import * as I18nKit from '@sheldrapps/i18n-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { ThemeService, type Theme } from '@sheldrapps/ui-theme';
import { SettingsPage } from './settings.page';
import { ConsentService } from 'src/app/services/consent.service';
import { LanguageService } from 'src/app/services/language.service';
import { TourService } from 'src/app/shared/tour/tour.service';

describe('SettingsPage', () => {
  let component: SettingsPage;
  let fixture: ComponentFixture<SettingsPage>;
  let settingsSetSpy: jasmine.Spy;
  let languageSetSpy: jasmine.Spy;
  let languageService: { lang: string; set: jasmine.Spy };
  let restartForLanguageChangeSpy: jasmine.Spy;
  let themeService: {
    currentTheme: Theme;
    setTheme: jasmine.Spy<(theme: Theme) => Promise<void>>;
  };

  beforeEach(async () => {
    settingsSetSpy = jasmine.createSpy('set').and.resolveTo({});
    languageSetSpy = jasmine.createSpy('set').and.resolveTo();
    languageService = {
      lang: 'en-US',
      set: languageSetSpy,
    };

    themeService = {
      currentTheme: 'system',
      setTheme: jasmine.createSpy('setTheme').and.resolveTo(),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsPage, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: SettingsStore,
          useValue: {
            get: () => ({}),
            set: settingsSetSpy,
            setForScope: settingsSetSpy,
            load: jasmine.createSpy('load').and.resolveTo({ preferences: {} }),
          },
        },
        {
          provide: LanguageService,
          useValue: languageService,
        },
        {
          provide: ConsentService,
          useValue: {
            state: { umpReady: false, privacyOptionsRequired: false },
            showPrivacyOptionsIfAvailable: jasmine
              .createSpy('showPrivacyOptionsIfAvailable')
              .and.resolveTo(false),
          },
        },
        { provide: ThemeService, useValue: themeService },
        {
          provide: TourService,
          useValue: {
            requestManualStart: jasmine.createSpy('requestManualStart'),
          },
        },
      ],
    }).compileComponents();

    restartForLanguageChangeSpy = spyOn(
      I18nKit,
      'restartForLanguageChange',
    ).and.resolveTo();

    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render', () => {
    expect(component).toBeTruthy();
  });

  it('exposes the full shared theme catalog', () => {
    expect(component.supportedThemes.map((option) => option.code)).toEqual([
      'system',
      'light',
      'dark',
      'warm-reading',
      'pop-rose',
      'nocturne-violet',
      'obsidian-red',
      'terminal-green',
      'mint-fresh',
      'silver-tech',
      'gold-luxe',
    ]);
  });

  it('delegates theme changes to the shared theme service', async () => {
    await component.onThemeChange('dark');

    expect(themeService.setTheme).toHaveBeenCalledWith('dark');
  });

  it('counts down completely before triggering restart for language change', async () => {
    const events: string[] = [];

    settingsSetSpy.and.callFake(async () => {
      events.push('settings:set');
    });

    languageSetSpy.and.callFake(async () => {
      events.push('language:set');
      languageService.lang = 'es-MX';
    });

    restartForLanguageChangeSpy.and.callFake(async () => {
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
    expect(restartForLanguageChangeSpy).toHaveBeenCalledOnceWith('es-MX', 500);
    expect(component.isLanguageRestartLoading).toBeFalse();
  });

  it('does not trigger restart when selecting current language', async () => {
    await component.onLangChange('en-US');

    expect(settingsSetSpy).not.toHaveBeenCalled();
    expect(languageSetSpy).not.toHaveBeenCalled();
    expect(restartForLanguageChangeSpy).not.toHaveBeenCalled();
  });
});
