import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cc-contrast-adjustment',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="adjustment-widget">
      <h3>Contrast</h3>
      <p>Contrast adjustment placeholder</p>
    </div>
  `,
  styles: [`
    .adjustment-widget {
      padding: 1rem;
    }
  `],
})
export class ContrastAdjustmentComponent {}
