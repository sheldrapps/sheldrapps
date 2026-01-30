import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@sheldrapps/i18n-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { PresupuestoSettings } from './settings/presupuesto-settings.schema';
import { BudgetStore } from './core/budget.store';

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private settings = inject(SettingsStore<PresupuestoSettings>);
  private lang = inject(LanguageService);
  private t = inject(TranslateService);
  private title = inject(Title);
  private budgetStore = inject(BudgetStore);

  constructor() {
    void this.init();
  }

  private async init() {
    await this.budgetStore.init();

    // Load settings from storage
    await this.settings.load();
    
    // Get the saved language from settings
    const currentSettings = this.settings.get();
    
    // Set the language in LanguageService
    await this.lang.set(currentSettings.lang);
    
    this.setDocumentTitle();
    this.t.onLangChange.subscribe(() => this.setDocumentTitle());
  }

  private setDocumentTitle() {
    this.title.setTitle(this.t.instant('APP.TITLE'));
  }
}
