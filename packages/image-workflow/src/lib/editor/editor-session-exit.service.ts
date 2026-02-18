import { Injectable } from "@angular/core";
import { AlertController, NavController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import { EditorHistoryService } from "./editor-history.service";

@Injectable({
  providedIn: "root",
})
export class EditorSessionExitService {
  private returnUrl: string | null = null;
  private allowNextExit = false;
  private confirming = false;

  constructor(
    private readonly history: EditorHistoryService,
    private readonly navCtrl: NavController,
    private readonly alertCtrl: AlertController,
    private readonly translate: TranslateService,
  ) {}

  setReturnUrl(returnUrl: string | null): void {
    this.returnUrl = returnUrl;
  }

  clearReturnUrl(): void {
    this.returnUrl = null;
  }

  async cancelSession(): Promise<boolean> {
    const confirmed = await this.confirmCancelSession();
    if (!confirmed) return false;

    this.history.resetSession();
    this.allowNextExitOnce();
    this.navCtrl.navigateBack(this.getExitUrl(), { replaceUrl: true });
    return true;
  }

  exitAfterDone(): void {
    this.allowNextExitOnce();
    this.navCtrl.navigateBack(this.getExitUrl(), { replaceUrl: true });
  }

  async canExitEditor(): Promise<boolean> {
    if (this.consumeAllowExit()) return true;
    if (this.history.mode() === "local") return false;

    const confirmed = await this.confirmCancelSession();
    if (!confirmed) return false;

    this.history.resetSession();
    return true;
  }

  private allowNextExitOnce(): void {
    this.allowNextExit = true;
  }

  private consumeAllowExit(): boolean {
    const allowed = this.allowNextExit;
    this.allowNextExit = false;
    return allowed;
  }

  private async confirmCancelSession(): Promise<boolean> {
    if (this.confirming) return false;
    this.confirming = true;
    try {
      const message = this.translate.instant(
        "EDITOR.SHELL.CONFIRM.CANCEL_SESSION",
      );

      const alert = await this.alertCtrl.create({
        message,
        buttons: [
          {
            text: this.translate.instant("EDITOR.SHELL.BUTTON.CANCEL"),
            role: "cancel",
          },
          {
            text: this.translate.instant("EDITOR.SHELL.BUTTON.DISCARD"),
            role: "confirm",
          },
        ],
      });

      await alert.present();
      const { role } = await alert.onWillDismiss();
      return role === "confirm";
    } finally {
      this.confirming = false;
    }
  }

  private getExitUrl(): string {
    const candidate = this.returnUrl ?? "";
    if (candidate.startsWith("/tabs/")) return candidate;
    return "/tabs/create";
  }
}
