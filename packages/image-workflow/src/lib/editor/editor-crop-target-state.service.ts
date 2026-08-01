import { Injectable, computed, signal } from "@angular/core";
import type { EditorToolsConfig } from "./editor-session.service";
import {
  type CropOrientation,
  type CropTargetCategory,
  type CropTargetCategoryConfig,
  type CropTargetGroup,
  type CropTargetPreset,
  type CropTargetSelection,
  type CropTargetsConfig,
  type EffectiveCropTarget,
  type PersistedCropTargetSelection,
} from "./editor-crop-target.types";

type CategoryConfigMap = Partial<
  Record<CropTargetCategory, CropTargetCategoryConfig>
>;
type SelectionMap = Partial<
  Record<CropTargetCategory, CropTargetSelection>
>;

const CATEGORIES: CropTargetCategory[] = [
  "e-reader",
  "publishing",
  "pdf-original",
  "paper",
  "books",
  "presentation",
  "ratio",
];

@Injectable({ providedIn: "root" })
export class EditorCropTargetStateService {
  private readonly configsSig = signal<CategoryConfigMap>({});
  private readonly selectionsSig = signal<SelectionMap>({});
  private readonly activeCategorySig = signal<CropTargetCategory>("e-reader");
  private tools?: EditorToolsConfig;

  readonly activeCategory = this.activeCategorySig.asReadonly();
  readonly catalogByCategory = this.configsSig.asReadonly();
  readonly selectionsByCategory = this.selectionsSig.asReadonly();

  readonly currentConfig = computed(
    () => this.configsSig()[this.activeCategorySig()],
  );

  readonly selectedParentId = computed(
    () => this.selectionsSig()[this.activeCategorySig()]?.parentId ?? null,
  );

  readonly selectedGroupId = computed(
    () => this.selectionsSig()[this.activeCategorySig()]?.groupId ?? null,
  );

  readonly selectedPreset = computed(
    () => this.selectionsSig()[this.activeCategorySig()] ?? null,
  );

  readonly orientation = computed(
    () =>
      this.selectionsSig()[this.activeCategorySig()]?.orientation ??
      this.currentConfig()?.defaultOrientation ??
      "portrait",
  );

  readonly visibleParents = computed(() => {
    const groups = this.currentConfig()?.catalog ?? [];
    return this.buildParents(groups);
  });

  readonly visibleGroups = computed(() => {
    const parentId = this.selectedParentId();
    return (this.currentConfig()?.catalog ?? []).filter(
      (group) => !parentId || group.parentId === parentId,
    );
  });

  readonly visiblePresets = computed(() => {
    const groupId = this.selectedGroupId();
    return (
      this.visibleGroups().find((group) => group.id === groupId)?.items ?? []
    );
  });

  readonly selection = computed(() => this.selectedPreset());

  readonly effectiveTarget = computed<EffectiveCropTarget | null>(() => {
    const preset = this.selectedPreset();
    if (!preset) return null;

    const orientation = this.orientation();
    const canRotate =
      this.currentConfig()?.supportsOrientation === true &&
      this.activeCategorySig() !== "publishing" &&
      preset.width !== preset.height;
    const swap = canRotate && orientation === "landscape";
    const baseWidth = this.selectedPreset()?.width ?? preset.width;
    const baseHeight = this.selectedPreset()?.height ?? preset.height;
    const width = swap ? baseHeight : baseWidth;
    const height = swap ? baseWidth : baseHeight;

    return {
      formatId: preset.presetId,
      width,
      height,
      output: preset.outputMode === "fixed-size" ? "target" : "source",
      unit: preset.unit,
      outputMode: preset.outputMode,
      orientation,
      sourcePageNumber: this.selectedPreset()?.sourcePageNumber,
      sourcePageBox: this.selectedPreset()?.sourcePageBox,
    };
  });

  readonly canSelectOrientation = computed(() => {
    const preset = this.selectedPreset();
    return !!(
      this.currentConfig()?.supportsOrientation &&
      preset &&
      preset.width !== preset.height
    );
  });

  reset(): void {
    this.configsSig.set({});
    this.selectionsSig.set({});
    this.activeCategorySig.set("e-reader");
    this.tools = undefined;
  }

  initFromTools(tools?: EditorToolsConfig): void {
    this.reset();
    this.tools = tools;
    const cropTargets = tools?.cropTargets;
    if (!cropTargets) return;

    const configs = this.normalizeConfigs(cropTargets);
    this.configsSig.set(configs);
    this.activeCategorySig.set(
      this.resolveActiveCategory(cropTargets.activeCategory, configs),
    );

    const selections: SelectionMap = {};
    for (const category of CATEGORIES) {
      const config = configs[category];
      if (!config) continue;
      const selection = this.resolveSelection(
        category,
        config,
        cropTargets.selections?.[category],
      );
      if (selection) selections[category] = selection;
    }
    this.selectionsSig.set(selections);
    this.syncToolsState();
  }

