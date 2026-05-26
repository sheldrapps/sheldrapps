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
  openOutline,
  shareOutline,
  trashOutline,
  closeCircleOutline,
  alertCircleOutline,
} from 'ionicons/icons';
import {
  FileService,
  ResolvedCoverPreviewAsset,
} from '../../services/file.service';
import { CoversEventsService } from '../../services/covers-events.service';
import {
  CoverListAction,
  CoverListActionEvent,
  CoverListContentComponent,
  CoverListItem,
  CoverPreviewModalComponent,
  PreviewAction,
  PreviewActionClickEvent,
  PreviewMetadata,
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
      id: 'open',
      labelKey: 'COVERS.ACTIONS.OPEN',
      icon: 'open-outline',
    },
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
  previewIsDithered = false;
  previewLoading = false;
  previewUnavailable = false;
  previewGettingCover = false;
  previewFileSizeLabel: string | null = null;
  // Preview Modal

  constructor() {
    addIcons({
      closeCircleOutline,
      ellipsisVertical,
      openOutline,
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
      const entries = await this.files.listCovers();
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
    if (event.actionId === 'open') {
      void this.openByFilename(event.item.filename);
      return;
    }
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
        id: 'open',
        labelKey: 'COVERS.ACTIONS.OPEN',
        icon: 'open-outline',
        layout: 'icon-text',
        cssClass: 'ctrl',
        disabled,
      },
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

  get previewMetadata(): PreviewMetadata | null {
    const filename = this.previewFilename;
    if (!filename) {
      return null;
    }

    return {
      name: this.displayFilename(filename),
      size: this.previewFileSizeLabel,
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
    if (event.actionId === 'open') {
      void this.openPreviewExternal();
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
    this.previewIsDithered = false;
    this.previewLoading = true;
    this.previewUnavailable = false;
    this.previewGettingCover = false;
    this.previewFileSizeLabel = null;
    void this.loadPreviewFileSizeLabel(filename);

    try {
      const hasCoverExport =
        await this.files.hasCoverExportForFilename(filename);
      this.previewGettingCover = !hasCoverExport;

      const preview: ResolvedCoverPreviewAsset =
        await this.files.resolveCoverPreviewAsset(filename, {
          allowNativeExtract: true,
        });
      this.previewDataUrl = preview.src || fallbackThumb;
      this.previewIsDithered = preview.isDithered;
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
    this.previewIsDithered = false;

    try {
      const preview = await this.files.resolveCoverPreviewAsset(filename, {
        forceRebuildThumb: true,
        allowNativeExtract: true,
        forceRefresh: true,
      });
      this.previewDataUrl = preview.src || null;
      this.previewIsDithered = preview.isDithered;
      this.previewUnavailable = !preview.src;
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

  async openPreviewExternal() {
    const filename = this.previewFilename;
    if (!filename) return;
    await this.openByFilename(filename);
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
    this.previewIsDithered = false;
    this.previewLoading = false;
    this.previewUnavailable = false;
    this.previewGettingCover = false;
    this.previewFileSizeLabel = null;
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

  private async openByFilename(filename: string): Promise<void> {
    this.pageErrorKey = null;
    this.pageErrorParams = null;

    try {
      await this.files.openCoverByFilename(filename);
    } catch {
      this.pageErrorKey = 'COVERS.ERROR.OPEN';
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

  private async loadPreviewFileSizeLabel(filename: string): Promise<void> {
    try {
      const bytes = await this.files.getCoverFileSizeBytes(filename);
      if (this.previewFilename !== filename) {
        return;
      }
      this.previewFileSizeLabel = this.formatFileSizeLabel(bytes);
    } catch {
      if (this.previewFilename === filename) {
        this.previewFileSizeLabel = null;
      }
    }
  }

  private formatFileSizeLabel(bytes: number | null): string | null {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) {
      return null;
    }

    const MB_IN_BYTES = 1024 * 1024;
    if (bytes >= MB_IN_BYTES) {
      const mb = bytes / MB_IN_BYTES;
      const rounded = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
      const value = Number.isInteger(rounded)
        ? String(rounded)
        : String(rounded).replace(/\.0$/, '');
      return `${value}mb`;
    }

    const kb = Math.max(1, Math.round(bytes / 1024));
    return `${kb}kb`;
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
