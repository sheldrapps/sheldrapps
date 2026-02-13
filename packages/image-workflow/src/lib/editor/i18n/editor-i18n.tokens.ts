import { InjectionToken } from '@angular/core';

/**
 * Editor i18n overrides type
 * 
 * Supports two formats:
 * 1. Global overrides (applied to all languages):
 *    { 'EDITOR.SHELL.TITLE': 'My Title', 'EDITOR.SHELL.CANCEL': 'Exit' }
 * 
 * 2. Per-language overrides:
 *    { 'es-MX': { 'EDITOR.SHELL.TITLE': 'Mi Editor' }, 'en-US': { 'EDITOR.SHELL.TITLE': 'My Editor' } }
 */
export type EditorI18nOverrides = 
  | Record<string, string> 
  | Record<string, Record<string, string>>;

/**
 * Injection token for providing editor i18n overrides
 * 
 * Usage in app:
 * ```ts
 * provideEditorI18n(),
 * { provide: EDITOR_I18N_OVERRIDES, useValue: { 'EDITOR.SHELL.TITLE': 'Editor PRO' } }
 * ```
 */
export const EDITOR_I18N_OVERRIDES = new InjectionToken<EditorI18nOverrides>(
  'EDITOR_I18N_OVERRIDES'
);
