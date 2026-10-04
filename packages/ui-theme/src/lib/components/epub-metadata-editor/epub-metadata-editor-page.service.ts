import { Injectable, signal } from '@angular/core';
import type {
  EpubMetadataEditorInput,
  EpubMetadataFormValue,
} from './epub-metadata-editor.types';

export interface EpubMetadataEditorLoadMoreAction {
  handler: () => void | Promise<void>;
  labelKey: string;
  loadingLabelKey: string;
  descriptionKey: string;
  errorKey: string;
}

export interface EpubMetadataEditorPageState {
  input: EpubMetadataEditorInput;
  returnUrl: string;
  saveHandler?: (metadata: EpubMetadataFormValue) => void | Promise<void>;
  cancelHandler?: () => void | Promise<void>;
  loadMore?: EpubMetadataEditorLoadMoreAction;
}

@Injectable({ providedIn: 'root' })
export class EpubMetadataEditorPageService {
  private readonly pageState = signal<EpubMetadataEditorPageState | null>(null);
  readonly state = this.pageState.asReadonly();

  open(state: EpubMetadataEditorPageState): void {
    this.pageState.set(state);
  }

  clear(): void {
    this.pageState.set(null);
  }
}
