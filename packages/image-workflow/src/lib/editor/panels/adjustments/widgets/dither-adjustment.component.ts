import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cc-dither-adjustment',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="adjustment-widget">
      <h3>Dither</h3>
      <p>Dither adjustment placeholder</p>
    </div>
  `,
  styles: [`
    .adjustment-widget {
      padding: 1rem;
    }
  `],
})
export class DitherAdjustmentComponent {}
