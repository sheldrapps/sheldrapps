import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonLabel,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import {
  ThemePreviewTileComponent,
  THEME_OPTIONS,
  ThemeService,
  type Theme,
  type ThemeOption,
} from '@sheldrapps/ui-theme';
import { ConfigService } from 'src/config/config.service';

@Component({
  selector: 'app-theme-page',
  standalone: true,
  templateUrl: './theme.page.html',
  styleUrls: ['./settings.page.scss'],
  imports: [
    CommonModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonButton,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonLabel,
    ThemePreviewTileComponent,
  ],
})
export class ThemePage implements OnDestroy {
  private readonly config = inject(ConfigService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private confirmed = false;

  readonly supportedThemes = THEME_OPTIONS;
  readonly initialThemeId: Theme = this.theme.currentTheme;
  draftThemeId: Theme = this.initialThemeId;

  get isDirty(): boolean {
    return this.draftThemeId !== this.initialThemeId;
  }

  trackByTheme = (_: number, t: ThemeOption) => t.code;

  async onThemeDraftChange(theme: Theme): Promise<void> {
    this.draftThemeId = theme;
    await this.theme.previewTheme(theme);
  }

  async onDone(): Promise<void> {
    if (!this.isDirty) {
      this.confirmed = true;
      await this.router.navigateByUrl('/tabs/settings');
      return;
    }

    await this.config.setTheme(this.draftThemeId);
    this.confirmed = true;
    await this.router.navigateByUrl('/tabs/settings');
  }

  ngOnDestroy(): void {
    if (!this.confirmed) {
      void this.theme.restorePersistedTheme();
    }
  }
}
