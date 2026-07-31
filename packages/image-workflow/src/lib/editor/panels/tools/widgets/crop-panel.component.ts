import { Component, DestroyRef, effect, inject, signal } from "@angular/core";
import {
  LangChangeEvent,
  TranslateModule,
  TranslateService,
  TranslationChangeEvent,
} from "@ngx-translate/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonInput,
  IonLabel,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonIcon,
  IonNote,
  ToastController,
} from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import { chevronBackOutline } from "ionicons/icons";
import {
  ScrollableButtonBarComponent,
  type ScrollableBarItem,
} from "@sheldrapps/ui-theme";
import { EditorHistoryService } from "../../../editor-history.service";
import { EditorUiStateService } from "../../../editor-ui-state.service";
import { EditorKindleStateService } from "../../../editor-kindle-state.service";
import { EditorCropTargetStateService } from "../../../editor-crop-target-state.service";
import { EditorSessionService } from "../../../editor-session.service";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { merge, Observable } from "rxjs";
import { EDITOR_SESSION_ID } from "../../../editor-panel.tokens";
import type {
  KindleDeviceModel,
  KindleGroup,
} from "../../../editor-session.service";
import type {
  CropOrientation,
  CropTargetCategory,
  CropTargetPreset,
} from "../../../editor-crop-target.types";
import type { CropFormatOption } from "../../../../types";

type CropPanelView = "root" | "e-reader" | "publishing" | "paper" | "ratio";
type CropSelectInteraction =
  | "brand"
  | "group"
  | "model"
  | "target-parent"
  | "target-group"
  | "target-preset";

@Component({
  selector: "cc-crop-panel",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonGrid,
    IonRow,
    IonCol,
    IonItem,
    IonInput,
    IonLabel,
    IonButton,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonIcon,
    IonNote,
    ScrollableButtonBarComponent,
    TranslateModule,
  ],
  templateUrl: "./crop-panel.component.html",
  styleUrls: ["./crop-panel.component.scss"],
})
export class CropPanelComponent {
  private static readonly FORMAT_ID_WITH_FRAME = "with_frame";
  private static readonly FORMAT_ID_WITHOUT_FRAME = "without_frame";
  private static readonly FORMAT_ID_CUSTOM = "custom";
  private static readonly RATIO_CUSTOM_PRESET_ID = "custom_ratio";
  private static readonly CUSTOM_DIMENSION_MIN = 1;
  private static readonly CUSTOM_DIMENSION_MAX = 8192;
  private static readonly FRAME_NOT_DETECTED_MESSAGE =
    "Marco no detectado en el documento";

  private readonly history = inject(EditorHistoryService);
  private readonly ui = inject(EditorUiStateService);
  private readonly kindleState = inject(EditorKindleStateService);
  private readonly cropTargetState = inject(EditorCropTargetStateService);
  private readonly editorSession = inject(EditorSessionService, {
    optional: true,
  });
  private readonly toastCtrl = inject(ToastController);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sid = inject(EDITOR_SESSION_ID, { optional: true });

  readonly activeView = signal<CropPanelView>("root");

  kindleGroups: KindleGroup[] = [];
  brands: Array<{ id: string; i18nKey: string; groups: KindleGroup[] }> = [];
  visibleGroups: KindleGroup[] = [];
  selectedBrandId?: string;
  selectedGroupId?: string;
  selectedModel?: KindleDeviceModel;
  modelSelectionEditing = false;