  setActiveCategory(category: CropTargetCategory): void {
    if (!this.configsSig()[category] && category !== "e-reader") return;
    this.activeCategorySig.set(category);
    if (category !== "e-reader" && !this.selectionsSig()[category]) {
      const config = this.configsSig()[category];
      const selection = config
        ? this.resolveSelection(category, config, undefined)
        : undefined;
      if (selection) this.setSelection(category, selection);
    }
    this.syncToolsState();
  }

  selectParent(parentId: string): void {
    const config = this.currentConfig();
    if (!config) return;
    const group = config.catalog.find((item) => item.parentId === parentId);
    if (!group) return;
    this.selectGroup(group.id);
  }

  selectGroup(groupId: string): void {
    const config = this.currentConfig();
    if (!config) return;
    const group = config.catalog.find((item) => item.id === groupId);
    const preset = group?.items[0];
    if (!group || !preset) return;
    this.setSelection(this.activeCategorySig(), {
      category: this.activeCategorySig(),
      parentId: group.parentId,
      groupId: group.id,
      presetId: preset.id,
      width: preset.width,
      height: preset.height,
      unit: preset.unit,
      outputMode: preset.outputMode,
      orientation: this.resolveOrientation(config, preset),
      sourcePageNumber: preset.sourcePageNumber,
      sourcePageBox: preset.sourcePageBox,
    });
  }

  selectPreset(presetId: string): void {
    const config = this.currentConfig();
    if (!config) return;
    for (const group of config.catalog) {
      const preset = group.items.find((item) => item.id === presetId);
      if (!preset) continue;
      this.setSelection(this.activeCategorySig(), {
        category: this.activeCategorySig(),
        parentId: group.parentId,
        groupId: group.id,
        presetId: preset.id,
        width: preset.width,
        height: preset.height,
        unit: preset.unit,
        outputMode: preset.outputMode,
        orientation: this.resolveOrientation(config, preset),
        sourcePageNumber: preset.sourcePageNumber,
        sourcePageBox: preset.sourcePageBox,
      });
      return;
    }
  }

  setSourcePage(pageNumber: number): void {
    if (this.activeCategorySig() !== "pdf-original") return;
    const config = this.currentConfig();
    const current = this.selectedPreset();
    const pageTarget = config?.sourcePageTargets?.find(
      (target) => target.sourcePageNumber === pageNumber,
    );
    if (!config || !current || !pageTarget) return;

    this.setSelection("pdf-original", {
      ...current,
      width: pageTarget.width,
      height: pageTarget.height,
      unit: pageTarget.unit,
      outputMode: pageTarget.outputMode,
      sourcePageNumber: pageTarget.sourcePageNumber,
      sourcePageBox: pageTarget.sourcePageBox,
    });
  }

  updateCustomPresetDimensions(
    presetId: string,
    width: number,
    height: number,
  ): void {
    if (this.activeCategorySig() !== "ratio") return;

    const config = this.currentConfig();
    const current = this.selectedPreset();
    if (!config || !current || current.presetId !== presetId) return;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return;
    }

    const preset = config.catalog
      .flatMap((group) => group.items)
      .find((item) => item.id === presetId);
    if (!preset) return;

