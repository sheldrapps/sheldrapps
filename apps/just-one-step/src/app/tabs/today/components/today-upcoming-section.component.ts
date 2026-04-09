import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { ProximateItem, ProximateTaskItem, TodayTaskListItem } from '../today.models';
import { TodayStandardCardComponent } from './today-standard-card.component';

@Component({
  standalone: true,
  selector: 'app-today-upcoming-section',
  templateUrl: './today-upcoming-section.component.html',
  styleUrls: ['./today-upcoming-section.component.scss'],
  imports: [IonButton, TranslateModule, TodayStandardCardComponent],
})
export class TodayUpcomingSectionComponent {
  @Input({ required: true }) proximateItems: ProximateItem[] = [];
  @Input() startNowDisabled = false;
  @Output() startNow = new EventEmitter<TodayTaskListItem>();

  expandedTaskId: string | null = null;

  toggleExpand(taskId: string): void {
    this.expandedTaskId = this.expandedTaskId === taskId ? null : taskId;
  }

  onStartNow(item: ProximateTaskItem): void {
    if (this.startNowDisabled) {
      return;
    }

    this.expandedTaskId = null;
    this.startNow.emit(item.taskItem);
  }
}
