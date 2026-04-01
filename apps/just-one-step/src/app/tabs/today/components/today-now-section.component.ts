import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonButton, IonCol, IonGrid, IonRow } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { TimeDisplayComponent } from '@sheldrapps/ui-theme';
import { TodayNowCard } from '../today.models';

@Component({
  standalone: true,
  selector: 'app-today-now-section',
  templateUrl: './today-now-section.component.html',
  styleUrls: ['./today-now-section.component.scss'],
  imports: [IonButton, IonGrid, IonRow, IonCol, TranslateModule, TimeDisplayComponent],
})
export class TodayNowSectionComponent {
  @Input() nowCard: TodayNowCard | null = null;
  @Input() nowFreeRangeLabel: string | null = null;
  @Input() isRunning = false;

  @Output() executeNow = new EventEmitter<void>();
  @Output() executeNowFiveMinutes = new EventEmitter<void>();
  @Output() reprogramNow = new EventEmitter<void>();
  @Output() completeNowCheckTask = new EventEmitter<void>();
  @Output() postponeNowCheckTask = new EventEmitter<void>();

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
}
