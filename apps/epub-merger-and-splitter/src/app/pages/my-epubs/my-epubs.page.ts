import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  signal,
  inject,
} from '@angular/core';
import { App } from '@capacitor/app';
import { type PluginListenerHandle } from '@capacitor/core';
import { Router } from '@angular/router';
import { AlertController, IonContent, IonHeader, IonTitle, IonToolbar, ModalController, ToastController } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  closeCircleOutline,
  ellipsisVertical,
  openOutline,
  shareOutline,
  trashOutline,
} from 'ionicons/icons';
import {
  CoverListAction,
  CoverListActionEvent,
  CoverListContentComponent,
  CoverListItem,
} from '@sheldrapps/covers-list-kit';
import { PreviewEditingPageService } from '@sheldrapps/image-workflow';
import { CoversEventsService } from '../../services/covers-events.service';
import { EpubLibraryService } from '../../services/epub-library.service';
import { SaveCoverModalComponent } from '@sheldrapps/ui-theme';

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
  private readonly modalCtrl = inject(ModalController);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly previewPage = inject(PreviewEditingPageService);
  private readonly coversEvents = inject(CoversEventsService);
  private readonly zone = inject(NgZone);
  private readonly changeDetector = inject(ChangeDetectorRef);

  @ViewChild(CoverListContentComponent) listContent?: CoverListContentComponent;

  private readonly loadingState = signal(true);

  get loading(): boolean {
    return this.loadingState();
  }

  set loading(value: boolean) {
    this.loadingState.set(value);
  }
  items: UiEpubItem[] = [];
  private previewFilename: string | null = null;
  pageErrorKey: string | null = null;
  pageErrorParams: Record<string, unknown> | null = null;

  readonly listActions: CoverListAction[] = [
    {
      id: 'open',
      labelKey: 'UI_THEME.ACTIONS.OPEN',
      icon: 'open-outline',
    },
    {
      id: 'rename',
      labelKey: 'UI_THEME.ACTIONS.RENAME',
      iconSvg: 'rename',
    },
    {
      id: 'share',
      labelKey: 'UI_THEME.ACTIONS.SHARE',
      icon: 'share-outline',
    },
    {
      id: 'delete',
      labelKey: 'UI_THEME.ACTIONS.DELETE',
      icon: 'trash-outline',
    },
  ];

  private appStateListener?: PluginListenerHandle;
  private coversEventsSub?: Subscription;
  private isViewActive = false;
  private isLoadInProgress = false;
  private loadToken = 0;
  private readonly logPrefix = 'EMAS:my-epubs';

  constructor() {
    addIcons({
      alertCircleOutline,
      closeCircleOutline,
      ellipsisVertical,
      openOutline,
      shareOutline,
      trashOutline,
    });
  }

  private runInZone<T>(fn: () => T): T {
    return NgZone.isInAngularZone() ? fn() : this.zone.run(fn);
  }

  private async flushUi(): Promise<void> {
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    }
    this.runInZone(() => {
      this.changeDetector.markForCheck();
      this.changeDetector.detectChanges();
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
    if (event.actionId === 'rename') {
      void this.renameByFilename(event.item.filename);
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
      const records = await this.library.listRecords();
      const items: UiEpubItem[] = records.map((record) => ({
        filename: record.filename,
        thumbDataUrl: record.thumbnailUri,
      }));
      this.items = items;
      this.loading = false;
      await this.flushUi();
      ev?.target && (ev.target as any).complete();
      void this.loadThumbs(items, currentToken, !!ev);
    } catch (error) {
      this.logInfo('load:failed', { error: this.errorDetails(error) });
      this.items = [];
      this.pageErrorKey = 'MY_EPUBS.ERROR.LOAD';
      this.loading = false;
      await this.flushUi();
      ev?.target && (ev.target as any).complete();
    } finally {
      this.isLoadInProgress = false;
    }
  }

  private async loadThumbs(
    items: UiEpubItem[],
    token: number,
    forceRefresh: boolean,
  ): Promise<void> {
    const concurrency = 4;
    let index = 0;

    const worker = async (): Promise<void> => {
      while (index < items.length) {
        if (token !== this.loadToken) {
          return;
        }

        const currentIndex = index++;
        const item = items[currentIndex];
        try {
          const preview = await this.library.resolvePreviewAsset(item.filename, {
            forceRefresh,
          });
          item.thumbDataUrl = preview.src || undefined;
        } catch (error) {
          this.logInfo('thumb:failed', {
            filename: item.filename,
            error: this.errorDetails(error),
          });
          item.thumbDataUrl = undefined;
        }

        if (currentIndex % 4 === 0 && token === this.loadToken) {
          this.items = [...items];
          await this.flushUi();
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    if (token === this.loadToken) {
      this.items = [...items];
      await this.flushUi();
    }
  }

  async openPreview(filename: string): Promise<void> {
    const fallbackThumb =
      this.items.find((item) => item.filename === filename)?.thumbDataUrl ??
      null;

    this.pageErrorKey = null;
    this.pageErrorParams = null;
    try {
      const preview = await this.library.resolvePreviewAsset(filename);
      const imageSrc = preview.src || fallbackThumb;
      if (!imageSrc) {
        this.pageErrorKey = 'MY_EPUBS.ERROR.PREVIEW';
        return;
      }

      const fileSizeLabel = await this.resolvePreviewFileSizeLabel(filename);
      this.previewPage.open({
        imageSrc,
        isDithered: preview.isDithered,
        metadata: {
          name: this.displayFilename(filename),
          size: fileSizeLabel,
        },
        titleKey: 'IMAGE_WORKFLOW.PREVIEW_TITLE',
        returnUrl: '/tabs/my-epubs',
        footerActions: [
          { id: 'open', labelKey: 'UI_THEME.ACTIONS.OPEN', icon: 'open-outline' },
          { id: 'rename', labelKey: 'UI_THEME.ACTIONS.RENAME', iconSvg: 'rename' },
          { id: 'share', labelKey: 'UI_THEME.ACTIONS.SHARE', icon: 'share-outline' },
          { id: 'delete', labelKey: 'UI_THEME.ACTIONS.DELETE', icon: 'trash-outline' },
        ],
        actionHandler: (actionId) => {
          const currentFilename = this.previewFilename ?? filename;
          if (actionId === 'open') void this.openByFilename(currentFilename);
          if (actionId === 'rename') void this.renameByFilename(currentFilename, true);
          if (actionId === 'share') void this.shareByFilename(currentFilename);
          if (actionId === 'delete') void this.deletePreviewByFilename(currentFilename);
        },
      });
      this.previewFilename = filename;
      await this.router.navigateByUrl('/tabs/preview-editing');
    } catch (error) {
      this.logInfo('preview:failed', { error: this.errorDetails(error) });
      this.pageErrorKey = 'MY_EPUBS.ERROR.PREVIEW';
    }
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

  private async renameByFilename(
    filename: string,
    fromPreview = false,
  ): Promise<void> {
    this.pageErrorKey = null;
    this.pageErrorParams = null;

    const modal = await this.modalCtrl.create({
      component: SaveCoverModalComponent,
      componentProps: {
        initialFilename: filename.replace(/\.epub$/i, ''),
        title: this.translate.instant('MY_EPUBS.RENAME_TITLE'),
        message: this.translate.instant('MY_EPUBS.RENAME_MESSAGE'),
        placeholder: this.translate.instant('MY_EPUBS.RENAME_PLACEHOLDER'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmText: this.translate.instant('COMMON.DONE'),
      },
      initialBreakpoint: 0.6,
      breakpoints: [0, 0.6, 1],
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm' || typeof data !== 'string' || !data.trim()) return;

    this.loading = true;
    this.previewPage.setLoading(fromPreview);
    await this.flushUi();

    try {
      const renamed = await this.library.renameByFilename(filename, data.trim());
      ++this.loadToken;
      this.runInZone(() => {
        this.items = this.items.map((item) =>
          item.filename === filename ? { ...item, filename: renamed } : item,
        );
        if (this.previewFilename === filename) {
          this.previewFilename = renamed;
        }
      });
      this.previewPage.updateMetadataName(this.displayFilename(renamed));
      await this.flushUi();
      this.loading = false;
      this.previewPage.setLoading(false);
      await this.flushUi();
      await this.showToast('MY_EPUBS.RENAMED');
    } catch (error) {
      this.logInfo('rename:failed', { error: this.errorDetails(error) });
      this.pageErrorKey = 'COMMON.ERROR';
      await this.showErrorToast(error);
    } finally {
      this.loading = false;
      this.previewPage.setLoading(false);
    }
  }

  private async deleteByFilename(filename: string): Promise<boolean> {
    this.pageErrorKey = null;
    this.pageErrorParams = null;

    try {
      await this.library.deleteByFilename(filename);
      this.runInZone(() => {
        this.items = this.items.filter((item) => item.filename !== filename);
      });
      await this.flushUi();
      void this.showToast('MY_EPUBS.DELETED');
      return true;
    } catch (error) {
      this.logInfo('delete:failed', { error: this.errorDetails(error) });
      this.pageErrorKey = 'MY_EPUBS.ERROR.DELETE';
      return false;
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

  private async resolvePreviewFileSizeLabel(filename: string): Promise<string | null> {
    try {
      return this.formatFileSizeLabel(await this.library.getFileSizeBytes(filename));
    } catch {
      return null;
    }
  }

  private async deletePreviewByFilename(filename: string): Promise<void> {
    if (!(await this.confirmDelete())) {
      return;
    }

    const deleted = await this.deleteByFilename(filename);
    if (!deleted) {
      return;
    }
    this.previewPage.clear();
    await this.router.navigateByUrl('/tabs/my-epubs');
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
      animated: true,
      translucent: true,
      cssClass: ['cc-toast', 'cc-toast--success'],
    });
    await toast.present();
  }

  private async showErrorToast(error: unknown): Promise<void> {
    const details = this.errorDetails(error);
    const detail =
      typeof details['code'] === 'string'
        ? details['code']
        : typeof details['message'] === 'string'
          ? details['message']
          : null;
    const toast = await this.toastCtrl.create({
      message: [this.translate.instant('COMMON.ERROR'), detail]
        .filter(Boolean)
        .join(': '),
      duration: 3200,
      position: 'middle',
      animated: true,
      translucent: true,
      cssClass: ['cc-toast', 'cc-toast--error'],
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
