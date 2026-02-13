import { InjectionToken } from '@angular/core';

/**
 * Token to inject the current panel ID into panel widgets
 * @example
 * constructor(@Inject(EDITOR_PANEL_ID) private panelId: string) {}
 */
export const EDITOR_PANEL_ID = new InjectionToken<string>('EDITOR_PANEL_ID');

/**
 * Token to inject the current panel mode into panel widgets
 * @example
 * constructor(@Inject(EDITOR_PANEL_MODE) private mode: 'tools' | 'adjustments') {}
 */
export const EDITOR_PANEL_MODE = new InjectionToken<'tools' | 'adjustments'>('EDITOR_PANEL_MODE');

/**
 * Token to inject the editor session ID into panel widgets
 * @example
 * constructor(@Inject(EDITOR_SESSION_ID) private sid: string) {}
 */
export const EDITOR_SESSION_ID = new InjectionToken<string>('EDITOR_SESSION_ID');

