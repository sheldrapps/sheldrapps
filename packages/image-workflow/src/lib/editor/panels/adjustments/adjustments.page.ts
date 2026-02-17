import { Component, inject, DestroyRef } from "@angular/core";
import {
  TranslateModule,
  TranslateService,
  TranslationChangeEvent,
  LangChangeEvent,
} from "@ngx-translate/core";
import { CommonModule } from "@angular/common";
import {
  ScrollableButtonBarComponent,
  ScrollableBarItem,
} from "@sheldrapps/ui-theme";
import { EditorUiStateService } from "../../editor-ui-state.service";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { merge, Observable } from "rxjs";

@Component({
  selector: "cc-adjustments-page",
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent, TranslateModule],
  templateUrl: "./adjustments.page.html",
  styleUrls: ["./adjustments.page.scss"],
})
export class AdjustmentsPage {
  readonly ui = inject(EditorUiStateService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  adjustmentItems: ScrollableBarItem[] = this.buildAdjustmentItems();

  constructor() {
    merge(
      this.translate.onLangChange as Observable<LangChangeEvent>,
      this.translate.onTranslationChange as Observable<TranslationChangeEvent>,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.adjustmentItems = this.buildAdjustmentItems();
      });
  }

  private buildAdjustmentItems(): ScrollableBarItem[] {
    const brightnessKey =
      "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.BRIGHTNESS";
    const saturationKey =
      "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.SATURATION";
    const contrastKey =
      "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.CONTRAST";
    const bwKey = "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.BW";
    const ditherKey =
      "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.DITHER";

    const brightnessLabel = this.translate.instant(brightnessKey);
    const saturationLabel = this.translate.instant(saturationKey);
    const contrastLabel = this.translate.instant(contrastKey);
    const bwLabel = this.translate.instant(bwKey);
    const ditherLabel = this.translate.instant(ditherKey);

    const makeItem = (id: string, label: string) =>
      ({
        id,
        label,
        labelKey: label,
        text: label,
        title: label,
        ariaLabel: label,
      }) as unknown as ScrollableBarItem;

    return [
      makeItem("brightness", brightnessLabel),
      makeItem("saturation", saturationLabel),
      makeItem("contrast", contrastLabel),
      makeItem("bw", bwLabel),
      makeItem("dither", ditherLabel),
    ];
  }

  onSelectAdjustPanel(panelId: string): void {
    this.ui.togglePanel("adjustments", panelId);
  }
}