  formatOptions: CropFormatOption[] = [];
  selectedFormatId?: string;
  formatItems: ScrollableBarItem[] = [];
  categoryItems: ScrollableBarItem[] = [];
  eReaderFormatItems: ScrollableBarItem[] = [];
  ratioFormatItems: ScrollableBarItem[] = [];
  ratioCustomWidthInput = String(CropPanelComponent.CUSTOM_DIMENSION_MIN);
  ratioCustomHeightInput = String(CropPanelComponent.CUSTOM_DIMENSION_MIN);
  customWidthInput = String(CropPanelComponent.CUSTOM_DIMENSION_MIN);
  customHeightInput = String(CropPanelComponent.CUSTOM_DIMENSION_MIN);
  private customWidth = CropPanelComponent.CUSTOM_DIMENSION_MIN;
  private customHeight = CropPanelComponent.CUSTOM_DIMENSION_MIN;
  private ratioCustomWidth = CropPanelComponent.CUSTOM_DIMENSION_MIN;
  private ratioCustomHeight = CropPanelComponent.CUSTOM_DIMENSION_MIN;
  private restoredCategorySessionId: string | null = null;
  private activeSelectInteraction: CropSelectInteraction | null = null;
  private selectInteractionChanged = false;
  private selectInteractionCanceled = false;

  constructor() {
    addIcons({ chevronBackOutline });
    this.rebuildCategoryItems();
    effect(() => {
      const tools = this.ui.toolsConfig();
      const formats = tools?.formats?.options ?? [];
      const selectedId =
        tools?.formats?.selectedId ?? formats[0]?.id ?? undefined;

      this.formatOptions = formats;
      this.selectedFormatId = selectedId;
      this.rebuildFormatItems();
      this.rebuildCategoryItems();
      this.syncCustomFormatInputs();
    });

    effect(() => {
      this.kindleGroups = this.kindleState.catalog();
      this.selectedGroupId = this.kindleState.selectedGroupId() ?? undefined;
      this.selectedModel = this.kindleState.selectedModel() ?? undefined;
      this.brands = this.buildBrands(this.kindleGroups);
      this.selectedBrandId = this.resolveSelectedBrandId();
      this.visibleGroups = this.getGroupsForBrand(this.selectedBrandId);
      this.modelSelectionEditing = !this.hasCompleteModelSelection;
      this.rebuildCategoryItems();
    });

    effect(() => {
      const sessionId = this.ui.sessionId();
      const category = this.cropTargetState.activeCategory();
      const selectedPreset = this.cropTargetState.selectedPreset();

      // Restore the persisted subpanel only once per editor session. Reading
      // activeView() here would make goRoot() immediately reopen the same
      // subpanel because the persisted selection remains unchanged.
      if (
        sessionId &&
        selectedPreset &&
        this.restoredCategorySessionId !== sessionId
      ) {
        this.restoredCategorySessionId = sessionId;
        if (category !== "e-reader") {
          this.activeView.set(category);
        }
      }
    });

    effect(() => {
      const selection = this.cropTargetState.selectedPreset();
      if (selection?.presetId !== CropPanelComponent.RATIO_CUSTOM_PRESET_ID) {
        return;
      }

      this.ratioCustomWidth = this.normalizeCustomDimension(selection.width);
      this.ratioCustomHeight = this.normalizeCustomDimension(selection.height);
      this.ratioCustomWidthInput = String(this.ratioCustomWidth);
      this.ratioCustomHeightInput = String(this.ratioCustomHeight);
    });

    effect(() => {
      const sessionId = this.ui.sessionId();
      if (!sessionId && this.restoredCategorySessionId !== null) {
        this.restoredCategorySessionId = null;
      }
    });

    merge(
      this.translate.onLangChange as Observable<LangChangeEvent>,
      this.translate.onTranslationChange as Observable<TranslationChangeEvent>,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.rebuildCategoryItems());
  }

  get usesCategoryNavigation(): boolean {
    return this.ui.toolsConfig()?.formatNavigation === "categories";
  }

  get activeViewTitleKey(): string {
    switch (this.activeView()) {
      case "e-reader":
        return "EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.CATEGORIES.E_READERS";
      case "publishing":
        return "EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.CATEGORIES.PUBLISHING";
      case "paper":
        return "EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.CATEGORIES.PAPER";
      case "ratio":
        return "EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.CATEGORIES.RATIO";
      default:
        return "";
    }
  }

