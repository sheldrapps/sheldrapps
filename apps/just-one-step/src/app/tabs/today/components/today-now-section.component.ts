import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonButton } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { TimePathComponent } from "@sheldrapps/ui-theme";
import { ScheduledState, TodayNowCard } from "../today.models";
import { TodayPriorityBadgeComponent } from "./today-priority-badge.component";
import { TodayStandardCardComponent } from "./today-standard-card.component";

@Component({
  standalone: true,
  selector: "app-today-now-section",
  templateUrl: "./today-now-section.component.html",
  styleUrls: ["./today-now-section.component.scss"],
  imports: [
    IonButton,
    TranslateModule,
    TimePathComponent,
    TodayPriorityBadgeComponent,
    TodayStandardCardComponent,
  ],
})
export class TodayNowSectionComponent {
  @Input() nowCard: TodayNowCard | null = null;
  @Input() nowFreeRangeLabel: string | null = null;
  @Input() nowFreeDurationLabel: string | null = null;

  @Output() reprogramNow = new EventEmitter<void>();
  @Output() skipNowTask = new EventEmitter<void>();

  isState(state: ScheduledState, nowCard: TodayNowCard): boolean {
    return nowCard.scheduledState === state;
  }

  withAlpha(hexColor: string, alpha: number): string {
    const normalized = hexColor.trim();
    const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
    if (hex.length !== 6) {
      return "rgba(0, 0, 0, 0.08)";
    }

    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
      return "rgba(0, 0, 0, 0.08)";
    }

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
}
