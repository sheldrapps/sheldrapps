import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ScrollableBarItem,
  ScrollableButtonBarComponent,
} from '@sheldrapps/ui-theme';
import { addIcons } from 'ionicons';
import { addOutline, removeOutline } from 'ionicons/icons';
import { EditorStateService } from '../../../editor-state.service';

@Component({
  selector: 'cc-zoom-panel',
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent],
  template: `
    <div class="panel-actions">
      <sh-scrollable-button-bar
        [items]="zoomItems"
        [disabledIds]="disabledZoomIds"
        variant="iconOnly"
        align="center"
        ariaLabel="Zoom"
        (selectItem)="onSelectZoom($event)"
      ></sh-scrollable-button-bar>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .panel-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 8px;
    }

  `],
})
export class ZoomPanelComponent {
  readonly editorState = inject(EditorStateService);

  readonly zoomItems: ScrollableBarItem[] = [
    { id: 'out', label: 'Zoom out', icon: 'remove-outline' },
    { id: 'in', label: 'Zoom in', icon: 'add-outline' },
  ];

  get disabledZoomIds(): string[] {
    const scale = this.editorState.scale();
    const ids: string[] = [];
    if (scale <= 1) ids.push('out');
    if (scale >= 6) ids.push('in');
    return ids;
  }

  constructor() {
    addIcons({ addOutline, removeOutline });
  }

  onSelectZoom(id: string): void {
    if (id === 'out') {
      this.editorState.zoomOut();
      return;
    }

    if (id === 'in') {
      this.editorState.zoomIn();
    }
  }
}
