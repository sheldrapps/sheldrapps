import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cc-rotate-tool',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tool-widget">
      <h3>Rotate Tool</h3>
      <p>Rotate functionality placeholder</p>
    </div>
  `,
  styles: [`
    .tool-widget {
      padding: 1rem;
    }
  `],
})
export class RotateToolComponent {}