  get activeSubpanelFormatItems(): ScrollableBarItem[] {
    return this.activeView() === "ratio"
      ? this.ratioFormatItems
      : this.eReaderFormatItems;
  }

  get targetParents(): Array<{ id: string; i18nKey: string }> {
    return this.cropTargetState.visibleParents();
  }

  get targetGroups() {
    return this.cropTargetState.visibleGroups();
  }

  get targetPresets(): CropTargetPreset[] {
    return this.cropTargetState.visiblePresets();
  }

  get selectedTargetParentId(): string | null {
    return this.cropTargetState.selectedParentId();
  }

  get selectedTargetGroupId(): string | null {
    return this.cropTargetState.selectedGroupId();
  }

  get selectedTargetPreset(): CropTargetPreset | null {
    const selection = this.cropTargetState.selectedPreset();
    if (!selection) return null;
    return this.targetPresets.find((preset) => preset.id === selection.presetId) ?? null;
  }

  get targetOrientation(): CropOrientation {
    return this.cropTargetState.orientation();
  }

  get targetCategory(): CropTargetCategory {
    return this.cropTargetState.activeCategory();
  }

  get showTargetParentSelector(): boolean {
    return this.targetParents.length > 1;
  }

  get showTargetGroupSelector(): boolean {
    return this.targetGroups.length > 1 || this.targetCategory === "publishing";
  }

  get showTargetOrientation(): boolean {
    return this.cropTargetState.canSelectOrientation();
  }

  get showCustomRatioInputs(): boolean {
    return (
      this.activeView() === "ratio" &&
      this.selectedTargetPreset?.id === CropPanelComponent.RATIO_CUSTOM_PRESET_ID
    );
  }

  getTargetLabel(preset: CropTargetPreset): string {
    const translated = this.translate.instant(preset.i18nKey);
    const dimensions =
      preset.unit === "ratio"
        ? `${preset.width}:${preset.height}`
        : `${preset.width} × ${preset.height} ${preset.unit}`;
    const label = translated.includes(String(preset.width))
      ? translated
      : `${translated} · ${dimensions}`;
    const badge = preset.badgeI18nKey
      ? ` · ${this.translate.instant(preset.badgeI18nKey)}`
      : "";
    return `${label}${badge}`;
  }

  comparePresets(
    first: CropTargetPreset | null | undefined,
    second: CropTargetPreset | null | undefined,
  ): boolean {
    return first && second ? first.id === second.id : first === second;
  }

  get hasKindleCatalog(): boolean {
    return this.kindleGroups.length > 0;
  }

  openView(view: string): void {
    if (["e-reader", "publishing", "paper", "ratio"].includes(view)) {
      const category = view as CropTargetCategory;
      this.cropTargetState.setActiveCategory(category);
      this.activeView.set(category);
    }
  }

  goRoot(): void {
    this.activeView.set("root");
  }

  get hasFormatOptions(): boolean {
    return this.formatOptions.length > 1;
  }

  get showCustomInputs(): boolean {
    return this.selectedFormatId === CropPanelComponent.FORMAT_ID_CUSTOM;
  }

  get customDimensionMin(): number {
    return CropPanelComponent.CUSTOM_DIMENSION_MIN;
  }

  get customDimensionMax(): number {
    return CropPanelComponent.CUSTOM_DIMENSION_MAX;
  }

  get shouldUseFrameSwitch(): boolean {
    if (this.formatOptions.length !== 2) {
      return false;
    }

    const ids = new Set(this.formatOptions.map((opt) => opt.id));
    return (
      ids.has(CropPanelComponent.FORMAT_ID_WITH_FRAME) &&
      ids.has(CropPanelComponent.FORMAT_ID_WITHOUT_FRAME)
    );
  }

