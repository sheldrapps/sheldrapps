import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollableButtonBarComponent, ScrollableBarItem } from '@sheldrapps/ui-theme';

@Component({
  selector: "cc-adjustments-page",
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent],
  templateUrl: "./adjustments.page.html",
  styleUrls: ["./adjustments.page.scss"],
})
export class AdjustmentsPage {
  adjustmentItems: ScrollableBarItem[] = [
    { id: 'brightness', label: 'Brightness' },
    { id: 'saturation', label: 'Saturation' },
    { id: 'contrast', label: 'Contrast' },
    { id: 'bw', label: 'B/W' },
  ];
}
