import { Component, DestroyRef, inject } from "@angular/core";
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

  bottomBarItems: ScrollableBarItem[] = this.buildBottomBarItems();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
  ) {
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
    const toolsKey = "EDITOR.SHELL.LABEL.TOOLS";
    const adjustmentsKey = "EDITOR.SHELL.LABEL.ADJUSTMENTS";

    const toolsLabel = this.translate.instant(toolsKey);
    const adjustmentsLabel = this.translate.instant(adjustmentsKey);

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
      makeItem("tools", toolsLabel, "crop-outline"),
      makeItem("adjustments", adjustmentsLabel, "options-outline"),
    ];
  }

  onBottomBarItemClick(id: string): void {
    switch (id) {
      case "tools":
        this.router.navigate(["tools"], { relativeTo: this.route });
        break;
      case "adjustments":
        this.router.navigate(["adjustments"], { relativeTo: this.route });
        break;
    }
  }
}
