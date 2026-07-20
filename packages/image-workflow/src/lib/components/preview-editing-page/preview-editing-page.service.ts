import { Injectable, signal } from '@angular/core';

export type PreviewEditingPageMode = 'single' | 'compare';

export type PreviewEditingPageState = {
  imageSrc: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  beforeSrc?: string | null;
  afterSrc?: string | null;
  beforeLabel?: string | null;
  afterLabel?: string | null;
  mode?: PreviewEditingPageMode;
  comparisonEnabled?: boolean;
  isDithered?: boolean;
  titleKey?: string;
  returnUrl: string;
};

@Injectable({ providedIn: 'root' })
export class PreviewEditingPageService {
  private readonly pageState = signal<PreviewEditingPageState | null>(null);
  readonly state = this.pageState.asReadonly();

  open(state: PreviewEditingPageState): void {
    this.pageState.set({
      mode: 'single',
      comparisonEnabled: true,
      isDithered: false,
      titleKey: 'IMAGE_WORKFLOW.PREVIEW_TITLE',
      ...state,
    });
  }

  clear(): void {
    this.pageState.set(null);
  }
}
