import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { Subscription, filter } from 'rxjs';
import { App } from '@capacitor/app';
import { PluginListenerHandle } from '@capacitor/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { addIcons } from 'ionicons';
import {
  ellipsisVertical,
  shareOutline,
  trashOutline,
  closeCircleOutline,
  alertCircleOutline,
} from 'ionicons/icons';
import { FileService } from '../../services/file.service';
import { CoversEventsService } from '../../services/covers-events.service';
import {
  CoverListAction,
  CoverListActionEvent,
  CoverListContentComponent,
  CoverListItem,
  CoverPreviewModalComponent,
  PreviewAction,
  PreviewActionClickEvent,
  PreviewUnavailableConfig,
} from '@sheldrapps/covers-list-kit';

type UiCoverItem = {
  filename: string;
  thumbDataUrl?: string;
};

@Component({
  selector: 'app-my-epubs',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    CoverListContentComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    CoverPreviewModalComponent,
  ],
  templateUrl: './my-epubs.page.html',
  styleUrls: ['./my-epubs.page.scss'],
})
export class MyEpubsPage implements OnInit, OnDestroy {
  private files = inject(FileService);
  private alertCtrl = inject(AlertController);
  private translate = inject(TranslateService);
  private coversEvents = inject(CoversEventsService);
  private toastCtrl = inject(ToastController);

  @ViewChild(IonContent) content!: IonContent;
  @ViewChild(CoverListContentComponent) listContent?: CoverListContentComponent;
  loading = true;
  items: UiCoverItem[] = [];

  pageErrorKey: string | null = null;
  pageErrorParams: Record<string, any> | null = null;

  readonly listActions: CoverListAction[] = [
    {
      id: 'share',
      labelKey: 'COVERS.ACTIONS.SHARE',
      icon: 'share-outline',
    },
    {
      id: 'delete',
      labelKey: 'COVERS.ACTIONS.DELETE',
      icon: 'trash-outline',
    },
  ];
  readonly displayFilename = (filename: string): string =>
    filename.replace(/\.epub$/i, '');

  private coversEventsSub?: Subscription;
  private appStateListener?: PluginListenerHandle;
  private localDeletedFilenames = new Set<string>();
  private thumbsLoadToken = 0;
  private hasLoadedOnce = false;
  private needsReload = true;
  private isViewActive = false;
  private isLoadInProgress = false;
  private readonly logPrefix = 'ECC:my-epubs';

  // Preview Modal
  previewOpen = false;
  previewFilename: string | null = null;
  previewDataUrl: string | null = null;
  previewLoading = false;
  previewUnavailable = false;
  previewGettingCover = false;
  // Preview Modal

  constructor() {
    addIcons({
      closeCircleOutline,
      ellipsisVertical,
      shareOutline,
      trashOutline,
      alertCircleOutline,
    });
  }

  ngOnDestroy(): void {
    this.coversEventsSub?.unsubscribe();
    void this.appStateListener?.remove();
  }

