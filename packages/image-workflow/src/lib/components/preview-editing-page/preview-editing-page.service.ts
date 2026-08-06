import { Injectable, signal } from '@angular/core';

export type PreviewEditingPageMode = 'single' | 'compare';

export type PreviewEditingPageAction = {
  id: string;
  labelKey: string;
  icon?: string;
  iconSvg?: 'rename';
  disabled?: boolean;
  hidden?: boolean;
};

export type PreviewEditingPageMetadata = {
  name?: string | null;
  size?: string | null;
};

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
  footerActions?: PreviewEditingPageAction[];
  actionHandler?: (actionId: string) => void;
  metadata?: PreviewEditingPageMetadata | null;
  loading?: boolean;
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
      loading: false,
      titleKey: 'IMAGE_WORKFLOW.PREVIEW_TITLE',
      ...state,
    });
  }

  updateMetadataName(name: string): void {
    const current = this.pageState();
    if (!current) return;

    this.pageState.set({
      ...current,
      metadata: {
        ...current.metadata,
        name,
      },
    });
  }

  setLoading(loading: boolean): void {
    const current = this.pageState();
    if (!current) return;

    this.pageState.set({ ...current, loading });
  }

  clear(): void {
    this.pageState.set(null);
  }
}
