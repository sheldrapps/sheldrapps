import { Component, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ScrollableButtonBarComponent,
  ScrollableBarItem,
} from '@sheldrapps/ui-theme';
import { EditorStateService } from '../../../editor-state.service';
import {
  TranslateService,
  TranslationChangeEvent,
  LangChangeEvent,
} from "@ngx-translate/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { merge, Observable } from "rxjs";

const ROTATE_LEFT_SVG = `
<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="20" height="39.2406" rx="0.548512" transform="matrix(-1 0 0 1 43.2528 4)" fill="currentColor" fill-opacity="0.43"/>
<rect width="20" height="39.2406" rx="0.548512" transform="matrix(-1 0 0 1 43.2528 4)" stroke="currentColor" style="mix-blend-mode:screen" stroke-width="0.548512" stroke-dasharray="1.1 1.1"/>
<path d="M13.0148 19.5175C12.7991 19.7321 12.4494 19.7351 12.2338 19.5242L8.71926 16.0876C8.50359 15.8767 8.50359 15.5318 8.71926 15.3172C8.93492 15.1027 9.28459 15.0997 9.50026 15.3106L12.6243 18.3653L15.7483 15.2572C15.9639 15.0426 16.3136 15.0396 16.5293 15.2505C16.7449 15.4614 16.7449 15.8063 16.5293 16.0208L13.0148 19.5175ZM16.7385 8.1483L16.6742 8.68986C15.0793 8.51893 14.1722 8.79185 13.6414 9.23677C13.1081 9.68369 12.8268 10.4101 12.7339 11.4418C12.6412 12.4713 12.7447 13.6968 12.8801 15.0368C13.0133 16.3565 13.1765 17.7797 13.1765 19.1309L12.6243 19.1357L12.072 19.1404C12.072 17.8569 11.9169 16.5001 11.781 15.1541C11.6471 13.8284 11.5304 12.5026 11.6338 11.3547C11.7369 10.209 12.0679 9.13201 12.9305 8.40907C13.7954 7.68412 15.0677 7.42076 16.8029 7.60673L16.7385 8.1483Z" fill="currentColor"/>
<g filter="url(#rotate_left_filter)">
<rect width="40" height="19.6203" rx="0.548512" transform="matrix(-1 0 0 1 44 24.3797)" fill="currentColor"/>
<rect x="0.274256" y="-0.274256" width="40.5485" height="20.1688" rx="0.822768" transform="matrix(-1 0 0 1 44.5485 24.3797)" stroke="currentColor" stroke-width="0.548512"/>
</g>
<defs>
<filter id="rotate_left_filter" x="3.01267" y="23.8312" width="41.9746" height="21.5949" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dy="0.43881"/>
<feGaussianBlur stdDeviation="0.219405"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
</filter>
</defs>
</svg>
`;

const ROTATE_RIGHT_SVG = `
<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="4.74716" y="4" width="20" height="39.2406" rx="0.548512" fill="currentColor" fill-opacity="0.43"/>
<rect x="4.74716" y="4" width="20" height="39.2406" rx="0.548512" stroke="currentColor" style="mix-blend-mode:screen" stroke-width="0.548512" stroke-dasharray="1.1 1.1"/>
<path d="M34.9852 19.5175C35.2009 19.7321 35.5506 19.7351 35.7662 19.5242L39.2807 16.0876C39.4964 15.8767 39.4964 15.5318 39.2807 15.3172C39.0651 15.1027 38.7154 15.0997 38.4997 15.3106L35.3757 18.3653L32.2517 15.2572C32.0361 15.0426 31.6864 15.0396 31.4707 15.2505C31.2551 15.4614 31.2551 15.8063 31.4707 16.0208L34.9852 19.5175ZM31.2615 8.1483L31.3258 8.68986C32.9207 8.51893 33.8278 8.79185 34.3586 9.23677C34.8919 9.68369 35.1732 10.4101 35.2661 11.4418C35.3588 12.4713 35.2553 13.6968 35.1199 15.0368C34.9867 16.3565 34.8235 17.7797 34.8235 19.1309L35.3757 19.1357L35.928 19.1404C35.928 17.8569 36.0831 16.5001 36.219 15.1541C36.3529 13.8284 36.4696 12.5026 36.3662 11.3547C36.2631 10.209 35.9321 9.13201 35.0695 8.40907C34.2046 7.68412 32.9323 7.42076 31.1971 7.60673L31.2615 8.1483Z" fill="currentColor"/>
<g filter="url(#rotate_right_filter)">
<rect x="4" y="24.3797" width="40" height="19.6203" rx="0.548512" fill="currentColor"/>
<rect x="3.72574" y="24.1055" width="40.5485" height="20.1688" rx="0.822768" stroke="currentColor" stroke-width="0.548512"/>
</g>
<defs>
<filter id="rotate_right_filter" x="3.01267" y="23.8312" width="41.9746" height="21.5949" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dy="0.43881"/>
<feGaussianBlur stdDeviation="0.219405"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
</filter>
</defs>
</svg>
`;

@Component({
  selector: 'cc-rotate-panel',
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent],
  template: `
    <div class="rotate-panel">
      <sh-scrollable-button-bar
        [items]="rotateItems"
        variant="iconText"
        align="center"
        ariaLabel="Rotate"
        (selectItem)="onSelectRotate($event)"
      ></sh-scrollable-button-bar>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .rotate-panel {
      padding: 8px 0;
    }
  `]
})
export class RotatePanelComponent {
  readonly editorState = inject(EditorStateService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  rotateItems: ScrollableBarItem[] = this.buildRotateItems();

  constructor() {
    merge(
      this.translate.onLangChange as Observable<LangChangeEvent>,
      this.translate.onTranslationChange as Observable<TranslationChangeEvent>,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.rotateItems = this.buildRotateItems();
      });
  }

  private buildRotateItems(): ScrollableBarItem[] {
    const leftKey =
      "EDITOR.PANELS.TOOLS.WIDGETS.ROTATE_PANEL.BUTTON.LEFT";
    const rightKey =
      "EDITOR.PANELS.TOOLS.WIDGETS.ROTATE_PANEL.BUTTON.RIGHT";

    const leftLabel = this.translate.instant(leftKey);
    const rightLabel = this.translate.instant(rightKey);

    const makeItem = (id: string, label: string, svg: string) =>
      ({
        id,
        label,
        labelKey: label,
        text: label,
        title: label,
        ariaLabel: label,
        svg,
      }) as unknown as ScrollableBarItem;

    return [
      makeItem('left', leftLabel, ROTATE_LEFT_SVG),
      makeItem('right', rightLabel, ROTATE_RIGHT_SVG),
    ];
  }

  onSelectRotate(id: string): void {
    if (id === 'left') {
      this.editorState.rotateLeft();
      return;
    }

    if (id === 'right') {
      this.editorState.rotateRight();
    }
  }
}
