import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollableButtonBarComponent, ScrollableBarItem } from '@sheldrapps/ui-theme';

@Component({
  selector: 'cc-tools-page',
  standalone: true,
  imports: [
    CommonModule,
    ScrollableButtonBarComponent,
  ],
  templateUrl: './tools.page.html',
  styleUrls: ['./tools.page.scss'],
})
export class ToolsPage {
  toolItems: ScrollableBarItem[] = [
    { id: 'model', label: 'Model' },
    { id: 'crop', label: 'Crop' },
    { id: 'rotate', label: 'Rotate' },
    { id: 'zoom', label: 'Zoom' },
  ];
}
