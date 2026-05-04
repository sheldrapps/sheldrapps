import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonToggle, IonItem, IonLabel } from '@ionic/angular/standalone';
import { AlertController } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EditorHistoryService } from "../../../editor-history.service";
import { CheckboxCustomEvent } from '@ionic/angular';

@Component({
  selector: "cc-bw-panel",
  standalone: true,
  imports: [CommonModule, IonToggle, IonItem, IonLabel, TranslateModule],
  templateUrl: "./bw-panel.component.html",
  styleUrls: ["./bw-panel.component.scss"],
})
export class BwPanelComponent {
  readonly history = inject(EditorHistoryService);
  private readonly alertCtrl = inject(AlertController);
  private readonly translate = inject(TranslateService);

  onBwChange(event: Event): void {
    const checked = (event as CheckboxCustomEvent).detail.checked;
    this.history.setBw(checked);
  }

  async onDitherChange(event: Event): Promise<void> {
    const checked = (event as CheckboxCustomEvent).detail.checked;
    this.history.setDither(checked);
    if (!checked) return;
    await this.presentDitherAlert();
  }

  private async presentDitherAlert(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant(
        'EDITOR.PANELS.ADJUSTMENTS.DITHER_ALERT.TITLE',
      ),
      message: this.translate.instant(
        'EDITOR.PANELS.ADJUSTMENTS.DITHER_ALERT.MESSAGE',
      ),
      buttons: [
        {
          text: this.translate.instant(
            'EDITOR.PANELS.ADJUSTMENTS.DITHER_ALERT.BUTTON',
          ),
          role: 'confirm',
        },
      ],
    });
    await alert.present();
  }
}
