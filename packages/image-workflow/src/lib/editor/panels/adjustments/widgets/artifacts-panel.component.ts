import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonToggle,
} from "@ionic/angular/standalone";
import { AlertController, CheckboxCustomEvent } from "@ionic/angular";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { addIcons } from "ionicons";
import { informationCircleOutline } from "ionicons/icons";
import { EditorHistoryService } from "../../../editor-history.service";
import {
  EDITOR_SESSION_ID,
} from "../../../editor-panel.tokens";
import {
  ArtifactReductionInfoPreferencePort,
  EditorSessionService,
} from "../../../editor-session.service";

@Component({
  selector: "cc-artifacts-panel",
  standalone: true,
  imports: [
    CommonModule,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonToggle,
    TranslateModule,
  ],
  templateUrl: "./artifacts-panel.component.html",
  styleUrls: ["./artifacts-panel.component.scss"],
})
export class ArtifactsPanelComponent {
  readonly history = inject(EditorHistoryService);
  private readonly alertCtrl = inject(AlertController);
  private readonly translate = inject(TranslateService);
  private readonly editorSession = inject(EditorSessionService, {
    optional: true,
  });
  private readonly sessionId = inject(EDITOR_SESSION_ID, { optional: true });

  private hasSeenInfoThisSession = false;

  constructor() {
    addIcons({
      informationCircleOutline,
    });
  }

  async onArtifactReductionChange(event: Event): Promise<void> {
    const checked = (event as CheckboxCustomEvent).detail.checked;
    this.history.setArtifactReductionEnabled(checked);
    if (!checked) return;

    const hasSeenInfo = await this.resolveHasSeenInfo();
    if (hasSeenInfo) return;

    await this.presentArtifactInfoModal({ persistSeen: true });
  }

  async onInfoClick(): Promise<void> {
    await this.presentArtifactInfoModal({ persistSeen: false });
  }

  private async presentArtifactInfoModal(opts: {
    persistSeen: boolean;
  }): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant(
        "EDITOR.PANELS.ADJUSTMENTS.WIDGETS.ARTIFACTS_PANEL.INFO_TITLE",
      ),
      message: this.translate.instant(
        "EDITOR.PANELS.ADJUSTMENTS.WIDGETS.ARTIFACTS_PANEL.INFO_BODY",
      ),
      buttons: [
        {
          text: this.translate.instant(
            "EDITOR.PANELS.ADJUSTMENTS.WIDGETS.ARTIFACTS_PANEL.INFO_CTA",
          ),
          role: "confirm",
        },
      ],
    });

    await alert.present();
    await alert.onDidDismiss();

    if (!opts.persistSeen) return;

    this.hasSeenInfoThisSession = true;
    const preferences = this.getArtifactReductionInfoPort();
    if (!preferences) return;

    try {
      await preferences.markSeen();
    } catch {
      // Keep the session-level dismissal even if host persistence fails.
    }
  }

  private async resolveHasSeenInfo(): Promise<boolean> {
    if (this.hasSeenInfoThisSession) {
      return true;
    }

    const preferences = this.getArtifactReductionInfoPort();
    if (!preferences) {
      return false;
    }

    try {
      const hasSeen = await preferences.hasSeen();
      if (hasSeen) {
        this.hasSeenInfoThisSession = true;
      }
      return hasSeen;
    } catch {
      return false;
    }
  }

  private getArtifactReductionInfoPort():
    | ArtifactReductionInfoPreferencePort
    | null {
    if (!this.editorSession || !this.sessionId) {
      return null;
    }

    return (
      this.editorSession.getSession(this.sessionId)?.preferences
        ?.artifactReductionInfo ?? null
    );
  }
}
