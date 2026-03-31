import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

type AgendaViewMode = 'day' | 'month' | 'year';

@Component({
  standalone: true,
  selector: 'app-agenda-controls',
  templateUrl: './agenda-controls.component.html',
  styleUrls: ['./agenda-controls.component.scss'],
  imports: [
    CommonModule,
    IonButton,
    IonIcon,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    TranslateModule,
  ],
})
export class AgendaControlsComponent {
  @Input() currentView: AgendaViewMode = 'day';
  @Input() dayHeaderWeekdayLabel = '';
  @Input() dayHeaderDateLabel = '';
  @Input() monthHeaderLabel = '';
  @Input() yearHeaderLabel = '';

  @Output() viewModeChange = new EventEmitter<AgendaViewMode>();
  @Output() shiftScope = new EventEmitter<number>();

  get scopeTitleLabel(): string {
    return this.currentView === 'month' ? this.monthHeaderLabel : this.yearHeaderLabel;
  }

  onViewModeChange(event: CustomEvent): void {
    const nextView = `${event.detail?.value ?? ''}`;
    if (nextView === 'day' || nextView === 'month' || nextView === 'year') {
      this.viewModeChange.emit(nextView);
    }
  }
}
