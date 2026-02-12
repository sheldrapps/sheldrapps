import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cc-brightness-adjustment',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="adjustment-widget">
      <h3>Brightness</h3>
      <p>Brightness adjustment placeholder</p>
    </div>
  `,
  styles: [`
    .adjustment-widget {
      padding: 1rem;
    }
  `],
})
export class BrightnessAdjustmentComponent {}
