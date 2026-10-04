import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IonIcon } from '@ionic/angular/standalone';

type ActionCardIconFlip = 'none' | 'horizontal' | 'vertical';

@Component({
  selector: 'sh-action-card',
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: './action-card.component.html',
  styleUrls: ['./action-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.sh-action-card-host--compact]': 'compact',
  },
})
export class ActionCardComponent {
  private readonly sanitizer = inject(DomSanitizer);
  @Input() title = '';
  @Input() description = '';
  @Input() icon = '';
  @Input() imageUrl: string | null = null;
  @Input() svg: string | null = null;
  @Input() selected = false;
  @Input() suggested = false;
  @Input() compact = false;
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() iconFlip: ActionCardIconFlip = 'none';
  @Input() ariaLabel: string | null = null;
  @Output() readonly activated = new EventEmitter<void>();

  svgMarkup(): SafeHtml | null {
    if (!this.svg) {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustHtml(this.svg);
  }
}
