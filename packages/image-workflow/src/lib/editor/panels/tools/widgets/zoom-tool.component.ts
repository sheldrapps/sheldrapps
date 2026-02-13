import { Component } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from "@ngx-translate/core";

@Component({
  selector: "cc-zoom-tool",
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="tool-widget">
      <h3>{{ "EDITOR.PANELS.TOOLS.WIDGETS.ZOOM_TOOL.TITLE" | translate }}</h3>
      <p>
        {{ "EDITOR.PANELS.TOOLS.WIDGETS.ZOOM_TOOL.PLACEHOLDER" | translate }}
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
export class ZoomToolComponent {}
