import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonButton } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { TodayTaskListItem } from "../today.models";
import { TodayStandardCardComponent } from "./today-standard-card.component";

@Component({
  standalone: true,
  selector: "app-today-tasks-section",
  templateUrl: "./today-tasks-section.component.html",
  styleUrls: ["./today-tasks-section.component.scss"],
  imports: [IonButton, TranslateModule, TodayStandardCardComponent],
})
export class TodayTasksSectionComponent {
  @Input({ required: true }) todayItems: TodayTaskListItem[] = [];
  @Input() startNowDisabled = false;
  @Output() taskSelected = new EventEmitter<TodayTaskListItem>();

  expandedTaskId: string | null = null;

  toggleExpand(taskId: string): void {
    this.expandedTaskId = this.expandedTaskId === taskId ? null : taskId;
  }

  onStartNow(item: TodayTaskListItem): void {
    if (this.startNowDisabled) {
      return;
    }

    this.expandedTaskId = null;
    this.taskSelected.emit(item);
  }
}
