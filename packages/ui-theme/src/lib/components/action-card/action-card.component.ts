import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
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
})
export class ActionCardComponent {
  private readonly sanitizer = inject(DomSanitizer);
  @Input() title = '';
  @Input() icon = '';
  @Input() svg: string | null = null;
  @Input() selected = false;
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() iconFlip: ActionCardIconFlip = 'none';
  @Input() ariaLabel: string | null = null;

  svgMarkup(): SafeHtml | null {
    if (!this.svg) {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustHtml(this.svg);
  }
}
