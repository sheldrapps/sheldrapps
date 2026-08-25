import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewChild, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
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
import { PdfLibraryService } from '../../services/pdf-library.service';
import type { PdfLibraryEntry } from '../../pdf/pdf-library.types';

@Component({
  selector: 'app-my-pdfs',
  standalone: true,
  templateUrl: './my-pdfs.page.html',
  styleUrls: ['./my-pdfs.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class MyPdfsPage {
  private readonly library = inject(PdfLibraryService);
  private readonly translate = inject(TranslateService);

  @ViewChild(CoverListContentComponent) listContent?: CoverListContentComponent;

  items: CoverListItem[] = [];
  private readonly loadingState = signal(true);

  get loading(): boolean {
    return this.loadingState();
  }

  set loading(value: boolean) {
    this.loadingState.set(value);
  }

  pageErrorKey: string | null = null;
  private records: PdfLibraryEntry[] = [];

  readonly listActions: CoverListAction[] = [
    { id: 'open', labelKey: 'UI_THEME.ACTIONS.OPEN', icon: 'open-outline' },
    { id: 'rename', labelKey: 'UI_THEME.ACTIONS.RENAME', iconSvg: 'rename' },
    { id: 'share', labelKey: 'UI_THEME.ACTIONS.SHARE', icon: 'share-outline' },
    { id: 'delete', labelKey: 'UI_THEME.ACTIONS.DELETE', icon: 'trash-outline' },
  ];

  constructor() {
    addIcons({
      closeCircleOutline,
      ellipsisVertical,
      openOutline,
      shareOutline,
      trashOutline,
    });
  }

  async ionViewWillEnter(): Promise<void> {
    await this.load();
  }

  onListScrollStart(): void {
    this.listContent?.onHostScrollStart();
  }

  onListScrollEnd(): void {
    this.listContent?.onHostScrollEnd();
  }

  onListItemClick(item: CoverListItem): void {
    const record = this.records.find((candidate) => candidate.fileName === item.filename);
    if (record) void this.openRecord(record);
  }

  onListAction(event: CoverListActionEvent): void {
    const record = this.records.find((item) => item.fileName === event.item.filename);
    if (!record) return;
    if (event.actionId === 'open') void this.openRecord(record);
    if (event.actionId === 'share') void this.shareRecord(record);
    if (event.actionId === 'rename') void this.renameRecord(record);
    if (event.actionId === 'delete') void this.deleteRecord(record);
  }

  readonly displayFilename = (filename: string): string =>
    filename.replace(/\.pdf$/i, '');

  async load(ev?: CustomEvent): Promise<void> {
    this.loading = true;
    this.pageErrorKey = null;
    try {
      this.records = await this.library.listRecords();
      this.items = this.records.map((record) => ({
        filename: record.fileName,
        thumbDataUrl: record.thumbnailUri,
      }));
    } catch {
      this.records = [];
      this.items = [];
      this.pageErrorKey = 'MY_PDFS.ERROR.LOAD';
    } finally {
      this.loading = false;
      ev?.target && (ev.target as { complete?: () => void }).complete?.();
    }
  }

  private async openRecord(record: PdfLibraryEntry): Promise<void> {
    try {
      await this.library.openRecord(record);
    } catch {
      this.pageErrorKey = 'MY_PDFS.ERROR.OPEN';
    }
  }

  private async shareRecord(record: PdfLibraryEntry): Promise<void> {
    try {
      await this.library.shareRecord(record);
    } catch {
      this.pageErrorKey = 'MY_PDFS.ERROR.SHARE';
    }
  }

  private async renameRecord(record: PdfLibraryEntry): Promise<void> {
    if (typeof window === 'undefined') return;
    const nextTitle = window.prompt(
      this.translate.instant('MY_PDFS.RENAME_TITLE'),
      record.title,
    )?.trim();
    if (!nextTitle) return;
    try {
      await this.library.renameRecord(record, nextTitle);
      await this.load();
    } catch {
      this.pageErrorKey = 'MY_PDFS.ERROR.RENAME';
    }
  }

  private async deleteRecord(record: PdfLibraryEntry): Promise<void> {
    try {
      await this.library.deleteRecord(record);
      await this.load();
    } catch {
      this.pageErrorKey = 'MY_PDFS.ERROR.DELETE';
    }
  }
}
