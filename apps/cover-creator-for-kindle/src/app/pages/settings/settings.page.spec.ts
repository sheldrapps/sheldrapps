import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { ThemeService, type Theme } from '@sheldrapps/ui-theme';
import { SettingsPage } from './settings.page';
import { ConsentService } from 'src/app/services/consent.service';
import { LanguageService } from 'src/app/services/language.service';
import { TourService } from 'src/app/shared/tour/tour.service';

describe('SettingsPage', () => {
  let component: SettingsPage;
  let fixture: ComponentFixture<SettingsPage>;
  let themeService: {
    currentTheme: Theme;
    setTheme: jasmine.Spy<(theme: Theme) => Promise<void>>;
  };

  beforeEach(async () => {
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
            set: jasmine.createSpy('set').and.resolveTo({}),
          },
        },
        {
          provide: LanguageService,
          useValue: {
            lang: 'en-US',
            set: jasmine.createSpy('set').and.resolveTo(),
          },
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

    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
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
});
