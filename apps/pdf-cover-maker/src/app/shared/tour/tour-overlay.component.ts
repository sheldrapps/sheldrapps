import { CommonModule, NgStyle } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

import { TourService } from './tour.service';

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule, NgStyle, IonButton, TranslateModule],
  template: `
    @if (state().active) {
      <div class="tour-overlay" aria-live="polite" role="dialog">
        @if (state().spotlightRect; as rect) {
          <div
            class="tour-spotlight"
            [style.top.px]="rect.top"
            [style.left.px]="rect.left"
            [style.width.px]="rect.width"
            [style.height.px]="rect.height"
          ></div>
        } @else {
          <div class="tour-backdrop"></div>
        }

        <div class="tour-tooltip" [ngStyle]="state().tooltipStyle">
          <div class="tour-progress">
            {{
              'HOME_TOUR.CONTROLS.PROGRESS'
                | translate:{ current: state().displayCurrent, total: state().displayTotal }
            }}
          </div>

          <h3 class="tour-title">{{ state().currentStep?.title }}</h3>
          <p class="tour-description">{{ state().currentStep?.description }}</p>
          @if (!state().canFinish) {
            <p class="tour-hint">
              {{ 'HOME_TOUR.CONTROLS.INTERACT_HINT' | translate }}
            </p>
          }

          <div class="tour-actions">
            <ion-button
              fill="clear"
              size="small"
              [disabled]="!state().canGoBack"
              (click)="back()"
            >
              {{ 'HOME_TOUR.CONTROLS.BACK' | translate }}
            </ion-button>

            <div class="tour-actions-spacer"></div>

            <ion-button fill="clear" size="small" (click)="skip()">
              {{ 'HOME_TOUR.CONTROLS.SKIP' | translate }}
            </ion-button>

            @if (state().canFinish) {
              <ion-button size="small" (click)="next()">
                {{ 'HOME_TOUR.CONTROLS.FINISH' | translate }}
              </ion-button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .tour-overlay {
        inset: 0;
        position: fixed;
        z-index: 10020;
        pointer-events: none;
      }

      .tour-backdrop {
        inset: 0;
        position: fixed;
        background: rgba(6, 12, 21, 0.72);
      }

      .tour-spotlight {
        position: fixed;
        border-radius: 24px;
        box-shadow: 0 0 0 9999px rgba(6, 12, 21, 0.72);
        border: 2px solid rgba(255, 255, 255, 0.88);
        background: transparent;
      }

      .tour-tooltip {
        position: fixed;
        pointer-events: auto;
        border-radius: 24px;
        background: #fffdf8;
        color: #1d2430;
        box-shadow: 0 22px 60px rgba(9, 17, 31, 0.24);
        padding: 18px 18px 16px;
        max-width: calc(100vw - 24px);
      }

      .tour-progress {
        color: #7c6235;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .tour-title {
        margin: 10px 0 8px;
        font-size: 1.05rem;
        line-height: 1.2;
      }

      .tour-description {
        margin: 0;
        color: #455065;
        font-size: 0.96rem;
        line-height: 1.45;
        white-space: pre-line;
      }

      .tour-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 14px;
      }

      .tour-hint {
        margin: 12px 0 0;
        color: #7c6235;
        font-size: 0.86rem;
        line-height: 1.35;
      }

      .tour-actions-spacer {
        flex: 1 1 auto;
      }
    `,
  ],
})
export class TourOverlayComponent {
  private readonly tour = inject(TourService);

  readonly state = computed(() => this.tour.state());

  async back(): Promise<void> {
    await this.tour.back();
  }

  async next(): Promise<void> {
    await this.tour.next();
  }

  async skip(): Promise<void> {
    await this.tour.skip();
  }
}
