import { Component, inject, DestroyRef, effect } from "@angular/core";
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
    effect(() => {
      // Rebuild items when feature flags change (e.g. eReader optimization visibility)
      this.ui.toolsConfig();
      this.adjustmentItems = this.buildAdjustmentItems();
    });

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
    const sharpnessKey =
      "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.SHARPNESS";
    const bwKey = "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.BW";
    const cleanupKey =
      "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.CLEANUP";
    const ditherKey =
      "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.DITHER";
    const ereaderOptimizeKey =
      "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.EREADER_OPTIMIZE";

    const brightnessLabel = this.translate.instant(brightnessKey);
    const saturationLabel = this.translate.instant(saturationKey);
    const contrastLabel = this.translate.instant(contrastKey);
    const sharpnessLabel = this.translate.instant(sharpnessKey);
    const bwLabel = this.translate.instant(bwKey);
    const cleanupLabel = this.translate.instant(cleanupKey);
    const ditherLabel = this.translate.instant(ditherKey);
    const ereaderOptimizeLabel = this.translate.instant(ereaderOptimizeKey);

    const makeItem = (id: string, label: string) =>
      ({
        id,
        label,
        labelKey: label,
        text: label,
        title: label,
        ariaLabel: label,
      }) as unknown as ScrollableBarItem;

    const items: ScrollableBarItem[] = [];

    if (this.ui.toolsConfig()?.eReaderOptimization?.enabled) {
      items.push(makeItem("ereaderOptimize", ereaderOptimizeLabel));
    }

    items.push(
      makeItem("brightness", brightnessLabel),
      makeItem("contrast", contrastLabel),
      makeItem("saturation", saturationLabel),
      makeItem("sharpness", sharpnessLabel),
      makeItem("bw", bwLabel),
      makeItem("cleanup", cleanupLabel),
      makeItem("dither", ditherLabel),
    );

    return items;
  }

  onSelectAdjustPanel(panelId: string): void {
    this.ui.togglePanel("adjustments", panelId);
  }
}
