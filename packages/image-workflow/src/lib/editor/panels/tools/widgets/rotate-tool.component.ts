import { Component } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "cc-rotate-tool",
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="tool-widget">
      <h3>{{ "EDITOR.PANELS.TOOLS.WIDGETS.ROTATE_TOOL.TITLE" | translate }}</h3>
      <p>
        {{ "EDITOR.PANELS.TOOLS.WIDGETS.ROTATE_TOOL.PLACEHOLDER" | translate }}
      </p>
    </div>
  `,
  styles: [
    `
      .tool-widget {
        padding: 1rem;
      }
    `,
  ],
})
export class RotateToolComponent {}
