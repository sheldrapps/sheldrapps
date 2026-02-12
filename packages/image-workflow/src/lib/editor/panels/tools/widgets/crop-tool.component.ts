import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cc-crop-tool',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tool-widget">
      <h3>Crop Tool</h3>
      <p>Crop functionality placeholder</p>
    </div>
  `,
  styles: [`
    .tool-widget {
      padding: 1rem;
    }
  `],
})
export class CropToolComponent {}
