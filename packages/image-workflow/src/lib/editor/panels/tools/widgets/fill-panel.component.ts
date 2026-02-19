import { Component, computed, inject, signal, DestroyRef } from "@angular/core";
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
import { IonButton, IonIcon, IonItem, IonLabel, IonRange } from "@ionic/angular/standalone";
import { RangeCustomEvent } from "@ionic/angular";
import { addIcons } from "ionicons";
import {
  colorPaletteOutline,
  chevronBackOutline,
  eyedropOutline,
  gridOutline,
  imageOutline,
} from "ionicons/icons";
import { merge, Observable } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { EditorHistoryService } from "../../../editor-history.service";
import { EditorColorSamplerService } from "../../../editor-color-sampler.service";
import { EditorUiStateService } from "../../../editor-ui-state.service";
import type { BackgroundMode } from "../../../../types";

type FillPanelView = "root" | "blur" | "colors" | "picker";
type ColorSource = "picker" | "colors";

type FillPreset = {
  id: string;
  hex: string;
};

const DEFAULT_BLUR = 80;

const FILL_PRESET_COLORS: FillPreset[] = [
  { id: "black", hex: "#000000" },
  { id: "white", hex: "#FFFFFF" },
  { id: "gray-50", hex: "#F5F5F5" },
  { id: "gray-100", hex: "#E8E4DC" },
  { id: "gray-200", hex: "#D9D9D9" },
  { id: "gray-300", hex: "#C4C4C4" },
  { id: "gray-400", hex: "#A0A0A0" },
  { id: "gray-600", hex: "#666666" },
  { id: "gray-800", hex: "#2B2B2B" },
  { id: "gray-900", hex: "#222222" },
  { id: "paper", hex: "#F2EFE8" },
  { id: "paper-warm", hex: "#E8DCC7" },
  { id: "beige", hex: "#C4A484" },
  { id: "tan", hex: "#D8C3A5" },
  { id: "sand", hex: "#E6D5B8" },
  { id: "cream", hex: "#FFF7E6" },
  { id: "navy", hex: "#1F2A44" },
  { id: "blue", hex: "#3A6EA5" },
  { id: "sky", hex: "#8DB9E6" },
  { id: "teal", hex: "#3D8C8C" },
  { id: "green", hex: "#3E7C59" },
  { id: "mint", hex: "#9FD8CB" },
  { id: "olive", hex: "#8A8F5A" },
  { id: "red", hex: "#B84A4A" },
  { id: "rose", hex: "#D98C8C" },
  { id: "orange", hex: "#D77A4A" },
  { id: "mustard", hex: "#C9A227" },
  { id: "purple", hex: "#6E5A8A" },
  { id: "lavender", hex: "#B8A9D9" },
  { id: "brown", hex: "#6F4E37" },
];

@Component({
  selector: "cc-fill-panel",
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ScrollableButtonBarComponent,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonRange,
  ],
  templateUrl: "./fill-panel.component.html",
  styleUrls: ["./fill-panel.component.scss"],
})
export class FillPanelComponent {
  readonly history = inject(EditorHistoryService);
  readonly sampler = inject(EditorColorSamplerService);
  readonly ui = inject(EditorUiStateService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeView = signal<FillPanelView>("root");
  readonly lastColorSource = signal<ColorSource>("colors");

  readonly mode = computed<BackgroundMode>(
    () => this.history.backgroundMode() ?? "transparent",
  );
  readonly color = computed(() => this.history.backgroundColor());
  readonly blur = computed(() => this.history.backgroundBlur() ?? DEFAULT_BLUR);
  readonly activeColorId = computed(() => {
    const current = this.normalizeHex(this.color());
    const match = this.presets.find(
      (preset) => preset.hex.toLowerCase() === current,
    );
    return match?.id ?? null;
  });

  readonly activeItem = computed(() => {
    const mode = this.mode();
    if (mode === "transparent") return "none";
    if (mode === "blur") return "same-image";
    return this.lastColorSource() === "picker" ? "picker" : "colors";
  });

  presets = FILL_PRESET_COLORS;
  toolItems: ScrollableBarItem[] = this.buildToolItems();
  colorItems: ScrollableBarItem[] = this.buildColorItems();

  constructor() {
    addIcons({
      colorPaletteOutline,
      chevronBackOutline,
      eyedropOutline,
      gridOutline,
      imageOutline,
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
    const noneLabel = this.translate.instant(
      "EDITOR.PANELS.TOOLS.WIDGETS.FILL_PANEL.TAB.NONE",
    );
    const imageLabel = this.translate.instant(
      "EDITOR.PANELS.TOOLS.WIDGETS.FILL_PANEL.TAB.IMAGE",
    );
    const pickerLabel = this.translate.instant(
      "EDITOR.PANELS.TOOLS.WIDGETS.FILL_PANEL.TAB.PICKER",
    );
    const colorsLabel = this.translate.instant(
      "EDITOR.PANELS.TOOLS.WIDGETS.FILL_PANEL.TAB.COLORS",
    );

    const makeItem = (id: string, label: string, icon: string) =>
      ({
        id,
        label,
        labelKey: label,
        icon,
      }) as ScrollableBarItem;

    return [
      makeItem("none", noneLabel, "grid-outline"),
      makeItem("same-image", imageLabel, "image-outline"),
      makeItem("picker", pickerLabel, "eyedrop-outline"),
      makeItem("colors", colorsLabel, "color-palette-outline"),
    ];
  }

  private buildColorItems(): ScrollableBarItem[] {
    return this.presets.map((preset) => ({
      id: preset.id,
      label: preset.hex,
      type: "color",
      colorHex: preset.hex,
    }));
  }

  onSelectTool(id: string): void {
    switch (id) {
      case "none":
        this.setTransparent();
        this.activeView.set("root");
        return;
      case "same-image":
        this.setBlur();
        this.activeView.set("blur");
        return;
      case "picker":
        this.lastColorSource.set("picker");
        this.activeView.set("picker");
        this.startSampling();
        return;
      case "colors":
        this.lastColorSource.set("colors");
        this.activeView.set("colors");
        return;
      default:
        return;
    }
  }

  setTransparent(): void {
    this.history.setBackgroundMode("transparent");
  }

  setBlur(): void {
    this.history.setBackground({
      mode: "blur",
      source: "same-image",
      blur: this.blur(),
    });
  }

  setColor(color: string): void {
    this.history.setBackground({ mode: "color", color });
    this.lastColorSource.set("colors");
  }

  onBlurChange(event: Event): void {
    const value = (event as RangeCustomEvent).detail.value as number;
    if (!Number.isFinite(value)) return;
    this.history.setBackgroundBlur(value);
  }

  startSampling(): void {
    if (this.sampler.active()) return;
    this.sampler.start();
    this.ui.closePanel();
  }

  onSelectColor(id: string): void {
    const match = this.presets.find((preset) => preset.id === id);
    if (!match) return;
    this.setColor(match.hex);
    this.activeView.set("root");
  }

  goRoot(): void {
    this.activeView.set("root");
  }

  private normalizeHex(value: string | undefined): string {
    const trimmed = (value || "").trim();
    if (!trimmed) return "#000000";
    if (!trimmed.startsWith("#")) return `#${trimmed}`;
    return trimmed.toLowerCase();
  }
}
