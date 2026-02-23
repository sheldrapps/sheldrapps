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
    ScrollableButtonBarComponent,
    TranslateModule,
  ],
  templateUrl: "./crop-panel.component.html",
  styleUrls: ["./crop-panel.component.scss"],
})
export class CropPanelComponent {
  private readonly history = inject(EditorHistoryService);
  private readonly ui = inject(EditorUiStateService);
  private readonly kindleState = inject(EditorKindleStateService);
  private readonly editorSession = inject(EditorSessionService, {
    optional: true,
  });
  private readonly sid = inject(EDITOR_SESSION_ID, { optional: true });

  kindleGroups: KindleGroup[] = [];
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
    });
  }

  get hasFormatOptions(): boolean {
    return this.formatOptions.length > 0;
  }

  get currentGroupModels(): KindleDeviceModel[] {
    if (!this.selectedGroupId) return [];
    const group = this.kindleGroups.find((g) => g.id === this.selectedGroupId);
    return this.getGroupModels(group);
  }

  compareModels(
    m1: KindleDeviceModel | undefined,
    m2: KindleDeviceModel | undefined,
  ): boolean {
    return m1 && m2 ? m1.id === m2.id : m1 === m2;
  }

  onGroupChange(): void {
    if (this.selectedGroupId) {
      const group = this.kindleGroups.find(
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

  onFormatSelect(id: string): void {
    if (!id || id === this.selectedFormatId) return;
    const selected = this.formatOptions.find((opt) => opt.id === id);
    if (!selected) return;

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

  private getSession() {
    if (!this.editorSession || !this.sid) return null;
    return this.editorSession.getSession(this.sid);
  }

  private getGroupModels(group?: KindleGroup): KindleDeviceModel[] {
    if (!group) return [];
    return group.items ?? group.models ?? [];
  }
}

