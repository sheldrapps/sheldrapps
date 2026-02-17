import { Component, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollableButtonBarComponent } from "@sheldrapps/ui-theme";
import type { ScrollableBarItem } from "@sheldrapps/ui-theme";
import { addIcons } from "ionicons";
import { addOutline, removeOutline } from "ionicons/icons";
import { EditorStateService } from "../../../editor-state.service";
import {
  TranslateService,
  TranslationChangeEvent,
  LangChangeEvent,
} from "@ngx-translate/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { merge, Observable } from "rxjs";

@Component({
  selector: "cc-zoom-panel",
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent],
  templateUrl: "./zoom-panel.component.html",
  styleUrls: ["./zoom-panel.component.scss"],
})
export class ZoomPanelComponent {
  readonly editorState = inject(EditorStateService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  zoomItems: ScrollableBarItem[] = this.buildZoomItems();

  get disabledZoomIds(): string[] {
    const scale = this.editorState.scale();
    const ids: string[] = [];
    if (scale <= 1) ids.push("out");
    if (scale >= 6) ids.push("in");
    return ids;
  }

  constructor() {
    addIcons({ addOutline, removeOutline });
    merge(
      this.translate.onLangChange as Observable<LangChangeEvent>,
      this.translate.onTranslationChange as Observable<TranslationChangeEvent>,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.zoomItems = this.buildZoomItems();
      });
  }

  private buildZoomItems(): ScrollableBarItem[] {
    const zoomOutKey = "EDITOR.PANELS.TOOLS.WIDGETS.ZOOM_PANEL.BUTTON.ZOOM_OUT";
    const zoomInKey = "EDITOR.PANELS.TOOLS.WIDGETS.ZOOM_PANEL.BUTTON.ZOOM_IN";

    const zoomOutLabel = this.translate.instant(zoomOutKey);
    const zoomInLabel = this.translate.instant(zoomInKey);

    const makeItem = (id: string, label: string, icon: string) =>
      ({
        id,
        label,
        labelKey: label,
        text: label,
        title: label,
        ariaLabel: label,
        icon,
      }) as unknown as ScrollableBarItem;

    return [
      makeItem("out", zoomOutLabel, "remove-outline"),
      makeItem("in", zoomInLabel, "add-outline"),
    ];
  }

  onSelectZoom(id: string): void {
    if (id === "out") {
      this.editorState.zoomOut();
      return;
    }

    if (id === "in") {
      this.editorState.zoomIn();
    }
  }
}
