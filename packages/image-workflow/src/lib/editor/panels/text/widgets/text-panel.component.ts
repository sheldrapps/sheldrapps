import { Component, computed, DestroyRef, inject, signal, effect } from "@angular/core";
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
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonRange,
} from "@ionic/angular/standalone";
import { RangeCustomEvent } from "@ionic/angular";
import { addIcons } from "ionicons";
import { chevronBackOutline, eyedropOutline } from "ionicons/icons";
import { merge, Observable } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { EditorHistoryService } from "../../../editor-history.service";
import { EditorColorSamplerService } from "../../../editor-color-sampler.service";
import { EditorUiStateService } from "../../../editor-ui-state.service";
import { EditorTextEditService } from "../../../editor-text-edit.service";
import type { TextLayer } from "../../../../types";

type TextSubpanel =
  | "root"
  | "font"
  | "color"
  | "stroke"
  | "strokeColor"
  | "strokeWidth"
  | "size";

type FontPreset = {
  id: string;
  label: string;
  family: string;
  asset?: string;
  weight?: number;
};

type ColorPreset = {
  id: string;
  hex: string;
};

const DEFAULT_FONT_SIZE = 48;
const DEFAULT_STROKE_WIDTH = 3;
const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 150;
const STROKE_WIDTH_MIN = 0;
const STROKE_WIDTH_MAX = 10;

const FONT_PRESETS: FontPreset[] = [
  {
    id: "inter",
    label: "Inter",
    family: "'Inter', system-ui, sans-serif",
    asset: "assets/fonts/Inter-400.woff2",
    weight: 400,
  },
  {
    id: "playfair",
    label: "Playfair Display",
    family: "'Playfair Display', Georgia, serif",
    asset: "assets/fonts/PlayfairDisplay-400.woff2",
    weight: 400,
  },
  {
    id: "bebas",
    label: "Bebas Neue",
    family: "'Bebas Neue', sans-serif",
    asset: "assets/fonts/BebasNeue-400.woff2",
    weight: 400,
  },
  {
    id: "cinzel-deco",
    label: "Cinzel Decorative",
    family: "'Cinzel Decorative', Georgia, serif",
    asset: "assets/fonts/CinzelDecorative-400.woff2",
    weight: 400,
  },
  {
    id: "orbitron",
    label: "Orbitron",
    family: "'Orbitron', sans-serif",
    asset: "assets/fonts/Orbitron-400.woff2",
    weight: 400,
  },
  {
    id: "vt323",
    label: "VT323",
    family: "'VT323', monospace",
    asset: "assets/fonts/VT323-400.woff2",
    weight: 400,
  },
  {
    id: "press-start",
    label: "Press Start 2P",
    family: "'Press Start 2P', monospace",
    asset: "assets/fonts/PressStart2P-400.woff2",
    weight: 400,
  },
  {
    id: "caveat",
    label: "Caveat",
    family: "'Caveat', cursive",
    asset: "assets/fonts/Caveat-400.woff2",
    weight: 400,
  },
  {
    id: "pacifico",
    label: "Pacifico",
    family: "'Pacifico', cursive",
    asset: "assets/fonts/Pacifico-400.woff2",
    weight: 400,
  },
  {
    id: "great-vibes",
    label: "Great Vibes",
    family: "'Great Vibes', cursive",
    asset: "assets/fonts/GreatVibes-400.woff2",
    weight: 400,
  },
  {
    id: "comic-neue",
    label: "Comic Neue",
    family: "'Comic Neue', cursive",
    asset: "assets/fonts/ComicNeue-400.woff2",
    weight: 400,
  },
  {
    id: "bangers",
    label: "Bangers",
    family: "'Bangers', cursive",
    asset: "assets/fonts/Bangers-400.woff2",
    weight: 400,
  },
  {
    id: "black-ops",
    label: "Black Ops One",
    family: "'Black Ops One', sans-serif",
    asset: "assets/fonts/BlackOpsOne-400.woff2",
    weight: 400,
  },
  {
    id: "rubik-glitch",
    label: "Rubik Glitch",
    family: "'Rubik Glitch', sans-serif",
    asset: "assets/fonts/RubikGlitch-400.woff2",
    weight: 400,
  },
  { id: "georgia", label: "Georgia", family: "Georgia, 'Times New Roman', serif" },
  { id: "courier", label: "Courier", family: "'Courier New', Courier, monospace" },
];