  get frameSwitchChecked(): boolean {
    return this.selectedFormatId === CropPanelComponent.FORMAT_ID_WITH_FRAME;
  }

  get frameWithDisabled(): boolean {
    return !!this.formatOptions.find(
      (opt) => opt.id === CropPanelComponent.FORMAT_ID_WITH_FRAME,
    )?.disabled;
  }

  get frameWithLabel(): string {
    return (
      this.formatOptions.find(
        (opt) => opt.id === CropPanelComponent.FORMAT_ID_WITH_FRAME,
      )?.label ?? CropPanelComponent.FORMAT_ID_WITH_FRAME
    );
  }

  get frameWithoutLabel(): string {
    return (
      this.formatOptions.find(
        (opt) => opt.id === CropPanelComponent.FORMAT_ID_WITHOUT_FRAME,
      )?.label ?? CropPanelComponent.FORMAT_ID_WITHOUT_FRAME
    );
  }

  getSelectedFormatOption(): CropFormatOption | undefined {
    return this.formatOptions.find((opt) => opt.id === this.selectedFormatId);
  }

  getCustomFormatOption(): CropFormatOption | undefined {
    return this.formatOptions.find(
      (opt) => opt.id === CropPanelComponent.FORMAT_ID_CUSTOM,
    );
  }

  get currentGroupModels(): KindleDeviceModel[] {
    if (!this.selectedGroupId) return [];
    const group = this.visibleGroups.find((g) => g.id === this.selectedGroupId);
    return this.getGroupModels(group);
  }

  get selectedBrand(): { id: string; i18nKey: string; groups: KindleGroup[] } | undefined {
    return this.brands.find((brand) => brand.id === this.selectedBrandId);
  }

  get selectedGroup(): KindleGroup | undefined {
    return this.visibleGroups.find((group) => group.id === this.selectedGroupId);
  }

  get hasCompleteModelSelection(): boolean {
    return !!this.selectedBrandId && !!this.selectedGroupId && !!this.selectedModel;
  }

  get showModelSelectionSummary(): boolean {
    return this.hasCompleteModelSelection && !this.modelSelectionEditing;
  }

  compareModels(
    m1: KindleDeviceModel | undefined,
    m2: KindleDeviceModel | undefined,
  ): boolean {
    return m1 && m2 ? m1.id === m2.id : m1 === m2;
  }

  onBrandChange(): void {
    this.markSelectInteractionChanged("brand");
    this.visibleGroups = this.getGroupsForBrand(this.selectedBrandId);
    const firstGroup = this.visibleGroups[0];
    const firstModel = this.getGroupModels(firstGroup)[0];
    if (!firstGroup || !firstModel) {
      return;
    }

    this.selectedGroupId = firstGroup.id;
    this.selectedModel = firstModel;
  }

  onGroupChange(): void {
    this.markSelectInteractionChanged("group");
    if (this.selectedGroupId) {
      const group = this.visibleGroups.find(
        (g) => g.id === this.selectedGroupId,
      );
      const models = this.getGroupModels(group);
      if (models.length > 0) {
        this.selectedModel = models[0];
      }
    }
  }

  onModelChange(): void {
    this.markSelectInteractionChanged("model");
    if (!this.selectedModel) return;
    this.history.setKindleModel(this.selectedGroupId, this.selectedModel.id);
    this.modelSelectionEditing = false;
  }

  onTargetParentChange(parentId: string): void {
    this.markSelectInteractionChanged("target-parent");
    this.cropTargetState.selectParent(parentId);
  }

  onTargetGroupChange(groupId: string): void {
    this.markSelectInteractionChanged("target-group");
    this.cropTargetState.selectGroup(groupId);
  }

  onTargetPresetChange(presetId: string): void {
    this.markSelectInteractionChanged("target-preset");
    this.cropTargetState.selectPreset(presetId);
  }

  onTargetOrientationChange(orientation: CropOrientation): void {
    this.cropTargetState.setOrientation(orientation);
  }

