import { CommonModule } from '@angular/common';
import {
  computed,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { IonLabel } from '@ionic/angular/standalone';
import { ThemePreviewTileComponent } from '../theme-preview-tile/theme-preview-tile.component';
import { THEME_OPTIONS, type Theme } from '../../theme';
import { UiThemeI18nService } from '../../translations/ui-theme-i18n.service';

@Component({
  selector: 'sh-theme-selector',
  standalone: true,
  imports: [CommonModule, IonLabel, ThemePreviewTileComponent],
  templateUrl: './theme-selector.component.html',
  styleUrls: ['./theme-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeSelectorComponent {
  private readonly i18n = inject(UiThemeI18nService);

  @Input({ required: true }) value: Theme | null = null;
  @Output() valueChange = new EventEmitter<Theme>();

  readonly options = computed(() => this.i18n.themeOptions());

  trackByTheme = (_: number, option: { code: Theme }) => option.code;

  onSelect(theme: Theme): void {
    if (theme === this.value) {
      return;
    }

    this.valueChange.emit(theme);
  }
}
