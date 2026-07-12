import { Component, EnvironmentInjector, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  Platform,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { App } from '@capacitor/app';
import { addIcons } from 'ionicons';
import { homeOutline, libraryOutline, settingsOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    TranslateModule,
  ],
})
export class TabsPage {
  public environmentInjector = inject(EnvironmentInjector);

  private readonly platform = inject(Platform);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly translate = inject(TranslateService);

  private lastBackAt = 0;
  private exitToast?: HTMLIonToastElement;

  private readonly exitWindowMs = 1500;

  constructor() {
    addIcons({ homeOutline, libraryOutline, settingsOutline });

    this.platform.backButton.subscribeWithPriority(5, async () => {
      if (!this.platform.is('android')) {
        return;
      }

      const url = this.router.url;

      if (url.startsWith('/tabs/settings/') && url !== '/tabs/settings') {
        await this.router.navigateByUrl('/tabs/settings');
        return;
      }

      if (url === '/tabs/my-epubs' || url === '/tabs/settings') {
        await this.router.navigateByUrl('/tabs/home');
        return;
      }

      if (url.startsWith('/tabs/home')) {
        const now = Date.now();

        if (now - this.lastBackAt < this.exitWindowMs) {
          try {
            await this.exitToast?.dismiss();
          } catch {
            // Ignore dismiss errors while exiting.
          }
          await App.exitApp();
          return;
        }

        this.lastBackAt = now;
        await this.showExitToast();
        return;
      }

      window.history.back();
    });
  }

  private async showExitToast(): Promise<void> {
    if (this.exitToast) {
      return;
    }

    const toast = await this.toastCtrl.create({
      message: this.translate.instant('COMMON.BACK_AGAIN_TO_EXIT'),
      duration: this.exitWindowMs,
      position: 'middle',
    });

    this.exitToast = toast;

    toast.onDidDismiss().then(() => {
      if (this.exitToast === toast) {
        this.exitToast = undefined;
      }
    });

    await toast.present();
  }
}
