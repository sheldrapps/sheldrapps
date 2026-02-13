/**
 * Editor Panel Dependency Injection Guide
 * ========================================
 * 
 * Panel widgets can inject dependencies provided by EditorUiStateService:
 * 
 * @example Basic injection
 * ```typescript
 * import { Component, inject } from '@angular/core';
 * import { EDITOR_PANEL_ID, EDITOR_SESSION_ID, EditorSessionService } from '@sheldrapps/image-workflow/editor';
 * 
 * @Component({...})
 * export class MyPanelComponent {
 *   private readonly panelId = inject(EDITOR_PANEL_ID);
 *   private readonly sid = inject(EDITOR_SESSION_ID, { optional: true });
 *   private readonly session = inject(EditorSessionService, { optional: true });
 * }
 * ```
 * 
 * Available tokens:
 * - EDITOR_PANEL_ID: string - The current panel ID (e.g., 'brightness', 'crop')
 * - EDITOR_PANEL_MODE: 'tools' | 'adjustments' - The current panel mode
 * - EDITOR_SESSION_ID: string - The current editor session ID
 * - EditorSessionService: Access to the active editor session
 */

export { EDITOR_PANEL_ID, EDITOR_PANEL_MODE, EDITOR_SESSION_ID } from './editor-panel.tokens';
export { EditorUiStateService } from './editor-ui-state.service';
export { EditorSessionService } from './editor-session.service';
