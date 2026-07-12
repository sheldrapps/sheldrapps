import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { type PluginListenerHandle } from '@capacitor/core';
import { Router } from '@angular/router';
import { AlertController, IonContent, IonHeader, IonTitle, IonToolbar, ToastController } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  closeCircleOutline,
  ellipsisVertical,
  folderOpenOutline,
  openOutline,
  shareOutline,
  trashOutline,
} from 'ionicons/icons';
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
import { CoversEventsService } from '../../services/covers-events.service';
import { EpubLibraryService } from '../../services/epub-library.service';

type UiEpubItem = {
  filename: string;
  thumbDataUrl?: string;
};

@Component({
  selector: 'app-my-epubs-page',
  standalone: true,
  templateUrl: './my-epubs.page.html',
  styleUrls: ['./my-epubs.page.scss'],
  imports: [
    CommonModule,
    TranslateModule,
    CoverListContentComponent,
    CoverPreviewModalComponent,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
  ],
})
export class MyEpubsPage implements OnInit, OnDestroy {
  private readonly library = inject(EpubLibraryService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly coversEvents = inject(CoversEventsService);

  @ViewChild(CoverListContentComponent) listContent?: CoverListContentComponent;

  loading = true;
  items: UiEpubItem[] = [];
  pageErrorKey: string | null = null;
  pageErrorParams: Record<string, unknown> | null = null;

  readonly listActions: CoverListAction[] = [
    {
      id: 'open',
      labelKey: 'MY_EPUBS.ACTION_OPEN',
      icon: 'open-outline',
    },
    {
      id: 'project',
      labelKey: 'MY_EPUBS.ACTION_EDIT',
      icon: 'folder-open-outline',
    },
    {
      id: 'share',
      labelKey: 'MY_EPUBS.ACTION_SHARE',
      icon: 'share-outline',
    },
    {
      id: 'delete',
      labelKey: 'MY_EPUBS.ACTION_DELETE',
      icon: 'trash-outline',
    },
  ];

  previewOpen = false;
  previewFilename: string | null = null;
  previewDataUrl: string | null = null;
  previewIsDithered = false;
  previewLoading = false;
  previewUnavailable = false;
  previewGettingCover = false;
  previewFileSizeLabel: string | null = null;

  private appStateListener?: PluginListenerHandle;
  private coversEventsSub?: Subscription;
  private isViewActive = false;
  private isLoadInProgress = false;
  private loadToken = 0;
  private readonly logPrefix = 'EF:my-epubs';

  constructor() {
    addIcons({
      alertCircleOutline,
      closeCircleOutline,
      ellipsisVertical,
      folderOpenOutline,
      openOutline,
      shareOutline,
      trashOutline,
    });
  }

  ngOnInit(): void {
    this.coversEventsSub = this.coversEvents.events$.subscribe((event) => {
      if (event.type !== 'saved' && event.type !== 'deleted') {
        return;
      }

      if (this.isViewActive) {
        void this.load(undefined, { silent: true });
      }
    });

    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && this.isViewActive) {
        void this.load(undefined, { silent: true });
      }
    }).then((handle) => {
      this.appStateListener = handle;
    });
  }

  ngOnDestroy(): void {
    this.coversEventsSub?.unsubscribe();
    void this.appStateListener?.remove();
  }

  async ionViewWillEnter(): Promise<void> {
    this.isViewActive = true;
    await this.load();
  }

  ionViewDidLeave(): void {
    this.isViewActive = false;
  }

  onListScrollStart(): void {
    this.listContent?.onHostScrollStart();
  }

  onListScrollEnd(): void {
    this.listContent?.onHostScrollEnd();
  }

  onListItemClick(item: CoverListItem): void {
    void this.openPreview(item.filename);
  }

  onListAction(event: CoverListActionEvent): void {
    if (event.actionId === 'open') {
      void this.openByFilename(event.item.filename);
      return;
    }
    if (event.actionId === 'project') {
      void this.openProjectByFilename(event.item.filename);
      return;
    }
    if (event.actionId === 'share') {
      void this.shareByFilename(event.item.filename);
      return;
    }
    if (event.actionId === 'delete') {
      void this.deleteByFilename(event.item.filename);
      return;
    }
  }

  readonly displayFilename = (filename: string): string =>
    filename.replace(/\.epub$/i, '');

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
        labelKey: 'MY_EPUBS.ACTION_OPEN',
        icon: 'open-outline',
        layout: 'icon-text',
        cssClass: 'ctrl',
        disabled,
      },
      {
        id: 'project',
        labelKey: 'MY_EPUBS.ACTION_EDIT',
        icon: 'folder-open-outline',
        layout: 'icon-text',
        cssClass: 'ctrl',
        disabled,
      },
      {
        id: 'share',
        labelKey: 'MY_EPUBS.ACTION_SHARE',
        icon: 'share-outline',
        layout: 'icon-text',
        cssClass: 'ctrl',
        disabled,
      },
      {
        id: 'delete',
        labelKey: 'MY_EPUBS.ACTION_DELETE',
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
      textKey: 'MY_EPUBS.PREVIEW_UNAVAILABLE',
      action: {
        id: 'regenerate-preview',
        labelKey: 'MY_EPUBS.REGENERATE_PREVIEW',
        fill: 'outline',
        size: 'small',
        disabled: this.previewLoading || !this.previewFilename,
      },
    };
  }

  get previewMetadata(): PreviewMetadata | null {
    if (!this.previewFilename) {
      return null;
    }

    return {
      name: this.displayFilename(this.previewFilename),
      size: this.previewFileSizeLabel,
    };
  }

  onPreviewAction(event: PreviewActionClickEvent): void {
    if (event.actionId === 'close') {
      this.closePreview();
      return;
    }
    if (event.actionId === 'open') {
      void this.openPreviewExternal();
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
    if (event.actionId === 'regenerate-preview') {
      void this.regeneratePreview();
      return;
    }
    if (event.actionId === 'project') {
      void this.openProjectByFilename(this.previewFilename);
      this.closePreview();
    }
  }

  async load(ev?: CustomEvent, opts?: { silent?: boolean }): Promise<void> {
    if (!ev && this.isLoadInProgress) {
      return;
    }

    this.isLoadInProgress = true;
    const silent = !!opts?.silent;
    if (!silent) {
      this.loading = !ev;
    }
    this.pageErrorKey = null;
    this.pageErrorParams = null;
    const currentToken = ++this.loadToken;

    try {
      const filenames = await this.library.listEpubs();
      const items: UiEpubItem[] = filenames.map((filename) => ({ filename }));
      this.items = items;
      this.loading = false;
      ev?.target && (ev.target as any).complete();
      void this.loadThumbs(items, currentToken);
    } catch (error) {
      this.logInfo('load:failed', { error: this.errorDetails(error) });
      this.items = [];
      this.pageErrorKey = 'MY_EPUBS.ERROR.LOAD';
      this.loading = false;
      ev?.target && (ev.target as any).complete();
    } finally {
      this.isLoadInProgress = false;
    }
  }

  private async loadThumbs(items: UiEpubItem[], token: number): Promise<void> {
    const concurrency = 4;
    let index = 0;

    const worker = async (): Promise<void> => {
      while (index < items.length) {
        if (token !== this.loadToken) {
          return;
        }

        const currentIndex = index++;
        const item = items[currentIndex];
        const preview = await this.library.resolvePreviewAsset(item.filename);
        item.thumbDataUrl = preview.src || undefined;

        if (currentIndex % 4 === 0 && token === this.loadToken) {
          this.items = [...items];
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    if (token === this.loadToken) {
      this.items = [...items];
    }
  }

  async openPreview(filename: string): Promise<void> {
    const fallbackThumb =
      this.items.find((item) => item.filename === filename)?.thumbDataUrl ??
      null;

    this.pageErrorKey = null;
    this.pageErrorParams = null;
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
      this.previewGettingCover = true;
      const preview = await this.library.resolvePreviewAsset(filename);
      this.previewDataUrl = preview.src || fallbackThumb;
      this.previewIsDithered = preview.isDithered;
      this.previewUnavailable = !this.previewDataUrl;
    } catch (error) {
      this.logInfo('preview:failed', { error: this.errorDetails(error) });
      this.previewDataUrl = this.previewDataUrl ?? fallbackThumb;
      this.previewUnavailable = !this.previewDataUrl;
      this.pageErrorKey = 'MY_EPUBS.ERROR.PREVIEW';
    } finally {
      this.previewLoading = false;
      this.previewGettingCover = false;
    }
  }

  async regeneratePreview(): Promise<void> {
    const filename = this.previewFilename;
    if (!filename || this.previewLoading) {
      return;
    }

    this.pageErrorKey = null;
    this.pageErrorParams = null;
    this.previewLoading = true;
    this.previewUnavailable = false;
    this.previewGettingCover = true;
    this.previewDataUrl = null;
    this.previewIsDithered = false;

    try {
      const preview = await this.library.resolvePreviewAsset(filename, {
        forceRefresh: true,
      });
      this.previewDataUrl = preview.src || null;
      this.previewIsDithered = preview.isDithered;
      this.previewUnavailable = !preview.src;
    } catch (error) {
      this.logInfo('preview:refreshFailed', { error: this.errorDetails(error) });
      this.previewUnavailable = true;
      this.pageErrorKey = 'MY_EPUBS.ERROR.PREVIEW';
    } finally {
      this.previewLoading = false;
      this.previewGettingCover = false;
    }
  }

  async sharePreview(): Promise<void> {
    const filename = this.previewFilename;
    if (!filename) {
      return;
    }

    await this.shareByFilename(filename);
  }

  async openPreviewExternal(): Promise<void> {
    const filename = this.previewFilename;
    if (!filename) {
      return;
    }

    await this.openByFilename(filename);
  }

  async deletePreview(): Promise<void> {
    const filename = this.previewFilename;
    if (!filename) {
      return;
    }

    const confirmed = await this.confirmDelete();
    if (!confirmed) {
      return;
    }

    await this.deleteByFilename(filename);
    this.closePreview();
  }

  closePreview(): void {
    this.previewOpen = false;
    this.previewFilename = null;
    this.previewDataUrl = null;
    this.previewIsDithered = false;
    this.previewLoading = false;
    this.previewUnavailable = false;
    this.previewGettingCover = false;
    this.previewFileSizeLabel = null;
  }

  private async openByFilename(filename: string): Promise<void> {
    this.pageErrorKey = null;
    this.pageErrorParams = null;

    try {
      await this.library.openByFilename(filename);
    } catch (error) {
      this.logInfo('open:failed', { error: this.errorDetails(error) });
      this.pageErrorKey = 'MY_EPUBS.ERROR.OPEN';
    }
  }

  private async openProjectByFilename(filename: string | null): Promise<void> {
    if (!filename) {
      return;
    }

    this.pageErrorKey = null;
    this.pageErrorParams = null;

    try {
      const navigated = await this.router.navigate(['/tabs/home'], {
        queryParams: { project: filename },
      });
      if (!navigated) {
        this.pageErrorKey = 'MY_EPUBS.ERROR.OPEN';
      }
    } catch {
      this.pageErrorKey = 'MY_EPUBS.ERROR.OPEN';
    }
  }

  private async shareByFilename(filename: string): Promise<void> {
    this.pageErrorKey = null;
    this.pageErrorParams = null;

    try {
      await this.library.shareByFilename(filename);
    } catch (error) {
      this.logInfo('share:failed', { error: this.errorDetails(error) });
      this.pageErrorKey = 'MY_EPUBS.ERROR.SHARE';
    }
  }

  private async deleteByFilename(filename: string): Promise<void> {
    this.pageErrorKey = null;
    this.pageErrorParams = null;

    try {
      await this.library.deleteByFilename(filename);
      this.items = this.items.filter((item) => item.filename !== filename);
      void this.showToast('MY_EPUBS.DELETED');
    } catch (error) {
      this.logInfo('delete:failed', { error: this.errorDetails(error) });
      this.pageErrorKey = 'MY_EPUBS.ERROR.DELETE';
    }
  }

  private async confirmDelete(): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('MY_EPUBS.DELETE_TITLE'),
      message: this.translate.instant('MY_EPUBS.DELETE_MESSAGE'),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('COMMON.DELETE'),
          role: 'destructive',
        },
      ],
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'destructive';
  }

  private async loadPreviewFileSizeLabel(filename: string): Promise<void> {
    try {
      const bytes = await this.library.getFileSizeBytes(filename);
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

  private async showToast(messageKey: string, duration = 1600): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant(messageKey),
      duration,
      position: 'middle',
      cssClass: ['cc-toast', 'cc-toast--success'],
    });
    await toast.present();
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
