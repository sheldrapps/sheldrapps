import { Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { Capacitor } from '@capacitor/core';
import { EdgeToEdgeService } from '@sheldrapps/ui-theme';
import {
  NativeSqliteManager,
  SqliteBootstrapService,
} from '@sheldrapps/native-sqlite-kit';
import { ConsentService } from './services/consent.service';
import { ConfigService } from '../config/config.service';

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private readonly config = inject(ConfigService);
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);
  private readonly edgeToEdge = inject(EdgeToEdgeService);
  private readonly consent = inject(ConsentService);
  private readonly sqliteBootstrap = inject(SqliteBootstrapService);
  private readonly sqliteManager = inject(NativeSqliteManager);

  constructor() {
    void this.edgeToEdge.initEdgeToEdge();
    void this.init();
  }

  private async init(): Promise<void> {
    await this.config.initialize();
    if (Capacitor.getPlatform() === 'android') {
      await this.sqliteBootstrap.bootstrap();
      await this.sqliteManager.execute('PRAGMA foreign_keys = ON;');
    }
    await this.consent.gatherConsent();
    this.setDocumentTitle();
    this.translate.onLangChange.subscribe(() => this.setDocumentTitle());
  }

  private setDocumentTitle(): void {
    this.title.setTitle(this.translate.instant('APP.TITLE'));
  }
}
