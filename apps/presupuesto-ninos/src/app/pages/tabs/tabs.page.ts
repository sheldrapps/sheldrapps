import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import {
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonIcon,
  IonLabel,
  Platform,
  ToastController,
} from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import { logoUsd, settingsOutline } from "ionicons/icons";
import { App } from "@capacitor/app";

@Component({
  standalone: true,
  selector: "app-tabs",
  templateUrl: "./tabs.page.html",
  styleUrls: ["./tabs.page.scss"],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class TabsPage {
  private platform = inject(Platform);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);

  private lastBackAt = 0;
  private exitToast?: HTMLIonToastElement;

  private readonly EXIT_WINDOW_MS = 1500;

  constructor() {
    addIcons({ logoUsd, settingsOutline });

    this.platform.backButton.subscribeWithPriority(5, async () => {
      if (!this.platform.is("android")) return;

      const url = this.router.url;

      // Si estamos en el detalle de un niño, regresar a presupuestos
      if (url.startsWith("/tabs/nino/")) {
        await this.router.navigateByUrl("/tabs/presupuestos");
        return;
      }

      // Si estamos en ajustes, regresar a presupuestos
      if (url === "/tabs/ajustes") {
        await this.router.navigateByUrl("/tabs/presupuestos");
        return;
      }

      // Si estamos en presupuestos (home), implementar doble back para salir
      if (url === "/tabs/presupuestos") {
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
      message: "Presiona atrás nuevamente para salir",
      duration: this.EXIT_WINDOW_MS,
      position: "middle",
      cssClass: ["cc-toast", "cc-toast--info"],
    });

    this.exitToast = toast;

    toast.onDidDismiss().then(() => {
      if (this.exitToast === toast) this.exitToast = undefined;
    });

    await toast.present();
  }
}
