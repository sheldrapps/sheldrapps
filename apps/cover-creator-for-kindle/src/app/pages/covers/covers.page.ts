import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subscription, filter } from 'rxjs';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonPopover,
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
  helpCircleOutline,
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
} from '@sheldrapps/covers-list-kit';

type UiCoverItem = {
  filename: string;
  thumbDataUrl?: string;
};

@Component({
  selector: 'app-covers',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    CoverListContentComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonPopover,
    CoverPreviewModalComponent,
  ],
  templateUrl: './covers.page.html',
  styleUrls: ['./covers.page.scss'],
})
export class CoversPage implements OnInit, OnDestroy {
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

  private coversEventsSub?: Subscription;
  private localDeletedFilenames = new Set<string>();
  private thumbsLoadToken = 0;
  private hasLoadedOnce = false;
  private needsReload = true;
  private isViewActive = false;

  previewOpen = false;
  previewFilename: string | null = null;
  previewDataUrl: string | null = null;
  previewLoading = false;
  previewGettingCover = false;

  infoOpen = false;
  showPreviewGuideButton = true;

  constructor(
    private files: FileService,
    private alertCtrl: AlertController,
    private translate: TranslateService,
    private coversEvents: CoversEventsService,
    private toastCtrl: ToastController,
  ) {
    addIcons({
      closeCircleOutline,
      ellipsisVertical,
      shareOutline,
      trashOutline,
      helpCircleOutline,
      alertCircleOutline,
    });
  }

  ngOnDestroy(): void {
    this.coversEventsSub?.unsubscribe();
  }

  ngOnInit() {
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
        if (this.isViewActive) {
          void this.load();
        }
      });
  }

  async load(ev?: CustomEvent) {
    this.loading = !ev;
    this.pageErrorKey = null;
    this.pageErrorParams = null;
    const loadToken = ++this.thumbsLoadToken;

    try {
      const entries = await this.files.listCovers();
      const items: UiCoverItem[] = entries.map((e) => ({
        filename: e.filename,
      }));
      this.items = items;
      this.hasLoadedOnce = true;
      this.needsReload = false;
      this.loading = false;
      ev?.target && (ev.target as any).complete();
      void this.loadThumbsResilient(items, loadToken);
    } catch {
      this.items = [];
      this.pageErrorKey = 'COVERS.ERROR.LOAD';
      this.loading = false;
      ev?.target && (ev.target as any).complete();
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

  toggleInfo(ev: Event) {
    ev.stopPropagation();
    if (this.infoOpen) {
      this.closeInfo();
    } else {
      this.infoOpen = true;
    }
  }

  closeInfo() {
    this.infoOpen = false;
  }

  onPreviewGuideClick(ev: Event) {
    this.toggleInfo(ev);
  }

  get previewHeaderActions(): PreviewAction[] {
    return [
      {
        id: 'guide',
        labelKey: 'ARR.TOOLS.GUIDE',
        icon: 'help-circle-outline',
        layout: 'app-icon-text',
        cssClass: 'tool-btn preview-guide-btn',
        ariaLabelKey: 'CREATE.INFO_ARIA',
        hidden: !this.showPreviewGuideButton,
      },
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

  onPreviewAction(event: PreviewActionClickEvent) {
    if (event.actionId === 'guide') {
      if (event.nativeEvent) {
        this.onPreviewGuideClick(event.nativeEvent);
      }
      return;
    }
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

  async openPreview(filename: string) {
    const fallbackThumb =
      this.items.find((item) => item.filename === filename)?.thumbDataUrl ?? null;

    this.previewOpen = true;
    this.previewFilename = filename;
    this.previewDataUrl = fallbackThumb;
    this.previewLoading = true;
    this.previewGettingCover = false;

    try {
      const hasCoverExport = await this.files.hasCoverExportForFilename(filename);
      this.previewGettingCover = !hasCoverExport;

      const preview = await this.files.getBestPreviewCoverDataUrl(filename, {
        allowNativeExtract: true,
      });
      this.previewDataUrl = preview.dataUrl ?? fallbackThumb;
    } catch {
      this.previewDataUrl = this.previewDataUrl ?? fallbackThumb;
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
    if (!this.hasLoadedOnce || this.needsReload) {
      await this.load();
    }
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
}