const TEXT_PRESET_COLORS: ColorPreset[] = [
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
const DEFAULT_STROKE_COLOR = TEXT_PRESET_COLORS[0]?.hex ?? "#000000";

@Component({
  selector: "cc-text-panel",
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
  templateUrl: "./text-panel.component.html",
  styleUrls: ["./text-panel.component.scss"],
})
export class TextPanelComponent {
  readonly history = inject(EditorHistoryService);
  readonly sampler = inject(EditorColorSamplerService);
  readonly ui = inject(EditorUiStateService);
  readonly textEdit = inject(EditorTextEditService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly subpanel = signal<TextSubpanel>("root");
  private lastSelectedId: string | null = null;

  readonly textLayers = computed(() => this.history.textLayers());
  readonly selectedTextId = computed(() => this.textEdit.selectedTextId());
  readonly selectedText = computed(() => {
    const id = this.selectedTextId();
    if (!id) return null;
    return this.textLayers().find((layer) => layer.id === id) ?? null;
  });
  readonly isEditing = computed(() => {
    const editingId = this.textEdit.editingTextId();
    return !!editingId;
  });
  readonly hasSelectedText = computed(() => !!this.selectedTextId());

  readonly activeFontId = computed(() => {
    const layer = this.selectedText();
    if (!layer) return null;
    const match = FONT_PRESETS.find((font) => font.family === layer.fontFamily);
    return match?.id ?? null;
  });

  readonly activeColorId = computed(() => {
    const layer = this.selectedText();
    if (!layer) return null;
    const current = this.normalizeHex(layer.fillColor);
    const match = TEXT_PRESET_COLORS.find(
      (preset) => preset.hex.toLowerCase() === current,
    );
    return match?.id ?? null;
  });

  readonly activeStrokeColorId = computed(() => {
    const layer = this.selectedText();
    if (!layer) return null;
    const current = this.normalizeHex(layer.strokeColor);
    const match = TEXT_PRESET_COLORS.find(
      (preset) => preset.hex.toLowerCase() === current,
    );
    return match?.id ?? null;
  });

  readonly fontSizeLabel = computed(() => {
    const size = this.selectedText()?.fontSizePx ?? DEFAULT_FONT_SIZE;
    return `${Math.round(size)}px`;
  });

  readonly strokeWidthLabel = computed(() => {
    const width = this.selectedText()?.strokeWidthPx ?? DEFAULT_STROKE_WIDTH;
    return `${Math.round(width)}px`;
  });

  private readonly loadingFonts = new Set<string>();

  sectionItems: ScrollableBarItem[] = this.buildSectionItems();
  fontItems: ScrollableBarItem[] = this.buildFontItems();
  colorItems: ScrollableBarItem[] = this.buildColorItems();
  strokeItems: ScrollableBarItem[] = this.buildStrokeItems();

  constructor() {
    addIcons({
      chevronBackOutline,
      eyedropOutline,
    });

    merge(
      this.translate.onLangChange as Observable<LangChangeEvent>,
      this.translate.onTranslationChange as Observable<TranslationChangeEvent>,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.sectionItems = this.buildSectionItems();
        this.strokeItems = this.buildStrokeItems();
      });

    effect(() => {
      const selectedId = this.selectedTextId();
      const editingId = this.textEdit.editingTextId();
      const panelOpen = this.ui.isPanelOpen();
      const isTextPanel =
        this.ui.panelMode() === "text" && this.ui.panelId() === "text";

      if (editingId || !panelOpen || !isTextPanel) {
        this.resetSubpanel();
      }

      if (selectedId !== this.lastSelectedId) {
        this.lastSelectedId = selectedId;
        this.resetSubpanel();
      }
    });
  }

  onAddText(): void {
    const content = this.translate.instant(
      "EDITOR.PANELS.TEXT.WIDGETS.TEXT_PANEL.DEFAULT.CONTENT",
    );

    const layer: TextLayer = {
      id: this.createTextId(),
      content,
      x: this.defaultX(),
      y: this.defaultY(),
      fontFamily: FONT_PRESETS[0]?.family ?? "'Inter', system-ui, sans-serif",
      fontSizePx: DEFAULT_FONT_SIZE,
      manualFontSizePx: DEFAULT_FONT_SIZE,
      fillColor: "#ffffff",
      strokeColor: DEFAULT_STROKE_COLOR,
      strokeWidthPx: DEFAULT_STROKE_WIDTH,
    };

    this.history.addTextLayer(layer);
    this.textEdit.selectText(layer.id);
    this.subpanel.set("root");
  }

  onSelectSection(id: string): void {
    if (!this.selectedText()) return;
    this.subpanel.set(id as TextSubpanel);
  }

  onSelectFont(id: string): void {
    const selectedId = this.selectedTextId();
    if (!selectedId) return;
    const match = FONT_PRESETS.find((font) => font.id === id);
    if (!match) return;
    this.history.setTextFontFamily(selectedId, match.family);
    void this.ensureFontLoaded(match);
  }

  onSelectColor(id: string): void {
    const selectedId = this.selectedTextId();
    if (!selectedId) return;
    const match = TEXT_PRESET_COLORS.find((preset) => preset.id === id);
    if (!match) return;
    this.history.setTextFillColor(selectedId, match.hex);
  }

  onSelectStrokeColor(id: string): void {
    const selectedId = this.selectedTextId();
    if (!selectedId) return;
    const match = TEXT_PRESET_COLORS.find((preset) => preset.id === id);
    if (!match) return;
    this.history.setTextStrokeColor(selectedId, match.hex);
  }

  onFontSizeChange(event: Event): void {
    const selectedId = this.selectedTextId();
    if (!selectedId) return;
    const value = (event as RangeCustomEvent).detail.value as number;
    if (!Number.isFinite(value)) return;
    this.history.setTextFontSize(selectedId, value);
  }

  onStrokeWidthChange(event: Event): void {
    const selectedId = this.selectedTextId();
    if (!selectedId) return;
    const value = (event as RangeCustomEvent).detail.value as number;
    if (!Number.isFinite(value)) return;
    this.history.setTextStrokeWidth(selectedId, value);
  }

  onSelectStrokeSection(id: string): void {
    this.subpanel.set(id as TextSubpanel);
  }

  startSampling(target: "fill" | "stroke"): void {
    if (!this.selectedText()) return;
    if (this.sampler.active()) return;
    const samplerTarget = target === "stroke" ? "text-stroke" : "text-fill";
    this.sampler.start(samplerTarget, { mode: "text", panelId: "text" });
    this.ui.closePanel();
  }

  onBack(): void {
    const current = this.subpanel();
    if (current === "strokeColor" || current === "strokeWidth") {
      this.subpanel.set("stroke");
      return;
    }
    this.subpanel.set("root");
  }

  private buildSectionItems(): ScrollableBarItem[] {
    const fontLabel = this.translate.instant(
      "EDITOR.PANELS.TEXT.WIDGETS.TEXT_PANEL.SECTION.FONT",
    );
    const colorLabel = this.translate.instant(
      "EDITOR.PANELS.TEXT.WIDGETS.TEXT_PANEL.SECTION.COLOR",
    );
    const strokeLabel = this.translate.instant(
      "EDITOR.PANELS.TEXT.WIDGETS.TEXT_PANEL.SECTION.STROKE",
    );
    const sizeLabel = this.translate.instant(
      "EDITOR.PANELS.TEXT.WIDGETS.TEXT_PANEL.SECTION.SIZE",
    );

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
      makeItem("font", fontLabel),
      makeItem("color", colorLabel),
      makeItem("stroke", strokeLabel),
      makeItem("size", sizeLabel),
    ];
  }

  private buildFontItems(): ScrollableBarItem[] {
    return FONT_PRESETS.map((font) => ({
      id: font.id,
      label: font.label,
      fontFamily: font.family,
    }));
  }

  private buildColorItems(): ScrollableBarItem[] {
    return TEXT_PRESET_COLORS.map((preset) => ({
      id: preset.id,
      label: preset.hex,
      type: "color",
      colorHex: preset.hex,
    }));
  }

  private buildStrokeItems(): ScrollableBarItem[] {
    const colorLabel = this.translate.instant(
      "EDITOR.PANELS.TEXT.WIDGETS.TEXT_PANEL.STROKE.COLOR",
    );
    const widthLabel = this.translate.instant(
      "EDITOR.PANELS.TEXT.WIDGETS.TEXT_PANEL.STROKE.WIDTH",
    );

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
      makeItem("strokeColor", colorLabel),
      makeItem("strokeWidth", widthLabel),
    ];
  }

  private normalizeHex(value: string | undefined): string {
    const trimmed = (value || "").trim();
    if (!trimmed) return "#000000";
    if (!trimmed.startsWith("#")) return `#${trimmed}`;
    return trimmed.toLowerCase();
  }

  private resetSubpanel(): void {
    if (this.subpanel() !== "root") {
      this.subpanel.set("root");
    }
  }

  private async ensureFontLoaded(font: FontPreset): Promise<void> {
    if (typeof document === "undefined") return;
    const fontSet = (document as any).fonts;
    if (!fontSet) return;

    const primary = this.extractPrimaryFont(font.family);
    if (!primary) return;

    try {
      if (fontSet.check?.(`12px "${primary}"`)) return;
    } catch {
      // ignore check failures
    }

    if (font.asset && typeof (globalThis as any).FontFace !== "undefined") {
      if (this.loadingFonts.has(primary)) return;
      this.loadingFonts.add(primary);

      try {
        const src = new URL(font.asset, document.baseURI).toString();
        const face = new (globalThis as any).FontFace(primary, `url(${src})`, {
          weight: String(font.weight ?? 400),
          style: "normal",
        });
        const loaded = await face.load();
        try {
          fontSet.add(loaded);
        } catch {
          // ignore duplicate add
        }
        return;
      } catch {
        // fall through to fontSet.load
      } finally {
        this.loadingFonts.delete(primary);
      }
    }

    if (!fontSet.load) return;
    try {
      await fontSet.load(`16px "${primary}"`);
    } catch {
      // ignore
    }
  }

  private extractPrimaryFont(fontFamily: string): string | null {
    const raw = (fontFamily || "").split(",")[0]?.trim();
    if (!raw) return null;
    return raw.replace(/^['"]|['"]$/g, "");
  }

  private createTextId(): string {
    const crypto = (globalThis as any)?.crypto;
    if (crypto?.randomUUID) {
      try {
        return crypto.randomUUID();
      } catch {
        // ignore and fallback
      }
    }
    return `text-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  }

  private defaultX(): number {
    const count = this.textLayers().length;
    const step = 0.04;
    const offset = (count % 5) * step;
    const dir = count % 2 === 0 ? 1 : -1;
    return this.clamp(0.5 + dir * offset, 0.1, 0.9);
  }

  private defaultY(): number {
    const count = this.textLayers().length;
    const step = 0.04;
    const offset = (count % 5) * step;
    const dir = count % 2 === 0 ? 1 : -1;
    return this.clamp(0.5 + dir * offset, 0.1, 0.9);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  protected readonly FONT_SIZE_MIN = FONT_SIZE_MIN;
  protected readonly FONT_SIZE_MAX = FONT_SIZE_MAX;
  protected readonly STROKE_WIDTH_MIN = STROKE_WIDTH_MIN;
  protected readonly STROKE_WIDTH_MAX = STROKE_WIDTH_MAX;
}
