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
import { TOOLS_REGISTRY } from "./tools.registry";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { merge, Observable } from "rxjs";

@Component({
  selector: "cc-tools-page",
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent, TranslateModule],
  templateUrl: "./tools.page.html",
  styleUrls: ["./tools.page.scss"],
})
export class ToolsPage {
  readonly ui = inject(EditorUiStateService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  toolItems: ScrollableBarItem[] = this.buildToolItems();

  constructor() {
    merge(
      this.translate.onLangChange as Observable<LangChangeEvent>,
      this.translate.onTranslationChange as Observable<TranslationChangeEvent>,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.toolItems = this.buildToolItems();
      });
  }

  private buildToolItems(): ScrollableBarItem[] {
    const cropKey =
      TOOLS_REGISTRY.crop.titleKey ??
      "EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP";
    const rotateKey =
      TOOLS_REGISTRY.rotate.titleKey ??
      "EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.ROTATE";
    const zoomKey =
      TOOLS_REGISTRY.zoom.titleKey ??
      "EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.ZOOM";

    const cropLabel = this.translate.instant(cropKey);
    const rotateLabel = this.translate.instant(rotateKey);
    const zoomLabel = this.translate.instant(zoomKey);

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
      makeItem("crop", cropLabel),
      makeItem("rotate", rotateLabel),
      makeItem("zoom", zoomLabel),
    ];
  }

  onSelectTool(panelId: string): void {
    this.ui.togglePanel("tools", panelId);
  }
}
