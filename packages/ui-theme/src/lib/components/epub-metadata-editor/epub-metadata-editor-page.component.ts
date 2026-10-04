import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { documentOutline } from 'ionicons/icons';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { ActionCardComponent } from '../action-card/action-card.component';
import { EpubMetadataEditorComponent } from './epub-metadata-editor.component';
import { EpubMetadataEditorPageService } from './epub-metadata-editor-page.service';
import type { EpubMetadataFormValue } from './epub-metadata-editor.types';

function describeSaveError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  const record = error as Record<string, unknown>;
  const details =
    record['details'] && typeof record['details'] === 'object'
      ? (record['details'] as Record<string, unknown>)
      : {};
  const code = typeof record['code'] === 'string' ? record['code'] : undefined;
  const stage = typeof details['stage'] === 'string' ? details['stage'] : undefined;
  const message =
    typeof details['message'] === 'string'
      ? details['message']
      : typeof record['message'] === 'string'
        ? record['message']
        : undefined;

  return [code, stage, message].filter(Boolean).join(' · ') || 'Unknown error';
}
@Component({
  selector: 'app-epub-metadata-editor-page',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonToolbar,
    EpubMetadataEditorComponent,
    ActionCardComponent,
  ],
  templateUrl: './epub-metadata-editor-page.component.html',
  styleUrls: ['./epub-metadata-editor-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpubMetadataEditorPageComponent implements OnDestroy {
  private readonly page = inject(EpubMetadataEditorPageService);
  private readonly router = inject(Router);
  @ViewChild('metadataEditor')
  private editor?: EpubMetadataEditorComponent;

  readonly state = this.page.state;
  readonly backHref = computed(() => this.state()?.returnUrl ?? '/tabs');
  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly isLoadingMore = signal(false);
  readonly loadMoreError = signal<string | null>(null);
  private observedState = this.page.state();

  constructor() {
    addIcons({ documentOutline });
    effect(() => {
      const state = this.state();
      if (state === this.observedState) return;

      this.observedState = state;
      this.isSaving.set(false);
      this.saveError.set(null);
      this.isLoadingMore.set(false);
      this.loadMoreError.set(null);
    });
  }

  onDone(): void {
    if (this.isSaving()) return;
    this.saveError.set(null);
    if (!this.editor) {
      this.saveError.set('EDITOR_NOT_READY');
      return;
    }
    this.editor.saveMetadata();
  }

  async onSave(metadata: EpubMetadataFormValue): Promise<void> {
    const state = this.state();
    if (!state) return;

    this.isSaving.set(true);
    this.saveError.set(null);
    try {
      await state.saveHandler?.(metadata);
      if (this.state() !== state) return;
      await this.router.navigateByUrl(state.returnUrl);
    } catch (error) {
      if (this.state() !== state) return;
      console.error('[epub-metadata-editor] save failed', error);
      this.saveError.set(describeSaveError(error));
    } finally {
      if (this.state() === state) this.isSaving.set(false);
    }
  }

  async onLoadMore(): Promise<void> {
    const state = this.state();
    if (!state?.loadMore || this.isLoadingMore()) return;

    this.isLoadingMore.set(true);
    this.loadMoreError.set(null);
    try {
      await state.loadMore.handler();
      if (this.state() !== state) return;
    } catch (error) {
      if (this.state() !== state) return;
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: unknown }).code)
          : error instanceof Error
            ? error.message
            : String(error);
      if (code !== 'PICK_CANCELLED') {
        this.loadMoreError.set(state.loadMore.errorKey);
      }
    } finally {
      if (this.state() === state) this.isLoadingMore.set(false);
    }
  }

  ngOnDestroy(): void {
    this.page.clear();
  }
}