  ngOnInit() {
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && this.isViewActive) {
        // Silent: no loading spinner. We only came back from background
        // (e.g. returning from Settings after granting permission).
        void this.load(undefined, { silent: true });
      }
    }).then((handle) => {
      this.appStateListener = handle;
    });

    this.coversEventsSub = this.coversEvents.events$
      .pipe(filter((e) => e.type === 'saved' || e.type === 'deleted'))
      .subscribe((event) => {
        const filename = event.filename;

        if (
          event.type === 'deleted' &&
          filename &&
          this.localDeletedFilenames.has(filename)
        ) {
          this.localDeletedFilenames.delete(filename);
          return;
        }

        this.needsReload = true;
        this.logInfo('libraryReload:trigger', {
          reason: `covers-event:${event.type}`,
          filename,
          triggeredAt: new Date().toISOString(),
        });
        if (this.isViewActive) {
          void this.load();
        }
      });
  }

  async load(ev?: CustomEvent, opts?: { silent?: boolean }) {
    // Skip concurrent automatic loads; pull-to-refresh always runs.
    if (!ev && this.isLoadInProgress) {
      this.logInfo('libraryReload:skipped', {
        reason: 'already-in-progress',
        triggeredAt: new Date().toISOString(),
      });
      return;
    }

    this.isLoadInProgress = true;
    const silent = !!opts?.silent;
    this.logInfo('libraryReload:start', {
      reason: ev
        ? 'pull-to-refresh'
        : silent
          ? 'app-state-change'
          : 'view-load',
      triggeredAt: new Date().toISOString(),
    });
    // Only show spinner for explicit view-load or pull-to-refresh, not
    // silent background refreshes (e.g. returning from Android Settings).
    if (!silent) {
      this.loading = !ev;
    }
    this.pageErrorKey = null;
    this.pageErrorParams = null;
    const loadToken = ++this.thumbsLoadToken;

    try {
      const entries = await this.files.listCovers({
        allowAllFilesAccessPrompt: !!ev,
        includeAndroidExternalFallback: false,
      });
      this.logInfo('libraryReload:listCoversResult', {
        count: entries.length,
        filenames: entries.map((entry) => entry.filename),
      });
      const items: UiCoverItem[] = entries.map((e) => ({
        filename: e.filename,
      }));
      this.items = items;
      this.hasLoadedOnce = true;
      this.needsReload = false;
      this.loading = false;
      ev?.target && (ev.target as any).complete();
      void this.loadThumbsResilient(items, loadToken);
      // Prompt only on explicit pull-to-refresh (ev present).
      void this.loadExternalFallbackInBackground(loadToken, !!ev);
    } catch (error) {
      this.logInfo('libraryReload:failed', {
        triggeredAt: new Date().toISOString(),
        error: this.errorDetails(error),
      });
      this.items = [];
      this.pageErrorKey = 'COVERS.ERROR.LOAD';
      this.loading = false;
      ev?.target && (ev.target as any).complete();
    } finally {
      this.isLoadInProgress = false;
    }
  }

  private async loadExternalFallbackInBackground(
    loadToken: number,
    allowPrompt: boolean,
  ): Promise<void> {
    try {
      const entries = await this.files.listCoversFromAndroidExternalFallback({
        allowAllFilesAccessPrompt: allowPrompt,
      });
      if (loadToken !== this.thumbsLoadToken || entries.length === 0) {
        return;
      }

      const existing = new Set(
        this.items.map((item) => item.filename.trim().toLowerCase()),
      );
      const newItems = entries
        .filter((entry) => !existing.has(entry.filename.trim().toLowerCase()))
        .map((entry) => ({ filename: entry.filename }));

      if (newItems.length === 0 || loadToken !== this.thumbsLoadToken) {
        return;
      }

      this.items = [...this.items, ...newItems].sort((a, b) =>
        a.filename.localeCompare(b.filename),
      );
      this.logInfo('libraryReload:externalFallbackMerged', {
        added: newItems.length,
        total: this.items.length,
        filenames: newItems.map((item) => item.filename),
      });

      void this.loadThumbsForItemsResilient(newItems, loadToken);
    } catch (error) {
      this.logInfo('libraryReload:externalFallbackFailed', {
        error: this.errorDetails(error),
      });
    }
  }

  private async loadThumbsResilient(items: UiCoverItem[], loadToken: number) {
    const concurrency = 6;
    let i = 0;

    const worker = async () => {
      while (i < items.length) {
        if (loadToken !== this.thumbsLoadToken) return;
        const idx = i++;
        const item = items[idx];
        const dataUrl = await this.files.getOrBuildThumbDataUrlForFilename(
          item.filename,
        );
        item.thumbDataUrl = dataUrl ?? undefined;

        if (idx % 4 === 0 && loadToken === this.thumbsLoadToken) {
          this.items = [...items];
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    if (loadToken === this.thumbsLoadToken) {
      this.items = [...items];
    }
  }

  private async loadThumbsForItemsResilient(
    targets: UiCoverItem[],
    loadToken: number,
  ): Promise<void> {
    const concurrency = 4;
    let i = 0;

    const worker = async () => {
      while (i < targets.length) {
        if (loadToken !== this.thumbsLoadToken) return;
        const idx = i++;
        const item = targets[idx];
        const dataUrl = await this.files.getOrBuildThumbDataUrlForFilename(
          item.filename,
        );
        item.thumbDataUrl = dataUrl ?? undefined;

        if (idx % 2 === 0 && loadToken === this.thumbsLoadToken) {
          this.items = [...this.items];
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    if (loadToken === this.thumbsLoadToken) {
      this.items = [...this.items];
    }
  }

  onListScrollStart() {
    this.listContent?.onHostScrollStart();
  }

  onListScrollEnd() {
    this.listContent?.onHostScrollEnd();
  }

  onListItemClick(item: CoverListItem) {
    void this.openPreview(item.filename);
  }

  onListAction(event: CoverListActionEvent) {
    if (event.actionId === 'share') {
      void this.shareByFilename(event.item.filename);
      return;
    }
    if (event.actionId === 'delete') {
      void this.deleteFromList(event.item.filename);
    }
  }

  get previewHeaderActions(): PreviewAction[] {
    return [
      {
        id: 'close',
        labelKey: 'COMMON.CLOSE',
        layout: 'text',
        cssClass: 'preview-cancel',
      },
    ];
  }

  get previewFooterActions(): PreviewAction[] {
    const disabled = this.previewLoading || !this.previewFilename;
    return [
      {
        id: 'share',
        labelKey: 'COMMON.SHARE',
        icon: 'share-outline',
        layout: 'icon-text',
        cssClass: 'ctrl',
        disabled,
      },
      {
        id: 'delete',
        labelKey: 'COMMON.DELETE',
        icon: 'trash-outline',
        layout: 'icon-text',
        cssClass: 'ctrl',
        disabled,
      },
    ];
  }

  get previewUnavailableConfig(): PreviewUnavailableConfig {
    return {
      visible: this.previewUnavailable,
      textKey: 'COVERS.PREVIEW_UNAVAILABLE',
      action: {
        id: 'regenerate-thumb',
        labelKey: 'COVERS.GENERATE_THUMB',
        fill: 'outline',
        size: 'small',
        disabled: this.previewLoading || !this.previewFilename,
      },
    };
  }

  onPreviewAction(event: PreviewActionClickEvent) {
    if (event.actionId === 'close') {
      this.closePreview();
      return;
    }
    if (event.actionId === 'share') {
      void this.sharePreview();
      return;
    }
    if (event.actionId === 'delete') {
      void this.deletePreview();
      return;
    }
    if (event.actionId === 'regenerate-thumb') {
      void this.regeneratePreviewThumb();
    }
  }

  async openPreview(filename: string) {
    const fallbackThumb =
      this.items.find((item) => item.filename === filename)?.thumbDataUrl ??
      null;

    this.previewOpen = true;
    this.previewFilename = filename;
    this.previewDataUrl = fallbackThumb;
    this.previewLoading = true;
    this.previewUnavailable = false;
    this.previewGettingCover = false;

    try {
      const hasCoverExport =
        await this.files.hasCoverExportForFilename(filename);
      this.previewGettingCover = !hasCoverExport;

      const preview = await this.files.getBestPreviewCoverDataUrl(filename, {
        allowNativeExtract: true,
      });
      this.previewDataUrl = preview.dataUrl ?? fallbackThumb;
      this.previewUnavailable = !this.previewDataUrl;
    } catch {
      this.previewDataUrl = this.previewDataUrl ?? fallbackThumb;
      this.previewUnavailable = !this.previewDataUrl;
      this.pageErrorKey = 'COVERS.ERROR.PREVIEW';
    } finally {
      this.previewLoading = false;
      this.previewGettingCover = false;
    }
  }

  async regeneratePreviewThumb() {
    const filename = this.previewFilename;
    if (!filename || this.previewLoading) return;

    this.previewLoading = true;
    this.previewUnavailable = false;
    this.previewGettingCover = true;
    this.previewDataUrl = null;

    try {
      const preview = await this.files.getBestPreviewCoverDataUrl(filename, {
        forceRebuildThumb: true,
        allowNativeExtract: true,
      });
      this.previewDataUrl = preview.dataUrl;
      this.previewUnavailable = !preview.dataUrl;
    } catch {
      this.previewUnavailable = true;
      this.pageErrorKey = 'COVERS.ERROR.PREVIEW';
    } finally {
      this.previewLoading = false;
      this.previewGettingCover = false;
    }
  }

  async sharePreview() {
    const filename = this.previewFilename;
    if (!filename) return;
    await this.shareByFilename(filename);
  }

  async deletePreview() {
    const filename = this.previewFilename;
    if (!filename) return;

    const alert = await this.alertCtrl.create({
      header: this.translate.instant('COVERS.DELETE.TITLE'),
      message: this.translate.instant('COVERS.DELETE.MESSAGE'),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('COMMON.DELETE'),
          role: 'destructive',
          handler: async () => {
            await this.deleteByFilename(filename);
            this.closePreview();
          },
        },
      ],
    });

    await alert.present();
  }

  closePreview() {
    this.previewOpen = false;
    this.previewFilename = null;
    this.previewDataUrl = null;
    this.previewLoading = false;
    this.previewUnavailable = false;
    this.previewGettingCover = false;
  }

  async deleteFromList(filename: string) {
    const scrollTop = await this.getScrollTop();

    const alert = await this.alertCtrl.create({
      header: this.translate.instant('COVERS.DELETE.TITLE'),
      message: this.translate.instant('COVERS.DELETE.MESSAGE'),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('COMMON.DELETE'),
          role: 'destructive',
          handler: async () => {
            await this.deleteByFilename(filename, { markLocalDelete: true });
            await this.restoreScrollTop(scrollTop);
          },
        },
      ],
    });

    await alert.present();
  }

  async ionViewWillEnter() {
    this.isViewActive = true;
    this.needsReload = true;
    this.logInfo('libraryReload:trigger', {
      reason: 'ionViewWillEnter',
      triggeredAt: new Date().toISOString(),
    });
    await this.load();
  }

  ionViewDidLeave() {
    this.isViewActive = false;
  }

  private async shareByFilename(filename: string): Promise<void> {
    this.pageErrorKey = null;
    this.pageErrorParams = null;

    try {
      await this.files.shareCoverByFilename(filename);
    } catch {
      this.pageErrorKey = 'COVERS.ERROR.SHARE';
    }
  }

  private async deleteByFilename(
    filename: string,
    opts?: { markLocalDelete?: boolean },
  ): Promise<void> {
    this.pageErrorKey = null;
    this.pageErrorParams = null;

    try {
      await this.files.deleteCoverByFilename(filename);
      this.items = this.items.filter((x) => x.filename !== filename);
      if (opts?.markLocalDelete) {
        this.localDeletedFilenames.add(filename);
      }
      this.coversEvents.emit({ type: 'deleted', filename });
      await this.showToast('COVERS.DELETED');
    } catch {
      this.pageErrorKey = 'COVERS.ERROR.DELETE';
    }
  }

  private async showToast(messageKey: string, duration = 1600) {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant(messageKey),
      duration,
      position: 'middle',
      cssClass: ['cc-toast', 'cc-toast--success'],
    });
    await toast.present();
  }

  private async getScrollTop(): Promise<number> {
    if (!this.content) return 0;
    const el = await this.content.getScrollElement();
    return el?.scrollTop ?? 0;
  }

  private async restoreScrollTop(scrollTop: number) {
    if (!this.content) return;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    await this.content.scrollToPoint(0, scrollTop, 0);
  }

  private logInfo(event: string, payload?: Record<string, unknown>): void {
    const suffix = payload ? ` ${JSON.stringify(payload)}` : '';
    console.info(`[${this.logPrefix}] ${event}${suffix}`);
  }

  private errorDetails(error: unknown): Record<string, unknown> {
    if (error && typeof error === 'object') {
      const e = error as {
        name?: unknown;
        message?: unknown;
        code?: unknown;
        stack?: unknown;
      };
      return {
        name: typeof e.name === 'string' ? e.name : undefined,
        message: typeof e.message === 'string' ? e.message : undefined,
        code:
          typeof e.code === 'string' || typeof e.code === 'number'
            ? e.code
            : undefined,
        stack: typeof e.stack === 'string' ? e.stack : undefined,
      };
    }
    return { message: String(error) };
  }
}
