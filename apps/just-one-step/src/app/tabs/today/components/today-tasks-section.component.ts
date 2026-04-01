import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TimeDisplayComponent } from '@sheldrapps/ui-theme';
import { TodayTaskListItem } from '../today.models';

@Component({
  standalone: true,
  selector: 'app-today-tasks-section',
  templateUrl: './today-tasks-section.component.html',
  styleUrls: ['./today-tasks-section.component.scss'],
  imports: [TranslateModule, TimeDisplayComponent],
})
export class TodayTasksSectionComponent {
  @Input({ required: true }) todayItems: TodayTaskListItem[] = [];
  @Output() taskSelected = new EventEmitter<TodayTaskListItem>();

  withAlpha(hexColor: string, alpha: number): string {
    const normalized = hexColor.trim();
    const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;
    if (hex.length !== 6) {
      return 'rgba(0, 0, 0, 0.08)';
    }

    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
      return 'rgba(0, 0, 0, 0.08)';
    }

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  itemBorderColor(item: TodayTaskListItem): string {
    return item.completed ? this.withAlpha(item.color, 0.42) : item.color;
  }

  itemBackgroundColor(item: TodayTaskListItem): string {
    return item.completed
      ? this.withAlpha(item.color, 0.04)
      : this.withAlpha(item.color, 0.09);
  }

  itemShadowColor(item: TodayTaskListItem): string {
    return item.completed
      ? this.withAlpha(item.color, 0.05)
      : this.withAlpha(item.color, 0.12);
  }
}
