import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { Subscription, filter } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonPopover,
  AlertController,
  ToastController,
  NavController,
  ModalController,
} from '@ionic/angular/standalone';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { addIcons } from 'ionicons';
import {
  ellipsisVertical,
  openOutline,
  folderOpenOutline,
  shareOutline,
  trashOutline,
  closeCircleOutline,
  alertCircleOutline,
  helpCircleOutline,
} from 'ionicons/icons';
import {
  FileService,
  ResolvedCoverPreviewAsset,
} from '../../services/file.service';
import { EditProjectChoiceModalComponent } from '@sheldrapps/ui-theme';
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
} from '@sheldrapps/covers-list-kit';
import { normalizeFilenameKey } from '@sheldrapps/file-kit';

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
      id: 'open',
      labelKey: 'COVERS.ACTIONS.OPEN',
      icon: 'open-outline',
    },
    {
      id: 'project',
      labelKey: 'COVERS.ACTIONS.EDIT_PROJECT',
      icon: 'folder-open-outline',
      hidden: (item) => !this.hasProjectForFilename(item.filename),
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

  private coversEventsSub?: Subscription;
  private localDeletedFilenames = new Set<string>();
  private projectCoverFilenames = new Set<string>();
  private thumbsLoadToken = 0;
  private hasLoadedOnce = false;
  private needsReload = true;
  private isViewActive = false;
  private readonly logPrefix = 'CCFK:covers';

  previewOpen = false;
  previewFilename: string | null = null;
  previewDataUrl: string | null = null;
  previewIsDithered = false;
  previewLoading = false;
  previewGettingCover = false;
  previewFileSizeLabel: string | null = null;

  infoOpen = false;
  showPreviewGuideButton = true;
  private files = inject(FileService);
  private alertCtrl = inject(AlertController);
  private translate = inject(TranslateService);
  private coversEvents = inject(CoversEventsService);
  private toastCtrl = inject(ToastController);
  private navCtrl = inject(NavController);
  private modalCtrl = inject(ModalController);
  private router = inject(Router);
  private zone = inject(NgZone);
  private changeDetector = inject(ChangeDetectorRef);

  constructor() {
    addIcons({
      closeCircleOutline,
      ellipsisVertical,
      openOutline,
      folderOpenOutline,
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

  async load(ev?: CustomEvent) {
    this.logInfo('libraryReload:start', {
      reason: ev ? 'pull-to-refresh' : 'view-load',
      triggeredAt: new Date().toISOString(),
    });
    this.loading = !ev;
    this.pageErrorKey = null;
    this.pageErrorParams = null;
    const loadToken = ++this.thumbsLoadToken;

    try {
      const entries = await this.files.listCovers();
      const [projects, projectMatches] = await Promise.all([
        this.files.listProjects(),
        Promise.all(
          entries.map(async (cover) =>
            (await this.files.hasProjectByFilename(cover.filename))
              ? normalizeFilenameKey(cover.filename)
              : null,
          ),
        ),
      ]);
      this.logInfo('libraryReload:listCoversResult', {
        count: entries.length,
        filenames: entries.map((entry) => entry.filename),
      });
      this.projectCoverFilenames = new Set([
        ...projects.map((project) => normalizeFilenameKey(project.coverFilename)),
        ...projectMatches.filter((filename): filename is string => !!filename),
      ]);
      const items: UiCoverItem[] = entries.map((e) => ({
        filename: e.filename,
      }));
      this.items = items;
      this.hasLoadedOnce = true;
      this.needsReload = false;
      this.loading = false;
      ev?.target && (ev.target as any).complete();
      await this.flushUi();
      void this.loadThumbsResilient(items, loadToken);
    } catch (error) {
      this.logInfo('libraryReload:failed', {
        triggeredAt: new Date().toISOString(),
        error: this.errorDetails(error),
      });
      this.items = [];
      this.projectCoverFilenames = new Set();
      this.pageErrorKey = 'COVERS.ERROR.LOAD';
      this.loading = false;
      ev?.target && (ev.target as any).complete();
      await this.flushUi();
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
          await this.flushUi();
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    if (loadToken === this.thumbsLoadToken) {
      this.items = [...items];
      await this.flushUi();
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
    const hasProject =
      !!this.previewFilename &&
      this.hasProjectForFilename(this.previewFilename);
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
        id: 'project',
        labelKey: 'COVERS.ACTIONS.EDIT_PROJECT',
        icon: 'folder-open-outline',
        layout: 'icon-text',
        cssClass: 'ctrl',
        disabled: disabled || !hasProject,
        hidden: !hasProject,
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
    if (event.actionId === 'open') {
      void this.openPreviewExternal();
      return;
    }
    if (event.actionId === 'project') {
      void this.openProjectByFilename(this.previewFilename);
      this.closePreview();
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
      void this.deleteFromList(event.item.filename);
    }
  }

  async openPreview(filename: string) {
    const fallbackThumb =
      this.items.find((item) => item.filename === filename)?.thumbDataUrl ?? null;

    this.previewOpen = true;
    this.previewFilename = filename;
    this.previewDataUrl = fallbackThumb;
    this.previewIsDithered = false;
    this.previewLoading = true;
    this.previewGettingCover = false;
    this.previewFileSizeLabel = null;
    void this.loadPreviewFileSizeLabel(filename);

    try {
      const hasCoverExport = await this.files.hasCoverExportForFilename(filename);
      this.previewGettingCover = !hasCoverExport;

      const preview: ResolvedCoverPreviewAsset =
        await this.files.resolveCoverPreviewAsset(filename, {
          allowNativeExtract: true,
        });
      this.previewDataUrl = preview.src || fallbackThumb;
      this.previewIsDithered = preview.isDithered;
    } catch {
      this.previewDataUrl = this.previewDataUrl ?? fallbackThumb;
      this.pageErrorKey = 'COVERS.ERROR.PREVIEW';
    } finally {
      this.previewLoading = false;
      this.previewGettingCover = false;
      await this.flushUi();
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
    this.previewGettingCover = false;
    this.previewFileSizeLabel = null;
    void this.flushUi();
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

  private async openProjectByFilename(filename: string | null): Promise<void> {
    if (!filename) return;
    this.pageErrorKey = null;
    this.pageErrorParams = null;

    try {
      const editMode = await this.promptProjectEditMode();
      if (!editMode) return;

      this.loading = true;
      await this.waitForLoadingIndicatorFrame();
      this.blurDeepActiveElement();
      const navigated = await this.navCtrl.navigateRoot('/tabs/create', {
        queryParams: {
          project: filename,
          editMode,
        },
      });
      if (!navigated) {
        this.loading = false;
        this.pageErrorKey = 'COVERS.ERROR.OPEN_PROJECT';
      }
    } catch {
      this.loading = false;
      this.pageErrorKey = 'COVERS.ERROR.OPEN_PROJECT';
    }
  }

  private async promptProjectEditMode(): Promise<'overwrite' | 'copy' | null> {
    const modal = await this.modalCtrl.create({
      component: EditProjectChoiceModalComponent,
      componentProps: {
        title: this.translate.instant('COMMON.EDIT_PROJECT_TITLE'),
        message: this.translate.instant('COMMON.EDIT_PROJECT_MESSAGE'),
        overwriteLabel: this.translate.instant('COMMON.EDIT_PROJECT_OVERWRITE'),
        overwriteDescription: this.translate.instant(
          'COMMON.EDIT_PROJECT_OVERWRITE_DESC',
        ),
        copyLabel: this.translate.instant('COMMON.EDIT_PROJECT_COPY'),
        copyDescription: this.translate.instant('COMMON.EDIT_PROJECT_COPY_DESC'),
        cancelLabel: this.translate.instant('COMMON.CANCEL'),
      },
    });

    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'overwrite' || role === 'copy') {
      return role;
    }
    return null;
  }

  private async waitForLoadingIndicatorFrame(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame !== 'function') {
        resolve();
        return;
      }
      requestAnimationFrame(() => resolve());
    });
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

  private hasProjectForFilename(filename: string): boolean {
    return this.projectCoverFilenames.has(normalizeFilenameKey(filename));
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

  private displayFilename(filename: string): string {
    return filename.replace(/\.epub$/i, '');
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
        code: typeof e.code === 'string' || typeof e.code === 'number' ? e.code : undefined,
        stack: typeof e.stack === 'string' ? e.stack : undefined,
      };
    }
    return { message: String(error) };
  }

  private blurDeepActiveElement(): void {
    if (typeof document === 'undefined') return;

    let active: Element | null = document.activeElement;
    while (active && (active as HTMLElement).shadowRoot?.activeElement) {
      active = (active as HTMLElement).shadowRoot?.activeElement ?? null;
    }

    try {
      (active as HTMLElement | null)?.blur?.();
    } catch {
      // best effort
    }
  }
}