  onRatioCustomWidthChange(event: CustomEvent<{ value?: string | number | null }>): void {
    this.updateRatioCustomDimension("width", event.detail?.value);
  }

  onRatioCustomHeightChange(event: CustomEvent<{ value?: string | number | null }>): void {
    this.updateRatioCustomDimension("height", event.detail?.value);
  }

  openModelSelectionEditor(): void {
    this.modelSelectionEditing = true;
  }

  async onFormatSelect(id: string): Promise<void> {
    if (!id) return;
    const selected = this.formatOptions.find((opt) => opt.id === id);
    if (!selected) return;
    if (selected.disabled) {
      await this.showFrameNotDetectedToast();
      return;
    }

    if (selected.id === CropPanelComponent.FORMAT_ID_CUSTOM) {
      this.syncCustomFormatInputs();
    }

    this.applySelectedFormat(selected);
  }

  beginSelectInteraction(kind: CropSelectInteraction): void {
    this.activeSelectInteraction = kind;
    this.selectInteractionChanged = false;
    this.selectInteractionCanceled = false;
  }

  cancelSelectInteraction(kind: CropSelectInteraction): void {
    if (this.activeSelectInteraction !== kind) return;
    this.selectInteractionCanceled = true;
  }

  finishSelectInteraction(kind: CropSelectInteraction): void {
    if (this.activeSelectInteraction !== kind) return;

    const shouldReapply =
      !this.selectInteractionChanged && !this.selectInteractionCanceled;
    this.activeSelectInteraction = null;
    this.selectInteractionChanged = false;
    this.selectInteractionCanceled = false;

    if (shouldReapply) {
      this.reapplySelectInteraction(kind);
    }
  }

  async onFrameSwitchChange(event: CustomEvent<{ checked: boolean }>): Promise<void> {
    const checked = !!event.detail?.checked;
    const id = checked
      ? CropPanelComponent.FORMAT_ID_WITH_FRAME
      : CropPanelComponent.FORMAT_ID_WITHOUT_FRAME;
    await this.onFormatSelect(id);
  }

  onCustomWidthChange(event: CustomEvent<{ value?: string | number | null }>): void {
    this.updateCustomDimension("width", event.detail?.value);
  }

  onCustomHeightChange(event: CustomEvent<{ value?: string | number | null }>): void {
    this.updateCustomDimension("height", event.detail?.value);
  }

