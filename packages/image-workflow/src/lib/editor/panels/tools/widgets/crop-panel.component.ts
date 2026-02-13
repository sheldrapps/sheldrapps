import { Component, OnInit, inject } from '@angular/core';
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
import { EditorSessionService } from "../../../editor-session.service";
import { EDITOR_SESSION_ID } from "../../../editor-panel.tokens";

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
export class CropPanelComponent implements OnInit {
  private editorSession = inject(EditorSessionService);
  private sid = inject(EDITOR_SESSION_ID, { optional: true });

  kindleGroups: any[] = [];
  selectedGroupId?: string;
  selectedModel?: any;

  get currentGroupModels(): any[] {
    if (!this.selectedGroupId) return [];
    const group = this.kindleGroups.find((g) => g.id === this.selectedGroupId);
    return group?.models ?? [];
  }

  ngOnInit(): void {
    if (!this.sid) {
      console.warn("CropPanelComponent: No session ID provided");
      return;
    }

    const session = this.editorSession.getSession(this.sid);
    if (session?.tools?.kindle) {
      this.kindleGroups = session.tools.kindle.groups || [];
      this.selectedGroupId = session.tools.kindle.selectedGroupId;
      this.selectedModel = session.tools.kindle.selectedModel;
    }
  }

  compareModels(m1: any, m2: any): boolean {
    return m1 && m2 ? m1.id === m2.id : m1 === m2;
  }

  onGroupChange(): void {
    if (this.selectedGroupId) {
      const group = this.kindleGroups.find(
        (g) => g.id === this.selectedGroupId,
      );
      if (group && group.models.length > 0) {
        this.selectedModel = group.models[0];
        this.onModelChange();
      }
    }
  }

  onModelChange(): void {
    // Model change handler - in a full implementation,
    // this would emit changes to parent or save to a store
    console.log("Model changed:", this.selectedModel);
  }
}

