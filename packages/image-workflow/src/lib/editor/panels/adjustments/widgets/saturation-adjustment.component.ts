import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cc-saturation-adjustment',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="adjustment-widget">
      <h3>Saturation</h3>
      <p>Saturation adjustment placeholder</p>
    </div>
  `,
  styles: [`
    .adjustment-widget {
      padding: 1rem;
    }
  `],
})
export class SaturationAdjustmentComponent {}
