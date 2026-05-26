import { Component, effect, inject } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonToggle,
  ToastController,
} from "@ionic/angular/standalone";
import {
  ScrollableButtonBarComponent,
  type ScrollableBarItem,
} from "@sheldrapps/ui-theme";
import { EditorHistoryService } from "../../../editor-history.service";
import { EditorUiStateService } from "../../../editor-ui-state.service";
import { EditorKindleStateService } from "../../../editor-kindle-state.service";
import { EditorSessionService } from "../../../editor-session.service";
import { EDITOR_SESSION_ID } from "../../../editor-panel.tokens";
import type {
  KindleDeviceModel,
  KindleGroup,
} from "../../../editor-session.service";
import type { CropFormatOption } from "../../../../types";

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
    IonSelect,
    IonSelectOption,
    IonToggle,
    ScrollableButtonBarComponent,
    TranslateModule,
  ],
  templateUrl: "./crop-panel.component.html",
  styleUrls: ["./crop-panel.component.scss"],
})
export class CropPanelComponent {
  private static readonly FORMAT_ID_WITH_FRAME = "with_frame";
  private static readonly FORMAT_ID_WITHOUT_FRAME = "without_frame";
  private static readonly FRAME_NOT_DETECTED_MESSAGE =
    "Marco no detectado en el documento";

  private readonly history = inject(EditorHistoryService);
  private readonly ui = inject(EditorUiStateService);
  private readonly kindleState = inject(EditorKindleStateService);
  private readonly editorSession = inject(EditorSessionService, {
    optional: true,
  });
  private readonly toastCtrl = inject(ToastController);
  private readonly sid = inject(EDITOR_SESSION_ID, { optional: true });

  kindleGroups: KindleGroup[] = [];
  brands: Array<{ id: string; i18nKey: string; groups: KindleGroup[] }> = [];
  visibleGroups: KindleGroup[] = [];
  selectedBrandId?: string;
  selectedGroupId?: string;
  selectedModel?: KindleDeviceModel;

  formatOptions: CropFormatOption[] = [];
  selectedFormatId?: string;
  formatItems: ScrollableBarItem[] = [];

  constructor() {
    effect(() => {
      const tools = this.ui.toolsConfig();
      const formats = tools?.formats?.options ?? [];
      const selectedId =
        tools?.formats?.selectedId ?? formats[0]?.id ?? undefined;

      this.formatOptions = formats;
      this.selectedFormatId = selectedId;
      this.formatItems = formats.map((format) => ({
        id: format.id,
        label: format.label,
      }));
    });

    effect(() => {
      this.kindleGroups = this.kindleState.catalog();
      this.selectedGroupId = this.kindleState.selectedGroupId() ?? undefined;
      this.selectedModel = this.kindleState.selectedModel() ?? undefined;
      this.brands = this.buildBrands(this.kindleGroups);
      this.selectedBrandId = this.resolveSelectedBrandId();
      this.visibleGroups = this.getGroupsForBrand(this.selectedBrandId);
    });
  }

  get hasFormatOptions(): boolean {
    return this.formatOptions.length > 1;
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

  get currentGroupModels(): KindleDeviceModel[] {
    if (!this.selectedGroupId) return [];
    const group = this.visibleGroups.find((g) => g.id === this.selectedGroupId);
    return this.getGroupModels(group);
  }

  compareModels(
    m1: KindleDeviceModel | undefined,
    m2: KindleDeviceModel | undefined,
  ): boolean {
    return m1 && m2 ? m1.id === m2.id : m1 === m2;
  }

  onBrandChange(): void {
    this.visibleGroups = this.getGroupsForBrand(this.selectedBrandId);
    const firstGroup = this.visibleGroups[0];
    const firstModel = this.getGroupModels(firstGroup)[0];
    if (!firstGroup || !firstModel) {
      return;
    }

    this.history.setKindleModel(firstGroup.id, firstModel.id);
  }

  onGroupChange(): void {
    if (this.selectedGroupId) {
      const group = this.visibleGroups.find(
        (g) => g.id === this.selectedGroupId,
      );
      const models = this.getGroupModels(group);
      if (models.length > 0) {
        this.history.setKindleModel(this.selectedGroupId, models[0].id);
      }
    }
  }

  onModelChange(): void {
    if (!this.selectedModel) return;
    this.history.setKindleModel(this.selectedGroupId, this.selectedModel.id);
  }

  async onFormatSelect(id: string): Promise<void> {
    if (!id || id === this.selectedFormatId) return;
    const selected = this.formatOptions.find((opt) => opt.id === id);
    if (!selected) return;
    if (selected.disabled) {
      await this.showFrameNotDetectedToast();
      return;
    }

    this.selectedFormatId = id;

    const current = this.ui.toolsConfig();
    const nextFormats = {
      options: this.formatOptions,
      selectedId: id,
    };
    const nextConfig = current
      ? { ...current, formats: nextFormats }
      : { formats: nextFormats };
    this.ui.setToolsConfig(nextConfig);

    const session = this.getSession();
    if (session) {
      session.tools = session.tools ?? {};
      session.tools.formats = session.tools.formats ?? nextFormats;
      session.tools.formats.options = this.formatOptions;
      session.tools.formats.selectedId = id;
      session.target = {
        width: selected.target.width,
        height: selected.target.height,
      };
    }

    this.history.resetViewToCover();
  }

  async onFrameSwitchChange(event: CustomEvent<{ checked: boolean }>): Promise<void> {
    const checked = !!event.detail?.checked;
    const id = checked
      ? CropPanelComponent.FORMAT_ID_WITH_FRAME
      : CropPanelComponent.FORMAT_ID_WITHOUT_FRAME;
    await this.onFormatSelect(id);
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

