import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cc-zoom-tool',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tool-widget">
      <h3>Zoom Tool</h3>
      <p>Zoom functionality placeholder</p>
    </div>
  `,
  styles: [`
    .tool-widget {
      padding: 1rem;
    }
  `],
})
export class ZoomToolComponent {}
