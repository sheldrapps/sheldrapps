import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  getThemePreviewTokens,
  type ThemePreviewTokens,
  type Theme,
  type ThemeAppearance,
} from '../../theme';

@Component({
  selector: 'sh-theme-preview-tile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-preview-tile.component.html',
  styleUrls: ['./theme-preview-tile.component.scss'],
})
export class ThemePreviewTileComponent {
  @Input({ required: true }) themeId!: Theme;
  @Input() displayName = '';
  @Input() selected = false;
  @Input() previewTokens?: ThemePreviewTokens;

  get previewStyle(): Record<string, string> {
    const tokens = this.previewTokens ?? getThemePreviewTokens(this.themeId, this.systemAppearance);

    return {
      '--preview-background': tokens.background,
      '--preview-surface': tokens.surface,
      '--preview-text': tokens.text,
      '--preview-muted': tokens.muted,
      '--preview-primary': tokens.primary,
      '--preview-border': tokens.border,
      '--preview-toolbar': tokens.toolbar,
    };
  }

  private get systemAppearance(): ThemeAppearance {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return 'light';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
}