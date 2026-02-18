import { Injectable, computed, signal } from "@angular/core";
import type {
  EditorToolsConfig,
  KindleDeviceModel,
  KindleGroup,
} from "./editor-session.service";

export type KindleSelectionSnapshot = {
  groupId?: string;
  modelId?: string;
  width?: number;
  height?: number;
};

type KindleToolsConfig = EditorToolsConfig["kindle"];
type KindleModelChangeHandler = (model: KindleDeviceModel) => void | Promise<void>;

@Injectable({
  providedIn: "root",
})
export class EditorKindleStateService {
  private readonly catalogSig = signal<KindleGroup[]>([]);
  private readonly selectedGroupIdSig = signal<string | undefined>(undefined);
  private readonly selectedModelSig = signal<KindleDeviceModel | undefined>(
    undefined,
  );
  private onModelChange?: KindleModelChangeHandler;

  readonly catalog = this.catalogSig.asReadonly();
  readonly selectedGroupId = this.selectedGroupIdSig.asReadonly();
  readonly selectedModel = this.selectedModelSig.asReadonly();

  readonly currentModels = computed(() => {
    const group = this.findGroupById(this.selectedGroupIdSig());
    return this.getGroupModels(group);
  });

  readonly target = computed(() => {
    const model = this.selectedModelSig();
    if (!model) return null;
    return { width: model.width, height: model.height };
  });

  reset(): void {
    this.catalogSig.set([]);
    this.selectedGroupIdSig.set(undefined);
    this.selectedModelSig.set(undefined);
    this.onModelChange = undefined;
  }

  initFromTools(tools?: KindleToolsConfig): void {
    this.reset();
    if (!tools) return;

    const catalog = tools.modelCatalog ?? tools.groups ?? [];
    this.catalogSig.set(catalog ?? []);
    this.onModelChange = tools.onKindleModelChange;

    const selected = tools.selectedModel;
    const selectedGroupId = tools.selectedGroupId;

    if (selected?.id) {
      const resolvedGroup =
        this.findGroupIdByModelId(selected.id, catalog) ?? selectedGroupId;
      const catalogMatch =
        this.findModelById(selected.id, resolvedGroup, catalog) ?? selected;
      this.setSelection(resolvedGroup, catalogMatch, { silent: true });
      return;
    }

    if (selectedGroupId) {
      const group = this.findGroupById(selectedGroupId, catalog);
      const models = this.getGroupModels(group);
      if (models.length) {
        this.setSelection(selectedGroupId, models[0], { silent: true });
        return;
      }
    }

    const firstGroup = catalog?.[0];
    const firstModel = this.getGroupModels(firstGroup)[0];
    if (firstGroup && firstModel) {
      this.setSelection(firstGroup.id, firstModel, { silent: true });
    }
  }

  captureSnapshot(): KindleSelectionSnapshot {
    const model = this.selectedModelSig();
    return {
      groupId: this.selectedGroupIdSig(),
      modelId: model?.id,
      width: model?.width,
      height: model?.height,
    };
  }

  restoreSnapshot(
    snapshot: KindleSelectionSnapshot | null,
    opts?: { silent?: boolean },
  ): boolean {
    if (!snapshot?.modelId) return false;
    const applied = this.selectByIds(snapshot.groupId, snapshot.modelId, opts);
    if (applied) return true;

    if (
      snapshot.width &&
      snapshot.height &&
      snapshot.modelId
    ) {
      return this.setSelection(
        snapshot.groupId,
        {
          id: snapshot.modelId,
          width: snapshot.width,
          height: snapshot.height,
        },
        opts,
      );
    }

    return false;
  }

  selectByIds(
    groupId: string | undefined,
    modelId: string | undefined,
    opts?: { silent?: boolean },
  ): boolean {
    if (!modelId) return false;

    let group = this.findGroupById(groupId);
    let model = this.findModelById(modelId, groupId);

    if (!model) {
      group = this.findGroupByModelId(modelId);
      model = this.findModelById(modelId, group?.id);
    }

    if (!model) return false;

    const resolvedGroupId = group?.id ?? groupId;
    return this.setSelection(resolvedGroupId, model, opts);
  }

  selectFirstInGroup(
    groupId: string | undefined,
    opts?: { silent?: boolean },
  ): boolean {
    if (!groupId) return false;
    const group = this.findGroupById(groupId);
    const models = this.getGroupModels(group);
    if (!models.length) return false;
    return this.setSelection(groupId, models[0], opts);
  }

  private setSelection(
    groupId: string | undefined,
    model: KindleDeviceModel,
    opts?: { silent?: boolean },
  ): boolean {
    const currentModel = this.selectedModelSig();
    const currentGroupId = this.selectedGroupIdSig();

    if (currentModel?.id === model.id && currentGroupId === groupId) {
      return false;
    }

    this.selectedGroupIdSig.set(groupId);
    this.selectedModelSig.set(model);

    if (!opts?.silent && this.onModelChange) {
      try {
        void this.onModelChange(model);
      } catch (err) {
        console.warn("[editor-kindles] onKindleModelChange failed:", err);
      }
    }

    return true;
  }

  private getGroupModels(group?: KindleGroup | null): KindleDeviceModel[] {
    if (!group) return [];
    return group.items ?? group.models ?? [];
  }

  private findGroupById(
    id?: string,
    groups: KindleGroup[] = this.catalogSig(),
  ): KindleGroup | undefined {
    if (!id) return undefined;
    return groups.find((g) => g.id === id);
  }

  private findGroupByModelId(
    modelId: string,
    groups: KindleGroup[] = this.catalogSig(),
  ): KindleGroup | undefined {
    return groups.find((g) =>
      this.getGroupModels(g).some((m) => m.id === modelId),
    );
  }

  private findGroupIdByModelId(
    modelId: string,
    groups: KindleGroup[] = this.catalogSig(),
  ): string | undefined {
    return this.findGroupByModelId(modelId, groups)?.id;
  }

  private findModelById(
    modelId: string,
    groupId?: string,
    groups: KindleGroup[] = this.catalogSig(),
  ): KindleDeviceModel | undefined {
    if (groupId) {
      const group = this.findGroupById(groupId, groups);
      const found = this.getGroupModels(group).find((m) => m.id === modelId);
      if (found) return found;
    }

    for (const group of groups) {
      const found = this.getGroupModels(group).find((m) => m.id === modelId);
      if (found) return found;
    }

    return undefined;
  }
}
