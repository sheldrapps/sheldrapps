import { Injectable } from "@angular/core";
import { AlertController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import { EditorHistoryService } from "./editor-history.service";
import { EditorUiStateService } from "./editor-ui-state.service";

@Injectable({
  providedIn: "root",
})
export class EditorPanelExitService {
  constructor(
    private readonly history: EditorHistoryService,
    private readonly ui: EditorUiStateService,
    private readonly alertCtrl: AlertController,
    private readonly translate: TranslateService,
  ) {}

  async discardPanelIfNeeded(): Promise<boolean> {
    if (this.history.mode() !== "local") return true;

    if (this.history.isDirty()) {
      const confirmed = await this.confirmDiscardPanel();
      if (!confirmed) return false;
    }

    this.history.discardPanel();
    this.ui.closePanel();
    return true;
  }

  private async confirmDiscardPanel(): Promise<boolean> {
    const message = this.translate.instant(
      "EDITOR.SHELL.CONFIRM.DISCARD_PANEL",
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
  }
}
