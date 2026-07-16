import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { ActionCardComponent } from '@sheldrapps/ui-theme';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    TranslateModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    ActionCardComponent,
  ],
})
export class HomePage {
  private readonly router = inject(Router);
  readonly mergeIconSvg = signal<string | null>(null);
  readonly splitIconSvg = signal<string | null>(null);

  constructor() {
    void this.loadIcons();
  }

  openUnderConstruction(): void {
    void this.router.navigateByUrl('/tabs/home/under-construction');
  }

  private async loadIcons(): Promise<void> {
    try {
      const [mergeIconSvg, splitIconSvg] = await Promise.all([
        this.loadSvg('./assets/icons/merge.svg'),
        this.loadSvg('./assets/icons/split.svg'),
      ]);

      this.mergeIconSvg.set(mergeIconSvg);
      this.splitIconSvg.set(splitIconSvg);
    } catch (error) {
      console.error('[epub-merger-and-splitter] failed to load home icons', error);
    }
  }

  private async loadSvg(assetPath: string): Promise<string> {
    const response = await fetch(assetPath);

    if (!response.ok) {
      throw new Error(`Failed to load SVG asset: ${assetPath}`);
    }

    return response.text();
  }
}
