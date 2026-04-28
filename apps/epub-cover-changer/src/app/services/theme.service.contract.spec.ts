import { TestBed } from '@angular/core/testing';
import { SettingsStore } from '@sheldrapps/settings-kit';
import {
  EdgeToEdgeService,
  THEME_CLASS_NAMES,
  ThemeService,
  type AppThemeMode,
} from '@sheldrapps/ui-theme';

type ThemeSettings = {
  theme?: AppThemeMode;
};

type MatchMediaStub = MediaQueryList & {
  dispatch(matches: boolean): void;
};

describe('ThemeService contract', () => {
  let service: ThemeService;
  let root: HTMLElement;
  let settingsStore: jasmine.SpyObj<Pick<SettingsStore<ThemeSettings>, 'get' | 'load' | 'set'>>;
  let edgeToEdge: jasmine.SpyObj<Pick<EdgeToEdgeService, 'setSystemBarAppearance'>>;
  let mediaQuery: MatchMediaStub;

  beforeEach(() => {
    root = document.documentElement;
    resetRootThemeState(root);

    settingsStore = jasmine.createSpyObj<Pick<SettingsStore<ThemeSettings>, 'get' | 'load' | 'set'>>(
      'SettingsStore',
      ['get', 'load', 'set']
    );
    settingsStore.load.and.resolveTo({ theme: 'system' });
    settingsStore.get.and.returnValue({ theme: 'system' });
    settingsStore.set.and.resolveTo({ theme: 'system' });

    edgeToEdge = jasmine.createSpyObj<Pick<EdgeToEdgeService, 'setSystemBarAppearance'>>(
      'EdgeToEdgeService',
      ['setSystemBarAppearance']
    );
    edgeToEdge.setSystemBarAppearance.and.resolveTo();

    mediaQuery = createMatchMediaStub(false);
    spyOn(window, 'matchMedia').and.returnValue(mediaQuery);

    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: SettingsStore, useValue: settingsStore },
        { provide: EdgeToEdgeService, useValue: edgeToEdge },
      ],
    });

    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    resetRootThemeState(root);
  });

  it('uses the same dark class for forced dark as for system dark', async () => {
    settingsStore.get.and.returnValue({ theme: 'dark' });
    settingsStore.set.and.resolveTo({ theme: 'dark' });

    await service.initialize();

    expect(root.classList.contains('theme-dark')).toBeTrue();
    expect(root.classList.contains('theme-light')).toBeFalse();
    expect(root.classList.contains('app-theme-dark')).toBeFalse();
    expect(root.classList.contains('ion-palette-dark')).toBeFalse();
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.getAttribute('data-resolved-theme')).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    expect(edgeToEdge.setSystemBarAppearance).toHaveBeenCalledWith({
      statusBarIcons: 'light',
      navBarIcons: 'light',
    });
  });

  it('resolves system dark to the same dark class without inventing a third theme', async () => {
    mediaQuery = createMatchMediaStub(true);
    (window.matchMedia as jasmine.Spy).and.returnValue(mediaQuery);
    settingsStore.get.and.returnValue({ theme: 'system' });

    await service.initialize();

    expect(root.classList.contains('theme-dark')).toBeTrue();
    expect(root.classList.contains('theme-light')).toBeFalse();
    expect(root.classList.contains('app-theme-dark')).toBeFalse();
    expect(root.classList.contains('ion-palette-dark')).toBeFalse();
    expect(root.getAttribute('data-theme')).toBe('system');
    expect(root.getAttribute('data-resolved-theme')).toBe('dark');
  });

  it('ignores system theme changes while a forced theme is active', async () => {
    settingsStore.get.and.returnValue({ theme: 'system' });

    await service.initialize();
    await service.setTheme('light');
    mediaQuery.dispatch(true);

    expect(root.classList.contains('theme-light')).toBeTrue();
    expect(root.classList.contains('theme-dark')).toBeFalse();
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.getAttribute('data-resolved-theme')).toBe('light');
  });

  it('applies warm-reading as its own light palette without falling back to theme-light', async () => {
    settingsStore.get.and.returnValue({ theme: 'warm-reading' });
    settingsStore.set.and.resolveTo({ theme: 'warm-reading' });

    await service.initialize();

    expect(root.classList.contains('theme-warm-reading')).toBeTrue();
    expect(root.classList.contains('theme-dark')).toBeFalse();
    expect(root.classList.contains('theme-light')).toBeFalse();
    expect(root.getAttribute('data-theme')).toBe('warm-reading');
    expect(root.getAttribute('data-resolved-theme')).toBe('warm-reading');
    expect(root.getAttribute('data-resolved-appearance')).toBe('light');
    expect(root.style.colorScheme).toBe('light');
    expect(edgeToEdge.setSystemBarAppearance).toHaveBeenCalledWith({
      statusBarIcons: 'dark',
      navBarIcons: 'dark',
    });
  });

  it('applies pop-rose as its own light palette without falling back to theme-light', async () => {
    settingsStore.get.and.returnValue({ theme: 'pop-rose' });
    settingsStore.set.and.resolveTo({ theme: 'pop-rose' });

    await service.initialize();

    expect(root.classList.contains('theme-pop-rose')).toBeTrue();
    expect(root.classList.contains('theme-dark')).toBeFalse();
    expect(root.classList.contains('theme-light')).toBeFalse();
    expect(root.getAttribute('data-theme')).toBe('pop-rose');
    expect(root.getAttribute('data-resolved-theme')).toBe('pop-rose');
    expect(root.getAttribute('data-resolved-appearance')).toBe('light');
    expect(root.style.colorScheme).toBe('light');
    expect(edgeToEdge.setSystemBarAppearance).toHaveBeenCalledWith({
      statusBarIcons: 'dark',
      navBarIcons: 'dark',
    });
  });
});

function resetRootThemeState(root: HTMLElement): void {
  root.classList.remove(
    ...THEME_CLASS_NAMES,
    'app-theme-light',
    'app-theme-dark',
    'ion-palette-dark'
  );
  root.style.removeProperty('color-scheme');
  root.removeAttribute('data-theme');
  root.removeAttribute('data-resolved-theme');
  root.removeAttribute('data-resolved-appearance');
  root.removeAttribute('data-status-bar-icons');
  root.removeAttribute('data-nav-bar-icons');
}

function createMatchMediaStub(matches: boolean): MatchMediaStub {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let currentMatches = matches;

  return {
    get matches() {
      return currentMatches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
    dispatch(nextMatches: boolean) {
      currentMatches = nextMatches;
      const event = { matches: nextMatches, media: this.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  } as MatchMediaStub;
}
