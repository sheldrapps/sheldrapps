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
import { EditorHistoryService } from "../../../editor-history.service";
import { EditorKindleStateService } from "../../../editor-kindle-state.service";
import type {
  KindleDeviceModel,
  KindleGroup,
} from "../../../editor-session.service";

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
    TranslateModule,
  ],
  templateUrl: "./crop-panel.component.html",
  styleUrls: ["./crop-panel.component.scss"],
})
export class CropPanelComponent {
  private readonly history = inject(EditorHistoryService);
  private readonly kindleState = inject(EditorKindleStateService);

  kindleGroups: KindleGroup[] = [];
  selectedGroupId?: string;
  selectedModel?: KindleDeviceModel;

  constructor() {
    effect(() => {
      this.kindleGroups = this.kindleState.catalog();
      this.selectedGroupId = this.kindleState.selectedGroupId() ?? undefined;
      this.selectedModel = this.kindleState.selectedModel() ?? undefined;
    });
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

  private getGroupModels(group?: KindleGroup): KindleDeviceModel[] {
    if (!group) return [];
    return group.items ?? group.models ?? [];
  }
}

