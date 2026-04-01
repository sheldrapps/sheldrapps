import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TimeDisplayComponent } from '@sheldrapps/ui-theme';
import { TodayUpcomingGap } from '../today.models';

@Component({
  standalone: true,
  selector: 'app-today-free-times-section',
  templateUrl: './today-free-times-section.component.html',
  styleUrls: ['./today-free-times-section.component.scss'],
  imports: [TranslateModule, TimeDisplayComponent],
})
export class TodayFreeTimesSectionComponent {
  @Input({ required: true }) upcomingFreeSpaces: TodayUpcomingGap[] = [];
}
