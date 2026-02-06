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
import { refreshOutline, libraryOutline, settingsOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: true,
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

  private platform = inject(Platform);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);

  private lastBackAt = 0;
  private exitToast?: HTMLIonToastElement;

  private readonly EXIT_WINDOW_MS = 1500;

  constructor() {
    addIcons({ refreshOutline, libraryOutline, settingsOutline });

    this.platform.backButton.subscribeWithPriority(5, async () => {
      if (!this.platform.is('android')) return;

      const url = this.router.url;

      if (url.startsWith('/tabs/settings/') && url !== '/tabs/settings') {
        await this.router.navigateByUrl('/tabs/settings');
        return;
      }

      if (url === '/tabs/my-epubs' || url === '/tabs/settings') {
        await this.router.navigateByUrl('/tabs/change');
        return;
      }

      if (url === '/tabs/change') {
        const now = Date.now();

        if (now - this.lastBackAt < this.EXIT_WINDOW_MS) {
          try {
            await this.exitToast?.dismiss();
          } catch {}
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

  private async showExitToast() {
    if (this.exitToast) return;

    const toast = await this.toastCtrl.create({
      message: this.translate.instant('COMMON.BACK_AGAIN_TO_EXIT'),
      duration: this.EXIT_WINDOW_MS,
      position: 'middle',
      cssClass: ['cc-toast', 'cc-toast--info'],
    });

    this.exitToast = toast;

    toast.onDidDismiss().then(() => {
      if (this.exitToast === toast) this.exitToast = undefined;
    });

    await toast.present();
  }
}
