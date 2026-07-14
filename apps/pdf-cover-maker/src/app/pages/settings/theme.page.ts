import { Component } from '@angular/core';
import { ThemeSettingsPageComponent } from '@sheldrapps/ui-theme';

@Component({
  selector: 'app-theme-page',
  standalone: true,
  templateUrl: './theme.page.html',
  imports: [ThemeSettingsPageComponent],
})
export class ThemePage {}
