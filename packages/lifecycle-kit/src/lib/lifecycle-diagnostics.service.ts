import { Injectable, InjectionToken, inject } from '@angular/core';
import { App } from '@capacitor/app';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { Subscription } from 'rxjs';

type PluginListenerHandle = { remove(): Promise<void> };

export type LifecycleDiagnosticsConfig = {
  appId: string;
  enabled?: boolean;
};

export const LIFECYCLE_DIAGNOSTICS_CONFIG = new InjectionToken<LifecycleDiagnosticsConfig>(
  'LIFECYCLE_DIAGNOSTICS_CONFIG',
);

type RuntimeBridge = {
  getLifecycleSessionId?: () => string;
  getLifecycleInstanceId?: () => string;
};

declare global {
  interface Window {
    SheldrappsRuntime?: RuntimeBridge;
  }
}

@Injectable({ providedIn: 'root' })
export class LifecycleDiagnosticsService {
  private readonly router = inject(Router);
  private readonly config = inject(LIFECYCLE_DIAGNOSTICS_CONFIG);
  private readonly jsSessionId = this.newId('session');
  private readonly jsInstanceId = this.newId('instance');
  private routerSub?: Subscription;
  private nativeListeners: PluginListenerHandle[] = [];
  private readonly inactiveCallbacks = new Set<() => void>();
  private started = false;

  start(): void {
    if (this.started) {
      this.log('duplicate-start-ignored');
      return;
    }
    this.started = true;
    if (this.config.enabled === false) return;

    this.log('Angular.bootstrap');
    this.routerSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.log('Angular.NavigationStart', { url: event.url });
      } else if (event instanceof NavigationEnd) {
        this.log('Angular.NavigationEnd', {
          url: event.url,
          urlAfterRedirects: event.urlAfterRedirects,
        });
      } else if (event instanceof NavigationCancel) {
        this.log('Angular.NavigationCancel', {
          url: event.url,
          reason: event.reason,
        });
      } else if (event instanceof NavigationError) {
        this.log('Angular.NavigationError', {
          url: event.url,
          error: String(event.error),
        });
      }
    });

    void Promise.all([
      App.addListener('appStateChange', (state) =>
        this.handleAppStateChange(state.isActive),
      ),
      App.addListener('pause', () => {
        this.log('Capacitor.pause');
        this.notifyInactive();
      }),
      App.addListener('resume', () => this.log('Capacitor.resume')),
    ])
      .then((handles) => this.nativeListeners.push(...handles))
      .catch((error) => {
        this.log('Capacitor.listener-failed', { error: String(error) });
      });
  }

  onInactive(callback: () => void): () => void {
    this.inactiveCallbacks.add(callback);
    return () => this.inactiveCallbacks.delete(callback);
  }

  log(event: string, details?: Record<string, unknown>): void {
    if (this.config.enabled === false) return;
    const payload = {
      session: this.nativeValue('getLifecycleSessionId') ?? this.jsSessionId,
      instance: this.nativeValue('getLifecycleInstanceId') ?? this.jsInstanceId,
      ...details,
    };
    console.info(`[${this.config.appId}.lifecycle] ${event}`, payload);
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    for (const listener of this.nativeListeners) void listener.remove();
    this.nativeListeners = [];
    this.inactiveCallbacks.clear();
  }

  private handleAppStateChange(isActive: boolean): void {
    this.log('Capacitor.appStateChange', { isActive });
    if (!isActive) this.notifyInactive();
  }

  private notifyInactive(): void {
    for (const callback of this.inactiveCallbacks) callback();
  }

  private nativeValue(method: keyof RuntimeBridge): string | undefined {
    try {
      const value =
        typeof window === 'undefined'
          ? undefined
          : window.SheldrappsRuntime?.[method]?.();
      return value || undefined;
    } catch {
      return undefined;
    }
  }

  private newId(prefix: string): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${this.config.appId}_${prefix}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
  }
}

export function provideLifecycleDiagnostics(
  config: LifecycleDiagnosticsConfig,
): { provide: InjectionToken<LifecycleDiagnosticsConfig>; useValue: LifecycleDiagnosticsConfig }[] {
  return [{ provide: LIFECYCLE_DIAGNOSTICS_CONFIG, useValue: config }];
}
