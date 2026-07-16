import { Component, Input, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { ThemeService, type Theme } from '../../theme';
import { ThemeSelectorComponent } from '../theme-selector/theme-selector.component';
import { UiThemeI18nService } from '../../translations/ui-theme-i18n.service';

@Component({
  selector: 'sh-theme-settings-page',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonButtons, IonBackButton, IonButton, IonTitle, IonContent, ThemeSelectorComponent],
  templateUrl: './theme-settings-page.component.html',
  styleUrls: ['./theme-settings-page.component.scss'],
})
export class ThemeSettingsPageComponent implements OnDestroy {
  private readonly i18n = inject(UiThemeI18nService);
  @Input() backHref = '/tabs/settings';
  @Input() useEdgeToEdgeHeader = true;

  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private confirmed = false;

  readonly initialThemeId: Theme = this.theme.currentTheme;
  draftThemeId: Theme = this.initialThemeId;
  readonly texts = this.i18n.texts;

  get isDirty(): boolean {
    return this.draftThemeId !== this.initialThemeId;
  }

  async onThemeDraftChange(theme: Theme): Promise<void> {
    this.draftThemeId = theme;
    await this.theme.previewTheme(theme);
  }

  async onDone(): Promise<void> {
    if (!this.isDirty) {
      this.confirmed = true;
      await this.router.navigateByUrl(this.backHref);
      return;
    }

    await this.theme.setTheme(this.draftThemeId);
    this.confirmed = true;
    await this.router.navigateByUrl(this.backHref);
  }

  ngOnDestroy(): void {
    if (!this.confirmed) {
      void this.theme.restorePersistedTheme();
    }
  }
}
