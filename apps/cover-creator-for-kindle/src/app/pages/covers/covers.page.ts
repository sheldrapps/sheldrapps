import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subscription, filter } from 'rxjs';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonButton,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonPopover,
  IonList,
  IonItem,
  IonLabel,
  AlertController,
  IonBackButton,
  IonButtons,
  IonModal,
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
  informationCircleOutline,
} from 'ionicons/icons';
import { FileService } from '../../services/file.service';
import { CoversEventsService } from '../../services/covers-events.service';

type UiCoverItem = {
  filename: string;
  thumbDataUrl?: string;
};

@Component({
  selector: 'app-covers',
  standalone: true,
  imports: [
    IonBackButton,
    CommonModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonPopover,
    IonList,
    IonItem,
    IonLabel,
    IonButtons,
    IonModal,
  ],
  templateUrl: './covers.page.html',
  styleUrls: ['./covers.page.scss'],
})
export class CoversPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content!: IonContent;
  loading = true;
  items: UiCoverItem[] = [];

  openPopover = false;
  activeFilename: string | null = null;
  popoverEvent: Event | null = null;

  pageErrorKey: string | null = null;
  pageErrorParams: Record<string, any> | null = null;

  private pressTimer: any = null;
  private readonly LONG_PRESS_MS = 420;
  private readonly SCROLL_END_DELAY_MS = 160;
  private coversEventsSub?: Subscription;
  private localDeletedFilenames = new Set<string>();

  // Preview Modal
  previewOpen = false;
  previewFilename: string | null = null;
  previewDataUrl: string | null = null;
  previewLoading = false;

  infoOpen = false;
  infoEvent: Event | null = null;

  private longPressFired = false;
  private moved = false;
  private scrollDuringPress = false;
  private startX = 0;
  private startY = 0;
  private readonly MOVE_TOLERANCE_X_PX = 10;
  private readonly MOVE_TOLERANCE_Y_PX = 6;
  private isScrolling = false;
  private scrollEndTimer: any = null;
  // Preview Modal

  constructor(
    private files: FileService,
    private alertCtrl: AlertController,
    private translate: TranslateService,
    private coversEvents: CoversEventsService,
    private toastCtrl: ToastController
  ) {
    addIcons({
      closeCircleOutline,
      ellipsisVertical,
      shareOutline,
      trashOutline,
      informationCircleOutline,
      alertCircleOutline,
    });
  }

  ngOnDestroy(): void {
    this.coversEventsSub?.unsubscribe();
  }

  ngOnInit() {
    this.load();
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

        void this.load();
      });
  }

  async load(ev?: CustomEvent) {
    this.loading = !ev;
    this.pageErrorKey = null;
    this.pageErrorParams = null;

    try {
      const entries = await this.files.listCovers();
      const items: UiCoverItem[] = entries.map((e) => ({
        filename: e.filename,
      }));
      this.items = items;

      await this.loadThumbsResilient(items);
    } catch {
      this.items = [];
      this.pageErrorKey = 'COVERS.ERROR.LOAD';
    } finally {
      this.loading = false;
      ev?.target && (ev.target as any).complete();
    }
  }

  private async loadThumbsResilient(items: UiCoverItem[]) {
    const concurrency = 4;
    let i = 0;

    const worker = async () => {
      while (i < items.length) {
        const idx = i++;
        const item = items[idx];
        const dataUrl = await this.files.getOrBuildThumbDataUrlForFilename(
          item.filename
        );
        item.thumbDataUrl = dataUrl ?? undefined;
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    this.items = [...items];
  }

  showMenu(ev: Event, filename: string) {
    this.activeFilename = filename;
    this.popoverEvent = ev;
    this.openPopover = true;
  }

  toggleInfo(ev: Event) {
    ev.stopPropagation();
    if (this.infoOpen) {
      this.closeInfo();
    } else {
      this.infoEvent = ev;
      this.infoOpen = true;
    }
  }

  closeInfo() {
    this.infoOpen = false;
    this.infoEvent = null;
  }

  onScrollStart() {
    this.isScrolling = true;
    this.scrollDuringPress = true;
    this.cancelPress();

    if (this.scrollEndTimer) {
      clearTimeout(this.scrollEndTimer);
      this.scrollEndTimer = null;
    }
  }

  onScrollEnd() {
    if (this.scrollEndTimer) clearTimeout(this.scrollEndTimer);
    this.scrollEndTimer = setTimeout(() => {
      this.isScrolling = false;
      this.scrollEndTimer = null;
    }, this.SCROLL_END_DELAY_MS);
  }

  onPressStart(ev: PointerEvent, filename: string) {
    if (this.isFromDots(ev)) return;
    if (this.isScrolling) return;
    this.clearPress();

    this.longPressFired = false;
    this.moved = false;
    this.scrollDuringPress = false;
    this.startX = ev.clientX;
    this.startY = ev.clientY;

    this.pressTimer = setTimeout(() => {
      this.longPressFired = true;
      this.showMenu(ev, filename);
    }, this.LONG_PRESS_MS);
  }

  onPressMove(ev: PointerEvent) {
    if (this.isScrolling) {
      this.cancelPress();
      return;
    }
    if (!this.pressTimer) return;

    const dx = Math.abs(ev.clientX - this.startX);
    const dy = Math.abs(ev.clientY - this.startY);

    if (dy > this.MOVE_TOLERANCE_Y_PX || dx > this.MOVE_TOLERANCE_X_PX) {
      this.moved = true;
      this.clearPress();
    }
  }

  onPressEnd(ev: PointerEvent, filename: string) {
    if (this.isFromDots(ev)) return;
    if (this.isScrolling || this.scrollDuringPress) {
      this.cancelPress();
      return;
    }
    const isTap = !!this.pressTimer && !this.longPressFired && !this.moved;
    this.clearPress();

    if (isTap) {
      void this.openPreview(filename);
    }
  }

  onPressCancel() {
    this.cancelPress();
  }

  private clearPress() {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  private cancelPress() {
    this.clearPress();
    this.moved = true;
    this.longPressFired = false;
  }

  async openPreview(filename: string) {
    this.previewOpen = true;
    this.previewFilename = filename;
    this.previewDataUrl = null;
    this.previewLoading = true;

    try {
      this.previewDataUrl = await this.files.getCoverDataUrlForFilename(
        filename
      );
    } catch {
      this.pageErrorKey = 'COVERS.ERROR.PREVIEW';
    } finally {
      this.previewLoading = false;
    }
  }

  async sharePreview() {
    const filename = this.previewFilename;
    if (!filename) return;

    this.pageErrorKey = null;
    this.pageErrorParams = null;

    try {
      await this.files.shareCoverByFilename(filename);
    } catch {
      this.pageErrorKey = 'COVERS.ERROR.SHARE';
    }
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
            this.pageErrorKey = null;
            this.pageErrorParams = null;

            try {
              await this.files.deleteCoverByFilename(filename);
              this.items = this.items.filter((x) => x.filename !== filename);
              this.coversEvents.emit({ type: 'deleted', filename });
              this.closePreview();
              await this.showToast('COVERS.DELETED');
            } catch {
              this.pageErrorKey = 'COVERS.ERROR.DELETE';
            }
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
  }

  async shareActive() {
    const filename = this.activeFilename;
    this.openPopover = false;
    this.activeFilename = null;
    if (!filename) return;

    this.pageErrorKey = null;
    this.pageErrorParams = null;

    try {
      await this.files.shareCoverByFilename(filename);
    } catch {
      this.pageErrorKey = 'COVERS.ERROR.SHARE';
    }
  }

  async deleteActive() {
    const filename = this.activeFilename;
    this.openPopover = false;
    if (!filename) return;

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
            this.pageErrorKey = null;
            this.pageErrorParams = null;

            try {
              await this.files.deleteCoverByFilename(filename);
              this.items = this.items.filter((x) => x.filename !== filename);
              this.localDeletedFilenames.add(filename);
              this.coversEvents.emit({ type: 'deleted', filename });
              await this.restoreScrollTop(scrollTop);
              await this.showToast('COVERS.DELETED');
            } catch {
              this.pageErrorKey = 'COVERS.ERROR.DELETE';
            } finally {
              this.activeFilename = null;
            }
          },
        },
      ],
    });

    await alert.present();
  }

  trackByFilename(_: number, item: UiCoverItem) {
    return item.filename;
  }

  async ionViewWillEnter() {
    await this.load();
  }

  private isFromDots(ev: Event): boolean {
    const t = ev.target as HTMLElement | null;
    return !!t?.closest?.('.dots');
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
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await this.content.scrollToPoint(0, scrollTop, 0);
  }
}
