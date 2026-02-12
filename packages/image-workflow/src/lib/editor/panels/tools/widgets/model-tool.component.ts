import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cc-model-tool',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tool-widget">
      <h3>Model Tool</h3>
      <p>Model functionality placeholder</p>
    </div>
  `,
  styles: [`
    .tool-widget {
      padding: 1rem;
    }
  `],
})
export class ModelToolComponent {}
