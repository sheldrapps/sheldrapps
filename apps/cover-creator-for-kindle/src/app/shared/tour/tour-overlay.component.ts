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
      <div
        class="tour-overlay"
        aria-live="polite"
        aria-modal="true"
        role="dialog"
        [attr.aria-labelledby]="'tour-title'"
        [attr.aria-describedby]="'tour-description'"
      >
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
          <div class="tour-tooltip__header">
            <div class="tour-progress">
              {{
                'HOME_TOUR.CONTROLS.PROGRESS'
                  | translate:{ current: state().displayCurrent, total: state().displayTotal }
              }}
            </div>
          </div>

          <div class="tour-tooltip__body">
            <h3 id="tour-title" class="tour-title">{{ state().currentStep?.title }}</h3>
            <p id="tour-description" class="tour-description">
              {{ state().currentStep?.description }}
            </p>
            @if (!state().canFinish) {
              <p class="tour-hint">
                {{ 'HOME_TOUR.CONTROLS.INTERACT_HINT' | translate }}
              </p>
            }
          </div>

          <div class="tour-actions">
            <div class="tour-actions__group">
              <ion-button
                class="tour-action tour-action--back"
                fill="clear"
                size="small"
                [disabled]="!state().canGoBack"
                (click)="back()"
              >
                {{ 'HOME_TOUR.CONTROLS.BACK' | translate }}
              </ion-button>

              <ion-button class="tour-action tour-action--skip" fill="clear" size="small" (click)="skip()">
                {{ 'HOME_TOUR.CONTROLS.SKIP' | translate }}
              </ion-button>
            </div>

            @if (state().canFinish) {
              <ion-button class="tour-action tour-action--finish" size="small" (click)="next()">
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
        z-index: 2147483000;
        pointer-events: none;
        isolation: isolate;
      }

      .tour-backdrop {
        inset: 0;
        position: fixed;
        background: var(--app-overlay-scrim);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }

      .tour-spotlight {
        position: fixed;
        border-radius: var(--app-radius-lg);
        box-shadow:
          0 0 0 9999px var(--app-overlay-scrim),
          0 0 0 2px rgba(var(--ion-color-primary-rgb), 0.6);
        background: transparent;
        transition:
          top var(--app-dur-med) var(--app-ease),
          left var(--app-dur-med) var(--app-ease),
          width var(--app-dur-med) var(--app-ease),
          height var(--app-dur-med) var(--app-ease);
      }

      .tour-tooltip {
        position: fixed;
        pointer-events: auto;
        display: grid;
        gap: var(--app-space-4);
        width: min(420px, calc(100vw - var(--app-space-6)));
        padding: var(--app-space-5);
        border: 1px solid var(--app-divider);
        border-radius: var(--app-radius-lg);
        background: var(--app-overlay-card-background);
        color: var(--app-text-primary);
        box-shadow: var(--app-overlay-card-shadow);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        animation: tour-tooltip-enter var(--app-dur-med) var(--app-ease);
      }

      .tour-tooltip::before {
        content: '';
        height: 3px;
        border-radius: 999px;
        background: linear-gradient(
          90deg,
          rgba(var(--ion-color-primary-rgb), 0.92),
          rgba(var(--ion-color-primary-rgb), 0.24)
        );
      }

      .tour-tooltip__header {
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      }

      .tour-progress {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        padding: 0 var(--app-space-3);
        border-radius: 999px;
        background: rgba(var(--ion-color-primary-rgb), 0.1);
        color: var(--ion-color-primary);
        font-size: var(--app-text-2xs);
        font-weight: var(--app-font-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .tour-tooltip__body {
        display: grid;
        gap: var(--app-space-3);
      }

      .tour-title {
        margin: 0;
        font-size: 1.05rem;
        line-height: 1.2;
        font-weight: var(--app-font-strong);
        color: var(--app-text-primary);
      }

      .tour-description {
        margin: 0;
        color: var(--app-text-secondary);
        font-size: var(--app-text-sm);
        line-height: 1.5;
        white-space: pre-line;
      }

      .tour-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--app-space-3);
        flex-wrap: wrap;
      }

      .tour-hint {
        margin: 0;
        padding: var(--app-space-3) var(--app-space-4);
        border-radius: var(--app-radius-md);
        background: rgba(var(--ion-color-primary-rgb), 0.08);
        color: var(--app-text-primary);
        font-size: var(--app-text-xs);
        line-height: 1.45;
      }

      .tour-actions__group {
        display: flex;
        align-items: center;
        gap: var(--app-space-2);
        flex-wrap: wrap;
      }

      .tour-action {
        --padding-start: var(--app-space-4);
        --padding-end: var(--app-space-4);
        --border-radius: 999px;
        --box-shadow: none;
        margin: 0;
        min-height: var(--app-touch-target);
        font-weight: var(--app-font-semibold);
      }

      .tour-action--back,
      .tour-action--skip {
        --color: var(--app-text-secondary);
      }

      .tour-action--finish {
        --background: var(--ion-color-primary);
        --color: var(--ion-color-primary-contrast);
      }

      @keyframes tour-tooltip-enter {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .tour-tooltip,
        .tour-spotlight {
          animation: none;
          transition: none;
        }
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
