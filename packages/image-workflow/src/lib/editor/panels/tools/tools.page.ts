import { Component, inject, DestroyRef, computed, effect } from "@angular/core";
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
import { EditorStateService } from "../../editor-state.service";
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
  private readonly editorState = inject(EditorStateService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  toolItems: ScrollableBarItem[] = this.buildToolItems();
  readonly disabledToolIds = computed(() =>
    this.editorState.hasBackgroundSpace() ? [] : ["fill"],
  );

  constructor() {
    effect(() => {
      this.ui.toolsConfig();
      this.toolItems = this.buildToolItems();
    });

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
    const toolsConfig = this.ui.toolsConfig();
    const cropKey =
      TOOLS_REGISTRY.crop.titleKey ??
      "EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP";
    const rotateKey =
      TOOLS_REGISTRY.rotate.titleKey ??
      "EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.ROTATE";
    const zoomKey =
      TOOLS_REGISTRY.zoom.titleKey ??
      "EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.ZOOM";
    const fillKey =
      TOOLS_REGISTRY.fill.titleKey ??
      "EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.FILL";

    const cropLabel = this.translate.instant(cropKey);
    const rotateLabel = this.translate.instant(rotateKey);
    const zoomLabel = this.translate.instant(zoomKey);
    const fillLabel = this.translate.instant(fillKey);

    const makeItem = (id: string, label: string) =>
      ({
        id,
        label,
        labelKey: label,
        text: label,
        title: label,
        ariaLabel: label,
      }) as unknown as ScrollableBarItem;

    const items: ScrollableBarItem[] = [makeItem("crop", cropLabel)];

    if (toolsConfig?.rotate !== false) {
      items.push(makeItem("rotate", rotateLabel));
    }

    if (toolsConfig?.zoom !== false) {
      items.push(makeItem("zoom", zoomLabel));
    }

    if (toolsConfig?.fill !== false) {
      items.push(makeItem("fill", fillLabel));
    }

    return items;
  }

  onSelectTool(panelId: string): void {
    if (panelId === "fill" && !this.editorState.hasBackgroundSpace()) {
      return;
    }
    this.ui.togglePanel("tools", panelId);
  }
}
