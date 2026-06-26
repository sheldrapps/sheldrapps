import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'sh-section-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './section-card.component.html',
  styleUrls: ['./section-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionCardComponent {
  private static nextId = 0;

  @Input() title: string | null = null;

  readonly titleId = `sh-section-card-title-${SectionCardComponent.nextId++}`;
}