  private async showFrameNotDetectedToast(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: CropPanelComponent.FRAME_NOT_DETECTED_MESSAGE,
      position: "middle",
      duration: 1800,
      cssClass: ["cc-toast", "cc-toast--info"],
      animated: true,
      translucent: true,
    });
    await toast.present();
  }

  private getSession() {
    if (!this.editorSession || !this.sid) return null;
    return this.editorSession.getSession(this.sid);
  }

  private getSessionTarget(): { width: number; height: number } | null {
    const session = this.getSession();
    return session?.target ?? null;
  }

  private syncCustomFormatInputs(): void {
    const custom = this.getCustomFormatOption();
    const target = custom?.target ?? this.getSessionTarget();
    const width = this.normalizeCustomDimension(
      target?.width ?? this.customWidth,
    );
    const height = this.normalizeCustomDimension(
      target?.height ?? this.customHeight,
    );

    this.customWidth = width;
    this.customHeight = height;
    this.customWidthInput = String(width);
    this.customHeightInput = String(height);
  }

  private applySelectedFormat(selected: CropFormatOption): void {
    const nextFormats = {
      options: this.formatOptions,
      selectedId: selected.id,
    };
    const current = this.ui.toolsConfig();
    const nextConfig = current
      ? { ...current, formats: nextFormats }
      : { formats: nextFormats };

    this.selectedFormatId = selected.id;
    this.rebuildFormatItems();

    this.ui.setToolsConfig(nextConfig);

    const session = this.getSession();
    if (session) {
      session.tools = session.tools ?? {};
      session.tools.formats = session.tools.formats ?? nextFormats;
      session.tools.formats.options = this.formatOptions;
      session.tools.formats.selectedId = selected.id;
      session.target = {
        width: selected.target.width,
        height: selected.target.height,
      };
    }

    this.history.resetViewToCover();
  }

  private markSelectInteractionChanged(kind: CropSelectInteraction): void {
    if (this.activeSelectInteraction === kind) {
      this.selectInteractionChanged = true;
    }
  }

  private reapplySelectInteraction(kind: CropSelectInteraction): void {
    switch (kind) {
      case "brand":
        this.onBrandChange();
        return;
      case "group":
        this.onGroupChange();
        return;
      case "model":
        this.onModelChange();
        return;
      case "target-parent":
      case "target-group":
      case "target-preset":
        this.cropTargetState.reapplySelection();
        return;
    }
  }

  private rebuildCategoryItems(): void {
    const makeItem = (id: CropPanelView, key: string): ScrollableBarItem => ({
      id,
      label: this.translate.instant(key),
    });

    const configured = this.cropTargetState.catalogByCategory();
    const hasConfiguredTargets = Object.keys(configured).length > 0;
    const categories: Array<[Exclude<CropPanelView, "root">, string]> = [
      [
        "e-reader",
        "EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.CATEGORIES.E_READERS",
      ],
      [
        "publishing",
        "EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.CATEGORIES.PUBLISHING",
      ],
      ["paper", "EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.CATEGORIES.PAPER"],
      ["ratio", "EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.CATEGORIES.RATIO"],
    ];

    this.categoryItems = categories
      .filter(([id]) => {
        if (!hasConfiguredTargets) return true;
        if (id === "e-reader") {
          return this.hasKindleCatalog || !!configured["e-reader"];
        }
        return !!configured[id];
      })
      .map(([id, key]) => makeItem(id, key));
  }

  private rebuildFormatItems(): void {
    const toItems = (formats: CropFormatOption[]): ScrollableBarItem[] =>
      formats.map((format) => ({ id: format.id, label: format.label }));

    this.formatItems = toItems(this.formatOptions);
    this.eReaderFormatItems = toItems(
      this.formatOptions.filter((option) =>
        ["epub", "kobo"].includes(option.id),
      ),
    );
    this.ratioFormatItems = toItems(
      this.formatOptions.filter((option) =>
        ["three_four", "nine_sixteen"].includes(option.id),
      ),
    );
  }

  private updateCustomDimension(
    dimension: "width" | "height",
    rawValue: string | number | null | undefined,
  ): void {
    const parsed = this.parseCustomDimension(rawValue);
    if (parsed === null) {
      this.resetCustomInputValue(dimension);
      return;
    }

    if (dimension === "width") {
      this.customWidth = parsed;
      this.customWidthInput = String(parsed);
    } else {
      this.customHeight = parsed;
      this.customHeightInput = String(parsed);
    }

    this.applyCustomFormatDimensions();
  }

  private updateRatioCustomDimension(
    dimension: "width" | "height",
    rawValue: string | number | null | undefined,
  ): void {
    const parsed = this.parseCustomDimension(rawValue);
    if (parsed === null) {
      this.resetRatioCustomInputValue(dimension);
      return;
    }

    if (dimension === "width") {
      this.ratioCustomWidth = parsed;
      this.ratioCustomWidthInput = String(parsed);
    } else {
      this.ratioCustomHeight = parsed;
      this.ratioCustomHeightInput = String(parsed);
    }

    this.cropTargetState.updateCustomPresetDimensions(
      CropPanelComponent.RATIO_CUSTOM_PRESET_ID,
      this.ratioCustomWidth,
      this.ratioCustomHeight,
    );
  }

  private applyCustomFormatDimensions(): void {
    const custom = this.getCustomFormatOption();
    if (!custom) return;

    const nextTarget = {
      ...custom.target,
      width: this.customWidth,
      height: this.customHeight,
    };
    const nextCustomOption: CropFormatOption = {
      ...custom,
      target: nextTarget,
    };

    this.formatOptions = this.formatOptions.map((option) =>
      option.id === custom.id ? nextCustomOption : option,
    );

    this.syncCustomFormatInputs();
    this.applySelectedFormat(nextCustomOption);
  }

  private resetCustomInputValue(dimension: "width" | "height"): void {
    if (dimension === "width") {
      this.customWidthInput = String(this.customWidth);
      return;
    }

    this.customHeightInput = String(this.customHeight);
  }

  private resetRatioCustomInputValue(dimension: "width" | "height"): void {
    if (dimension === "width") {
      this.ratioCustomWidthInput = String(this.ratioCustomWidth);
      return;
    }

    this.ratioCustomHeightInput = String(this.ratioCustomHeight);
  }

  private parseCustomDimension(
    rawValue: string | number | null | undefined,
  ): number | null {
    if (typeof rawValue === "number") {
      return Number.isInteger(rawValue)
        ? this.normalizeCustomDimension(rawValue)
        : null;
    }

    if (typeof rawValue !== "string") {
      return null;
    }

    const trimmed = rawValue.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      return null;
    }

    return this.normalizeCustomDimension(Number(trimmed));
  }

  private normalizeCustomDimension(value: number): number {
    const integerValue = Math.trunc(value);
    if (Number.isNaN(integerValue) || !Number.isFinite(integerValue)) {
      return CropPanelComponent.CUSTOM_DIMENSION_MIN;
    }

    return Math.min(
      Math.max(integerValue, CropPanelComponent.CUSTOM_DIMENSION_MIN),
      CropPanelComponent.CUSTOM_DIMENSION_MAX,
    );
  }

  private getGroupModels(group?: KindleGroup): KindleDeviceModel[] {
    if (!group) return [];
    return group.items ?? group.models ?? [];
  }

  private buildBrands(
    groups: KindleGroup[],
  ): Array<{ id: string; i18nKey: string; groups: KindleGroup[] }> {
    const brandMap = new Map<
      string,
      { id: string; i18nKey: string; groups: KindleGroup[] }
    >();

    for (const group of groups) {
      const brandId = group.brandId?.trim() || "kindle";
      const existing = brandMap.get(brandId);
      if (existing) {
        existing.groups.push(group);
        continue;
      }

      brandMap.set(brandId, {
        id: brandId,
        i18nKey: this.getBrandI18nKey(brandId),
        groups: [group],
      });
    }

    return Array.from(brandMap.values());
  }

  private getGroupsForBrand(brandId?: string): KindleGroup[] {
    if (!brandId) {
      return [];
    }

    return this.brands.find((brand) => brand.id === brandId)?.groups ?? [];
  }

  private resolveSelectedBrandId(): string | undefined {
    const selectedGroup = this.kindleGroups.find(
      (group) => group.id === this.selectedGroupId,
    );
    const sessionBrandId =
      this.getSession()?.tools?.kindle?.selectedBrandId?.trim() || undefined;

    return selectedGroup?.brandId ?? sessionBrandId ?? this.brands[0]?.id;
  }

  private getBrandI18nKey(brandId: string): string {
    switch (brandId) {
      case "kindle":
        return "KINDLE_BRANDS.KINDLE";
      case "kobo":
        return "KOBO_BRANDS.KOBO";
      case "nook":
        return "NOOK_BRANDS.NOOK";
      case "pocketbook":
        return "POCKETBOOK_BRANDS.POCKETBOOK";
      case "tolino":
        return "TOLINO_BRANDS.TOLINO";
      default:
        return `DEVICE_BRANDS.${brandId.toUpperCase()}`;
    }
  }
}

