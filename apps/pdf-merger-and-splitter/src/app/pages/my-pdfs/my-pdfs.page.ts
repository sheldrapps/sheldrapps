import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewChild, inject } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
  loading = true;
  pageErrorKey: string | null = null;
  private records: PdfLibraryEntry[] = [];

  readonly listActions: CoverListAction[] = [
    { id: 'open', labelKey: 'UI_THEME.ACTIONS.OPEN', icon: 'open-outline' },
    { id: 'rename', labelKey: 'UI_THEME.ACTIONS.RENAME', iconSvg: 'rename' },
    { id: 'share', labelKey: 'UI_THEME.ACTIONS.SHARE', icon: 'share-outline' },
    { id: 'delete', labelKey: 'UI_THEME.ACTIONS.DELETE', icon: 'trash-outline' },
  ];

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
    void this.openRecord(item.filename);
  }

  onListAction(event: CoverListActionEvent): void {
    const record = this.records.find((item) => item.fileName === event.item.filename);
    if (!record) return;
    if (event.actionId === 'open') void this.openRecord(record.fileName);
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

  private async openRecord(fileName: string): Promise<void> {
    const record = this.records.find((item) => item.fileName === fileName);
    if (record && typeof window !== 'undefined') window.open(record.uri, '_blank');
  }

  private async shareRecord(record: PdfLibraryEntry): Promise<void> {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      await navigator.share({ title: record.title, url: record.uri });
    }
  }

  private async renameRecord(record: PdfLibraryEntry): Promise<void> {
    if (typeof window === 'undefined') return;
    const nextTitle = window.prompt(
      this.translate.instant('MY_PDFS.RENAME_TITLE'),
      record.title,
    )?.trim();
    if (!nextTitle) return;
    await this.library.saveRecord({
      ...record,
      title: nextTitle,
      fileName: `${nextTitle.replace(/\.pdf$/i, '')}.pdf`,
    });
    await this.load();
  }

  private async deleteRecord(record: PdfLibraryEntry): Promise<void> {
    await this.library.deleteRecord(record.id);
    await this.load();
  }
}
