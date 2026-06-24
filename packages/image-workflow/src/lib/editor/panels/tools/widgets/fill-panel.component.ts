import {
  Component,
  computed,
  inject,
  signal,
  DestroyRef,
} from "@angular/core";
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
import { EditorSessionService } from "../../../editor-session.service";
import { EDITOR_SESSION_ID } from "../../../editor-panel.tokens";
import { EditorBackgroundCatalogService } from "../../../editor-background-catalog.service";
import {
  getBackgroundAssetPath,
  type
  BackgroundMode,
  FitBackgroundConfig,
  BackgroundCatalogItem,
} from "../../../../types";

type FillPanelView = "root" | "blur" | "colors" | "picker" | "backgrounds";
type ColorSource = "picker" | "colors";

type FillPreset = {
  id: string;
  hex: string;
};

const DEFAULT_BLUR = 80;
const DEFAULT_BACKGROUND_SCALE = 1;
const MIN_BACKGROUND_SCALE = 0.25;
const MAX_BACKGROUND_SCALE = 4;
const DEFAULT_BACKGROUND_OFFSET = 0;

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
  private readonly backgroundCatalog = inject(EditorBackgroundCatalogService);
  private readonly editorSession = inject(EditorSessionService, {
    optional: true,
  });
  private readonly sid = inject(EDITOR_SESSION_ID, { optional: true });
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeView = signal<FillPanelView>("root");
  readonly lastColorSource = signal<ColorSource>("colors");

  readonly mode = computed<BackgroundMode>(
    () => this.history.backgroundMode() ?? "transparent",
  );
  readonly color = computed(() => this.history.backgroundColor());
  readonly blur = computed(() => this.history.backgroundBlur() ?? DEFAULT_BLUR);
  readonly background = computed(() => this.history.backgroundPattern());
  readonly backgrounds = signal<BackgroundCatalogItem[]>([]);
  readonly backgroundScale = computed(() =>
    this.normalizeBackgroundScale(this.background()?.scale),
  );
  readonly activeColorId = computed(() => {
    const current = this.normalizeHex(this.color());
    const match = this.presets.find(
      (preset) => preset.hex.toLowerCase() === current,
    );
    return match?.id ?? null;
  });
  readonly activeBackgroundId = computed(() => this.background()?.textureId ?? null);
  readonly hasBackgroundCatalog = computed(() => this.backgrounds().length > 0);

  readonly activeItem = computed(() => {
    const mode = this.mode();
    if (mode === "transparent") return "none";
    if (mode === "blur") return "same-image";
    if (mode === "background" || mode === "texture") return "backgrounds";
    return this.lastColorSource() === "picker" ? "picker" : "colors";
  });
  readonly isScratchSession = computed(() => {
    if (!this.editorSession || !this.sid) return false;
    return this.editorSession.getSession(this.sid)?.sourceMode === "scratch";
  });
  readonly hasVisibleSampleTarget = computed(() => {
    if (!this.isScratchSession()) return true;
    if (this.mode() !== "transparent") return true;
    if (this.history.textLayers().length > 0) return true;
    return false;
  });
  readonly eyedropperEnabled = computed(() => {
    if (!this.isScratchSession()) return true;
    return this.hasVisibleSampleTarget();
  });
  readonly disabledToolIds = computed(() => {
    const disabled: string[] = [];
    if (this.isScratchSession()) {
      disabled.push("none");
      disabled.push("same-image");
    }
    if (!this.eyedropperEnabled()) {
      disabled.push("picker");
    }
    if (!this.hasBackgroundCatalog()) {
      disabled.push("backgrounds");
    }
    return disabled;
  });

  presets = FILL_PRESET_COLORS;
  toolItems: ScrollableBarItem[] = this.buildToolItems();
  colorItems: ScrollableBarItem[] = this.buildColorItems();
  backgroundItems: ScrollableBarItem[] = [];
  private readonly backgroundSvgMap = signal<Record<string, string>>({});

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
        this.backgroundItems = this.buildBackgroundItems(this.backgrounds());
      });

    void this.loadBackgrounds();
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
    const backgroundsLabel = this.translate.instant(
      "EDITOR.PANELS.TOOLS.WIDGETS.FILL_PANEL.TAB.BACKGROUNDS",
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
      makeItem("backgrounds", backgroundsLabel, "image-outline"),
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

  private buildBackgroundItems(items: BackgroundCatalogItem[]): ScrollableBarItem[] {
    const svgMap = this.backgroundSvgMap();
    return items.map((item) => ({
      id: item.id,
      label: item.label,
      type: "default",
      svg: svgMap[item.id],
      icon: svgMap[item.id] ? undefined : "image-outline",
    }));
  }

  onSelectTool(id: string): void {
    switch (id) {
      case "none":
        this.setTransparent();
        this.activeView.set("root");
        return;
      case "same-image":
        if (this.isScratchSession()) return;
        this.setBlur();
        this.activeView.set("blur");
        return;
      case "picker":
        if (!this.eyedropperEnabled()) return;
        this.lastColorSource.set("picker");
        this.activeView.set("picker");
        this.startSampling();
        return;
      case "colors":
        this.lastColorSource.set("colors");
        this.activeView.set("colors");
        return;
      case "backgrounds":
        if (!this.hasBackgroundCatalog()) return;
        this.activeView.set("backgrounds");
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
    this.sampler.start("background", { mode: "tools", panelId: "fill" });
  }

  onSelectColor(id: string): void {
    const match = this.presets.find((preset) => preset.id === id);
    if (!match) return;
    this.setColor(match.hex);
    this.activeView.set("colors");
  }

  onSelectBackground(id: string): void {
    const background = this.backgrounds().find((item) => item.id === id);
    if (!background) return;
    this.history.setBackground({
      mode: "background",
      color: this.color(),
      background: this.buildBackgroundConfig(background),
    });
    this.activeView.set("backgrounds");
  }

  onBackgroundScaleChange(event: Event): void {
    const value = (event as RangeCustomEvent).detail.value as number;
    if (!Number.isFinite(value)) return;
    const activeId = this.activeBackgroundId();
    if (!activeId) return;
    const background = this.backgrounds().find((item) => item.id === activeId);
    if (!background) return;
    this.history.setBackground({
      mode: "background",
      color: this.color(),
      background: {
        ...this.buildBackgroundConfig(background),
        scale: this.normalizeBackgroundScale(value),
      },
    });
  }

  goRoot(): void {
    this.activeView.set("root");
  }

  private async loadBackgrounds(): Promise<void> {
    const backgrounds = await this.backgroundCatalog.listEnabled();
    const svgMap = await this.loadBackgroundSvgs(backgrounds);
    this.backgroundSvgMap.set(svgMap);
    this.backgrounds.set(backgrounds);
    this.backgroundItems = this.buildBackgroundItems(backgrounds);
    if (!backgrounds.length) return;
    if (this.mode() !== "background") return;
    if (this.activeBackgroundId()) return;
    const first = backgrounds[0];
    this.history.setBackground({
      mode: "background",
      color: this.color(),
      background: this.buildBackgroundConfig(first),
    });
  }

  private buildBackgroundConfig(background: BackgroundCatalogItem): FitBackgroundConfig {
    const current = this.background();
    const sameBackground = current?.textureId === background.id;
    return {
      textureId: background.id,
      file: background.file,
      intensity: 1,
      scale: sameBackground && Number.isFinite(current?.scale)
        ? this.normalizeBackgroundScale(current!.scale)
        : DEFAULT_BACKGROUND_SCALE,
      offsetX: sameBackground && Number.isFinite(current?.offsetX)
        ? (current!.offsetX as number)
        : DEFAULT_BACKGROUND_OFFSET,
      offsetY: sameBackground && Number.isFinite(current?.offsetY)
        ? (current!.offsetY as number)
        : DEFAULT_BACKGROUND_OFFSET,
    };
  }

  private async loadBackgroundSvgs(
    items: BackgroundCatalogItem[],
  ): Promise<Record<string, string>> {
    const entries = await Promise.all(
      items.map(async (item) => {
        try {
          const response = await fetch(getBackgroundAssetPath({ file: item.file }), {
            cache: "force-cache",
          });
          if (!response.ok) return [item.id, null] as const;
          const raw = (await response.text()).replace(/^\uFEFF/, "").trim();
          if (!/<svg[\s>]/i.test(raw)) return [item.id, null] as const;
          return [item.id, raw] as const;
        } catch {
          return [item.id, null] as const;
        }
      }),
    );

    const map: Record<string, string> = {};
    for (const [id, svg] of entries) {
      if (svg) map[id] = svg;
    }
    return map;
  }

  private normalizeHex(value: string | undefined): string {
    const trimmed = (value || "").trim();
    if (!trimmed) return "#000000";
    if (!trimmed.startsWith("#")) return `#${trimmed}`;
    return trimmed.toLowerCase();
  }

  private normalizeBackgroundScale(value: number | undefined): number {
    if (!Number.isFinite(value)) return DEFAULT_BACKGROUND_SCALE;
    return this.clamp(value as number, MIN_BACKGROUND_SCALE, MAX_BACKGROUND_SCALE);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
