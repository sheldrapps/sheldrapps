import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-today-motivational-copy',
  templateUrl: './today-motivational-copy.component.html',
  styleUrls: ['./today-motivational-copy.component.scss'],
})
export class TodayMotivationalCopyComponent {
  @Input({ required: true }) line1 = '';
  @Input({ required: true }) line2 = '';
}
