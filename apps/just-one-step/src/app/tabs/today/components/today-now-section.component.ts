import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonButton } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import {
  THEME_ACCENT_BACKGROUND_FALLBACK,
  TimePathComponent,
  withThemeAlpha,
} from "@sheldrapps/ui-theme";
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
    return withThemeAlpha(hexColor, alpha, THEME_ACCENT_BACKGROUND_FALLBACK);
  }
}
