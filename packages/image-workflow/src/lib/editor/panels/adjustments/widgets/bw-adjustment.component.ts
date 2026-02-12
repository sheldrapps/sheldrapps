import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cc-bw-adjustment',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="adjustment-widget">
      <h3>Black & White</h3>
      <p>Black and white adjustment placeholder</p>
    </div>
  `,
  styles: [`
    .adjustment-widget {
      padding: 1rem;
    }
  `],
})
export class BwAdjustmentComponent {}
