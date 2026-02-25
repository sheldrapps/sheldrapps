import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  TranslateModule,
  TranslateService,
  TranslationChangeEvent,
  LangChangeEvent,
} from "@ngx-translate/core";
import {
  ScrollableButtonBarComponent,
  ScrollableBarItem,
} from "@sheldrapps/ui-theme";
import { EditorUiStateService } from "../../editor-ui-state.service";
import { EditorTextEditService } from "../../editor-text-edit.service";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { merge, Observable } from "rxjs";

@Component({
  selector: "cc-text-page",
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent, TranslateModule],
  templateUrl: "./text.page.html",
  styleUrls: ["./text.page.scss"],
})
export class TextPage implements OnInit {
  readonly ui = inject(EditorUiStateService);
  readonly textEdit = inject(EditorTextEditService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  textItems: ScrollableBarItem[] = this.buildTextItems();

  constructor() {
    merge(
      this.translate.onLangChange as Observable<LangChangeEvent>,
      this.translate.onTranslationChange as Observable<TranslationChangeEvent>,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.textItems = this.buildTextItems();
      });
  }

  ngOnInit(): void {
    this.textEdit.selectText(null);
    this.ui.openPanel("text", "text");
  }

  private buildTextItems(): ScrollableBarItem[] {
    const textKey = "EDITOR.SHELL.LABEL.TEXT";
    const textLabel = this.translate.instant(textKey);

    const makeItem = (id: string, label: string) =>
      ({
        id,
        label,
        labelKey: label,
        text: label,
        title: label,
        ariaLabel: label,
      }) as unknown as ScrollableBarItem;

    return [makeItem("text", textLabel)];
  }

  onSelectTextPanel(_: string): void {
    this.textEdit.selectText(null);
    this.ui.openPanel("text", "text");
  }
}
