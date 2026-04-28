import { Component, DestroyRef, effect, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  TranslateModule,
  TranslateService,
  TranslationChangeEvent,
  LangChangeEvent,
} from "@ngx-translate/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  ScrollableButtonBarComponent,
  ScrollableBarItem,
} from "@sheldrapps/ui-theme";
import { EditorUiStateService } from "../../editor-ui-state.service";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { merge, Observable } from "rxjs";

@Component({
  selector: "cc-default-page",
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent, TranslateModule],
  templateUrl: "./default.page.html",
  styleUrls: ["./default.page.scss"],
})
export class DefaultPage {
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ui = inject(EditorUiStateService);

  bottomBarItems: ScrollableBarItem[] = this.buildBottomBarItems();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
  ) {
    effect(() => {
      this.ui.toolsConfig();
      this.bottomBarItems = this.buildBottomBarItems();
    });

    merge(
      this.translate.onLangChange as Observable<LangChangeEvent>,
      this.translate.onTranslationChange as Observable<TranslationChangeEvent>,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.bottomBarItems = this.buildBottomBarItems();
      });
  }

  private buildBottomBarItems(): ScrollableBarItem[] {
    const toolsConfig = this.ui.toolsConfig();
    const toolsKey = "EDITOR.SHELL.LABEL.TOOLS";
    const adjustmentsKey = "EDITOR.SHELL.LABEL.ADJUSTMENTS";
    const textKey = "EDITOR.SHELL.LABEL.TEXT";

    const toolsLabel = this.translate.instant(toolsKey);
    const adjustmentsLabel = this.translate.instant(adjustmentsKey);
    const textLabel = this.translate.instant(textKey);

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

    const items = [makeItem("tools", toolsLabel, "crop-outline")];

    if (toolsConfig?.adjustments !== false) {
      items.push(makeItem("adjustments", adjustmentsLabel, "options-outline"));
    }

    if (toolsConfig?.text !== false) {
      items.push(makeItem("text", textLabel, "text-outline"));
    }

    return items;
  }

  onBottomBarItemClick(id: string): void {
    switch (id) {
      case "tools":
        this.router.navigate(["tools"], { relativeTo: this.route });
        break;
      case "adjustments":
        this.router.navigate(["adjustments"], { relativeTo: this.route });
        break;
      case "text":
        this.router.navigate(["text"], { relativeTo: this.route });
        break;
    }
  }
}
