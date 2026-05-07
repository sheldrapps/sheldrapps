import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
  buildCoverOnlyEpubBytes,
  readSheldrCoverMetadata,
  writeSheldrCoverMetadata,
} from '@sheldrapps/file-kit';
import {
  applyAdaptiveColorArtifactReduction,
  isArtifactReductionEnabled,
  resolveArtifactReductionMode,
  resolveCoverColorMode,
} from '@sheldrapps/image-workflow';
import {
  ArtifactsPanelComponent,
  BwPanelComponent,
  EditorSessionService,
} from '@sheldrapps/image-workflow/editor';

import { EditorHistoryService } from '../../../../packages/image-workflow/src/lib/editor/editor-history.service';
import { EDITOR_SESSION_ID } from '../../../../packages/image-workflow/src/lib/editor/editor-panel.tokens';
import { EditorStateService } from '../../../../packages/image-workflow/src/lib/editor/editor-state.service';

class EditorHistoryStub {
  readonly bw = signal(false);
  readonly artifactReductionEnabled = signal(false);

  setBw(value: boolean): void {
    this.bw.set(value);
  }

  setArtifactReductionEnabled(value: boolean): void {
    this.artifactReductionEnabled.set(value);
  }
}

describe('artifact reduction editor flow', () => {
  const translations = {
    'EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.BW': 'Black & white',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.ARTIFACTS_PANEL.TOGGLE':
      'Reduce artifacts',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.ARTIFACTS_PANEL.HELPER':
      'Use only when the image shows visible conversion artifacts. Thumbnails may look different from the final e-reader result.',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.ARTIFACTS_PANEL.INFO_TITLE':
      'Use it only when needed',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.ARTIFACTS_PANEL.INFO_BODY':
      'Turn this on only if the image shows visible artifacts after conversion. Thumbnails and previews may look different from the final result on an e-reader, where it can appear sharper and more natural.',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.ARTIFACTS_PANEL.INFO_CTA': 'Got it',
  };

  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2G0Q0AAAAASUVORK5CYII=';

  async function configurePanelTestBed(options?: { seen?: boolean }) {
    TestBed.resetTestingModule();

    const history = new EditorHistoryStub();
    const alert = {
      present: jasmine.createSpy('present').and.resolveTo(),
      onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({}),
    };
    const alertController = {
      create: jasmine.createSpy('create').and.resolveTo(alert),
    };
    const markSeen = jasmine.createSpy('markSeen').and.resolveTo();
    const editorSession = {
      getSession: jasmine.createSpy('getSession').and.returnValue({
        preferences: {
          artifactReductionInfo: {
            hasSeen: async () => options?.seen === true,
            markSeen,
          },
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), ArtifactsPanelComponent, BwPanelComponent],
      providers: [
        { provide: EditorHistoryService, useValue: history },
        { provide: AlertController, useValue: alertController },
        { provide: EditorSessionService, useValue: editorSession },
        { provide: EDITOR_SESSION_ID, useValue: 'session-1' },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', translations, true);
    await firstValueFrom(translate.use('en'));

    return {
      history,
      alert,
      alertController,
      markSeen,
    };
  }

  it('renders black & white without the old dithering toggle', async () => {
    await configurePanelTestBed();

    const fixture = TestBed.createComponent(BwPanelComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Black & white');
    expect(fixture.nativeElement.textContent).not.toContain('Dithering');
    expect(fixture.nativeElement.querySelectorAll('ion-toggle').length).toBe(1);
  });

  it('keeps artifact reduction enabled when black & white changes', async () => {
    await configurePanelTestBed();

    const state = new EditorStateService();
    state.setArtifactReductionEnabled(true);
    state.setBw(true);
    state.setBw(false);

    expect(state.artifactReductionEnabled()).toBeTrue();
  });

  it('renders the artifacts panel helper and updates artifact reduction independently', async () => {
    const { history } = await configurePanelTestBed();

    const fixture = TestBed.createComponent(ArtifactsPanelComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reduce artifacts');
    expect(fixture.nativeElement.textContent).toContain(
      'Use only when the image shows visible conversion artifacts.',
    );

    await fixture.componentInstance.onArtifactReductionChange({
      detail: { checked: true },
    } as any);

    expect(history.artifactReductionEnabled()).toBeTrue();
    expect(history.bw()).toBeFalse();
  });

  it('shows the first-use modal only when enabling artifact reduction for the first time', async () => {
    const { alertController, markSeen } = await configurePanelTestBed({
      seen: false,
    });

    const fixture = TestBed.createComponent(ArtifactsPanelComponent);
    fixture.detectChanges();

    await fixture.componentInstance.onArtifactReductionChange({
      detail: { checked: true },
    } as any);

    expect(alertController.create).toHaveBeenCalledTimes(1);
    expect(markSeen).toHaveBeenCalledTimes(1);
  });

  it('does not auto-show the modal when the preference was already seen', async () => {
    const { alertController, markSeen } = await configurePanelTestBed({
      seen: true,
    });

    const fixture = TestBed.createComponent(ArtifactsPanelComponent);
    fixture.detectChanges();

    await fixture.componentInstance.onArtifactReductionChange({
      detail: { checked: true },
    } as any);

    expect(alertController.create).not.toHaveBeenCalled();
    expect(markSeen).not.toHaveBeenCalled();
  });

  it('opens the info modal manually without changing the persisted seen flag', async () => {
    const { alertController, markSeen } = await configurePanelTestBed({
      seen: true,
    });

    const fixture = TestBed.createComponent(ArtifactsPanelComponent);
    fixture.detectChanges();

    await fixture.componentInstance.onInfoClick();

    expect(alertController.create).toHaveBeenCalledTimes(1);
    expect(markSeen).not.toHaveBeenCalled();
  });

  it('keeps color mode and artifact reduction independent in helper state', () => {
    expect(
      isArtifactReductionEnabled({
        bw: false,
        dither: false,
        artifactReductionEnabled: true,
      }),
    ).toBeTrue();
    expect(
      resolveCoverColorMode({
        bw: false,
      } as any),
    ).toBe('color');
    expect(
      resolveArtifactReductionMode({
        bw: false,
        dither: false,
        artifactReductionEnabled: true,
      }),
    ).toBe('adaptive-color');
    expect(
      resolveArtifactReductionMode({
        bw: true,
        dither: true,
        artifactReductionEnabled: true,
      }),
    ).toBe('bw-dither');
  });

  it('applies a real artifact-reduction pass in color mode', () => {
    const source = new Uint8ClampedArray([
      120, 120, 120, 255,
      124, 124, 124, 255,
      128, 128, 128, 255,
      132, 132, 132, 255,
    ]);

    applyAdaptiveColorArtifactReduction(source, 2, 2);

    expect(Array.from(source)).not.toEqual([
      120, 120, 120, 255,
      124, 124, 124, 255,
      128, 128, 128, 255,
      132, 132, 132, 255,
    ]);
  });

  it('writes and reads the new artifact-reduction metadata fields', async () => {
    const coverFile = new File(
      [Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0))],
      'cover.png',
      { type: 'image/png' },
    );
    const epubBytes = await buildCoverOnlyEpubBytes({ coverFile, title: 'Cover' });

    const updated = await writeSheldrCoverMetadata(epubBytes, {
      colorMode: 'color',
      artifactReductionEnabled: true,
      artifactReductionMode: 'adaptive-color',
      isDithered: true,
      ditherAlgorithm: 'adaptive-bayer-4x4',
      renderKind: 'processed-dithered',
      processedBy: 'artifact-reduction-spec',
      metadataVersion: '2',
    });
    const metadata = await readSheldrCoverMetadata(updated);

    expect(metadata).toEqual(
      jasmine.objectContaining({
        colorMode: 'color',
        artifactReductionEnabled: true,
        artifactReductionMode: 'adaptive-color',
        isDithered: true,
      }),
    );
  });
});
