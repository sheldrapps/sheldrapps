import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  codeWorkingOutline,
  ellipsisVertical,
  openOutline,
  shareOutline,
  trashOutline,
} from 'ionicons/icons';
import {
  CoverListContentComponent,
  type CoverListAction,
  type CoverListActionEvent,
  type CoverListItem,
} from '@sheldrapps/covers-list-kit/list';
import {
  EpubMetadataEditorPageService,
  SaveCoverModalComponent,
} from '@sheldrapps/ui-theme';
import { EpubMetadataLibraryService } from '../../services/epub-metadata-library.service';

@Component({
  selector: 'app-my-epubs-page',
  templateUrl: './my-epubs.page.html',
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
export class MyEpubsPage {
  private readonly library = inject(EpubMetadataLibraryService);
  private readonly alertController = inject(AlertController);
  private readonly modalController = inject(ModalController);
  private readonly toastController = inject(ToastController);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly metadataEditorPage = inject(EpubMetadataEditorPageService);

  loading = true;
  items: CoverListItem[] = [];
  pageErrorKey: string | null = null;
  pageErrorParams: Record<string, unknown> | null = null;

  readonly listActions: CoverListAction[] = [
    { id: 'open', labelKey: 'UI_THEME.ACTIONS.OPEN', icon: 'open-outline' },
    { id: 'metadata', labelKey: 'UI_THEME.ACTIONS.EDIT_METADATA', icon: 'code-working-outline' },
    { id: 'share', labelKey: 'UI_THEME.ACTIONS.SHARE', icon: 'share-outline' },
    { id: 'rename', labelKey: 'UI_THEME.ACTIONS.RENAME', iconSvg: 'rename' },
    { id: 'delete', labelKey: 'UI_THEME.ACTIONS.DELETE', icon: 'trash-outline' },
  ];

  constructor() {
    addIcons({ codeWorkingOutline, ellipsisVertical, openOutline, shareOutline, trashOutline });
  }

  async ionViewWillEnter(): Promise<void> {
    await this.load();
  }

  async load(ev?: CustomEvent): Promise<void> {
    this.loading = true;
    this.pageErrorKey = null;
    this.pageErrorParams = null;
    try {
      this.items = (await this.library.listEpubs()).map((filename) => ({ filename }));
    } catch {
      this.items = [];
      this.pageErrorKey = 'MY_EPUBS.ERROR.LOAD';
    } finally {
      this.loading = false;
      (ev?.target as { complete?: () => void } | undefined)?.complete?.();
    }
  }

  displayFilename(filename: string): string {
    return filename.replace(/\.epub$/i, '');
  }

  onItemClick(item: CoverListItem): void {
    void this.open(item.filename);
  }

  onListAction(event: CoverListActionEvent): void {
    if (event.actionId === 'open') void this.open(event.item.filename);
    if (event.actionId === 'metadata') void this.editMetadata(event.item.filename);
    if (event.actionId === 'share') void this.share(event.item.filename);
    if (event.actionId === 'rename') void this.rename(event.item.filename);
    if (event.actionId === 'delete') void this.delete(event.item.filename);
  }

  private async open(filename: string): Promise<void> {
    await this.runAction(() => this.library.openByFilename(filename), 'MY_EPUBS.ERROR.OPEN');
  }

  private async share(filename: string): Promise<void> {
    await this.runAction(() => this.library.shareByFilename(filename), 'MY_EPUBS.ERROR.SHARE');
  }

  private async editMetadata(filename: string): Promise<void> {
    try {
      const current = await this.library.readMetadata(filename);
      if (!current) throw new Error('EPUB_METADATA_READ_FAILED');
      this.metadataEditorPage.open({
        input: {
          version: current.version,
          detectedVersion: current.detectedVersion,
          fileName: filename,
          metadata: current.metadata,
        },
        returnUrl: '/tabs/my-epubs',
        saveHandler: (metadata) => this.library.updateMetadata(filename, metadata),
      });
      await this.router.navigateByUrl('/metadata-editor');
    } catch {
      this.pageErrorKey = 'MY_EPUBS.ERROR.METADATA';
    }
  }

  private async rename(filename: string): Promise<void> {
    const modal = await this.modalController.create({
      component: SaveCoverModalComponent,
      componentProps: {
        initialFilename: this.displayFilename(filename),
        title: this.translate.instant('FIX.SAVE_RENAME_TITLE'),
        message: this.translate.instant('FIX.SAVE_RENAME_MESSAGE'),
        placeholder: this.translate.instant('FIX.SAVE_RENAME_PLACEHOLDER'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmText: this.translate.instant('COMMON.DONE'),
      },
      initialBreakpoint: 0.6,
      breakpoints: [0, 0.6, 1],
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm' || typeof data !== 'string' || !data.trim()) return;

    try {
      const renamed = await this.library.renameByFilename(filename, data.trim());
      this.items = this.items.map((item) =>
        item.filename === filename ? { ...item, filename: renamed } : item,
      );
      await this.showToast('MY_EPUBS.RENAMED');
    } catch {
      this.pageErrorKey = 'MY_EPUBS.ERROR.RENAME';
    }
  }

  private async delete(filename: string): Promise<void> {
    const alert = await this.alertController.create({
      header: this.translate.instant('MY_EPUBS.DELETE_TITLE'),
      message: this.translate.instant('MY_EPUBS.DELETE_MESSAGE'),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        { text: this.translate.instant('COMMON.DELETE'), role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') return;

    try {
      await this.library.deleteByFilename(filename);
      this.items = this.items.filter((item) => item.filename !== filename);
      await this.showToast('MY_EPUBS.DELETED');
    } catch {
      this.pageErrorKey = 'MY_EPUBS.ERROR.DELETE';
    }
  }

  private async runAction(action: () => Promise<void>, errorKey: string): Promise<void> {
    try {
      await action();
    } catch {
      this.pageErrorKey = errorKey;
    }
  }

  private async showToast(messageKey: string): Promise<void> {
    const toast = await this.toastController.create({
      message: this.translate.instant(messageKey),
      duration: 1600,
      position: 'middle',
    });
    await toast.present();
  }
}