    this.configsSig.update((configs) => ({
      ...configs,
      ratio: {
        ...config,
        catalog: config.catalog.map((group) => ({
          ...group,
          items: group.items.map((item) =>
            item.id === presetId ? { ...item, width, height } : item,
          ),
        })),
      },
    }));
    this.setSelection("ratio", {
      ...current,
      width,
      height,
      orientation: this.resolveOrientation(config, { ...preset, width, height }),
    });
  }

  setOrientation(orientation: CropOrientation): void {
    const current = this.selectedPreset();
    if (!current || !this.canSelectOrientation()) return;
    this.setSelection(this.activeCategorySig(), {
      ...current,
      orientation,
    });
  }

  reapplySelection(): void {
    const current = this.selectedPreset();
    if (!current) return;
    this.setSelection(this.activeCategorySig(), { ...current });
  }

  private setSelection(
    category: CropTargetCategory,
    selection: CropTargetSelection,
  ): void {
    this.selectionsSig.update((current) => ({ ...current, [category]: selection }));
    this.syncToolsState();
  }

  private resolveActiveCategory(
    requested: CropTargetCategory | undefined,
    configs: CategoryConfigMap,
  ): CropTargetCategory {
    if (requested && (requested === "e-reader" || configs[requested])) {
      return requested;
    }
    if (configs["pdf-original"]) return "pdf-original";
    return configs.publishing ? "publishing" : configs.paper ? "paper" : "ratio";
  }

  private resolveSelection(
    category: CropTargetCategory,
    config: CropTargetCategoryConfig,
    persisted: PersistedCropTargetSelection | undefined,
  ): CropTargetSelection | undefined {
    const persistedPresetId =
      persisted?.presetId ??
      config.selectedPreset?.id ??
      (category !== "e-reader" ? this.tools?.formats?.selectedId : undefined);
    const requestedParentId = persisted?.parentId ?? config.selectedParentId;
    const group =
      config.catalog.find((item) => item.id === (persisted?.groupId ?? config.selectedGroupId)) ??
      config.catalog.find(
        (item) =>
          item.parentId === requestedParentId &&
          item.items.some((preset) => preset.id === persistedPresetId),
      ) ??
      config.catalog.find((item) => item.parentId === requestedParentId) ??
      config.catalog.find((item) => item.items.some((preset) => preset.id === persistedPresetId)) ??
      config.catalog[0];
    const preset =
      group?.items.find((item) => item.id === persistedPresetId) ?? group?.items[0];
    if (!group || !preset) return undefined;

    return {
      category,
      parentId: requestedParentId ?? group.parentId,
      groupId: group.id,
      presetId: preset.id,
      width: preset.width,
      height: preset.height,
      unit: preset.unit,
      outputMode: preset.outputMode,
      orientation: this.resolveOrientation(
        config,
        preset,
        persisted?.orientation,
      ),
      sourcePageNumber:
        persisted?.sourcePageNumber ?? preset.sourcePageNumber,
      sourcePageBox: persisted?.sourcePageBox ?? preset.sourcePageBox,
    };
  }

  private resolveOrientation(
    config: CropTargetCategoryConfig,
    preset: CropTargetPreset,
    orientation?: CropOrientation,
  ): CropOrientation {
    if (config.supportsOrientation && preset.width !== preset.height) {
      return orientation ?? config.defaultOrientation ?? "portrait";
    }
    return "portrait";
  }

  private normalizeConfigs(config: CropTargetsConfig): CategoryConfigMap {
    const input: CategoryConfigMap = {
      ...(config.categories ?? {}),
      "e-reader": config.eReader,
      publishing: config.publishing,
      "pdf-original": config.pdfOriginal,
      paper: config.paper,
      books: config.books,
      presentation: config.presentation,
      ratio: config.ratio,
    };
    const result: CategoryConfigMap = {};
    for (const category of CATEGORIES) {
      const normalized = this.validateCategory(category, input[category]);
      if (normalized) result[category] = normalized;
    }
    return result;
  }

  private validateCategory(
    category: CropTargetCategory,
    config?: CropTargetCategoryConfig,
  ): CropTargetCategoryConfig | undefined {
    if (!config) return undefined;
    const groups: CropTargetGroup[] = [];
    const groupIds = new Set<string>();
    const presetIds = new Set<string>();

    for (const group of config.catalog ?? []) {
      if (!group.id || !group.parentId || !group.i18nKey || groupIds.has(group.id)) {
        this.logInvalid(category, `group ${group.id || "unknown"}`);
        continue;
      }
      groupIds.add(group.id);
      const items = (group.items ?? []).filter((preset) => {
        const valid = this.isValidPreset(category, preset, presetIds);
        if (!valid) this.logInvalid(category, `preset ${preset?.id || "unknown"}`);
        if (valid) presetIds.add(preset.id);
        return valid;
      });
      if (items.length) groups.push({ ...group, items });
    }

    return groups.length ? { ...config, catalog: groups } : undefined;
  }

  private isValidPreset(
    category: CropTargetCategory,
    preset: CropTargetPreset,
    presetIds: Set<string>,
  ): boolean {
    if (!preset?.id || !preset.i18nKey || presetIds.has(preset.id)) return false;
    if (!Number.isFinite(preset.width) || !Number.isFinite(preset.height)) return false;
    if (preset.width <= 0 || preset.height <= 0) return false;
    if (preset.outputMode === "fixed-size" && preset.unit !== "px") return false;
    if (
      preset.outputMode === "physical-size" &&
      !["pt", "mm", "in"].includes(preset.unit)
    ) {
      return false;
    }
    if (
      preset.outputMode === "aspect-only" &&
      !["mm", "in", "ratio"].includes(preset.unit)
    ) {
      return false;
    }
    if (category === "publishing" && preset.outputMode !== "fixed-size") return false;
    return true;
  }

  private buildParents(groups: CropTargetGroup[]): Array<{
    id: string;
    i18nKey: string;
    groups: CropTargetGroup[];
  }> {
    const parents = new Map<string, { id: string; i18nKey: string; groups: CropTargetGroup[] }>();
    for (const group of groups) {
      const parent = parents.get(group.parentId);
      if (parent) {
        parent.groups.push(group);
        continue;
      }
      parents.set(group.parentId, {
        id: group.parentId,
        i18nKey: group.parentI18nKey ?? group.i18nKey,
        groups: [group],
      });
    }
    return Array.from(parents.values());
  }

  private syncToolsState(): void {
    return;
  }

  private logInvalid(category: CropTargetCategory, entry: string): void {
    console.error(`[editor-crop-targets] Invalid ${category} ${entry}`);
  }
}
