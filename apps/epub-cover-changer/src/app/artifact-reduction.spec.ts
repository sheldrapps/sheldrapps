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
  isDitheringEnabled,
  resolveArtifactReductionMode,
  resolveCoverColorMode,
} from '@sheldrapps/image-workflow';
import {
  ArtifactsPanelComponent,
  BwPanelComponent,
  EditorSessionService,
} from '@sheldrapps/image-workflow/editor';

import { applyEditorAdjustments } from '../../../../packages/image-workflow/src/lib/core/pipeline/apply-editor-adjustments';
import { EditorHistoryService } from '../../../../packages/image-workflow/src/lib/editor/editor-history.service';
import { EDITOR_SESSION_ID } from '../../../../packages/image-workflow/src/lib/editor/editor-panel.tokens';
import { EditorStateService } from '../../../../packages/image-workflow/src/lib/editor/editor-state.service';

class EditorHistoryStub {
  readonly bw = signal(false);
  readonly cleanupEnabled = signal(false);
  readonly cleanupArtifactReduction = signal<'off' | 'light' | 'balanced' | 'strong'>('off');
  readonly smoothGradients = signal(false);
  readonly ditheringEnabled = signal(false);
  readonly ditheringMode = signal<'floyd-steinberg' | 'ordered'>('floyd-steinberg');
  readonly artifactReductionEnabled = this.cleanupEnabled;

  setBw(value: boolean): void {
    this.bw.set(value);
  }

  setArtifactReductionEnabled(value: boolean): void {
    this.cleanupEnabled.set(value);
  }

  setCleanupArtifactReduction(value: 'off' | 'light' | 'balanced' | 'strong'): void {
    this.cleanupArtifactReduction.set(value);
  }

  setSmoothGradients(value: boolean): void {
    this.smoothGradients.set(value);
  }

  setDitheringEnabled(value: boolean): void {
    this.ditheringEnabled.set(value);
  }

  setDitheringMode(value: 'floyd-steinberg' | 'ordered'): void {
    this.ditheringMode.set(value);
  }
}

describe('artifact reduction editor flow', () => {
  const translations = {
    'EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.BW': 'Black & white',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.TOGGLE':
      'Reduce JPEG artifacts',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.STRENGTH': 'Strength',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.STRENGTH_OFF': 'Off',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.STRENGTH_LIGHT': 'Light',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.STRENGTH_BALANCED':
      'Balanced',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.STRENGTH_STRONG':
      'Strong',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.SMOOTH_GRADIENTS':
      'Smooth gradients',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.HELPER':
      'Improve low-quality or compressed images before converting them for e-readers.',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.PRESERVE_DETAILS':
      'Preserve details stays on to protect text, edges and silhouettes.',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.STRONG_HINT':
      'Strong cleanup may soften fine texture.',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.INFO_TITLE':
      'Image Cleanup',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.INFO_BODY':
      'Reduce JPEG artifacts softens blocky compression marks, and Smooth gradients helps with banding in skies and smooth backgrounds.',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.CLEANUP_PANEL.INFO_CTA': 'Got it',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.DITHER_PANEL.TOGGLE': 'Dithering',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.DITHER_PANEL.MODE': 'Mode',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.DITHER_PANEL.MODE_FLOYD_STEINBERG':
      'Floyd-Steinberg',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.DITHER_PANEL.MODE_ORDERED': 'Ordered',
    'EDITOR.PANELS.ADJUSTMENTS.WIDGETS.DITHER_PANEL.HELPER':
      'Add texture to simulate more shades on limited-color displays. Not always needed.',
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
    state.setCleanupArtifactReduction('balanced');
    state.setBw(true);
    state.setBw(false);

    expect(state.artifactReductionEnabled()).toBeTrue();
  });

  it('enables smooth gradients when cleanup is first activated', () => {
    const state = new EditorStateService();

    state.setArtifactReductionEnabled(true);

    expect(state.artifactReductionEnabled()).toBeTrue();
    expect(state.cleanupArtifactReduction()).toBe('balanced');
    expect(state.smoothGradients()).toBeTrue();
  });

  it('renders the cleanup panel helper and updates cleanup independently', async () => {
    const { history } = await configurePanelTestBed();

    const fixture = TestBed.createComponent(ArtifactsPanelComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reduce JPEG artifacts');
    expect(fixture.nativeElement.textContent).toContain(
      'Improve low-quality or compressed images before converting them for e-readers.',
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
      isDitheringEnabled({
        bw: false,
        dither: false,
        artifactReductionEnabled: true,
      }),
    ).toBeFalse();
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
        cleanup: {
          enabled: true,
          artifactReduction: 'balanced',
          smoothGradients: true,
          preserveDetails: true,
        },
      }),
    ).toBe('adaptive-color');
    expect(
      resolveArtifactReductionMode({
        bw: true,
        dither: true,
        artifactReductionEnabled: true,
        cleanup: {
          enabled: true,
          artifactReduction: 'balanced',
          smoothGradients: true,
          preserveDetails: true,
        },
      }),
    ).toBe('adaptive-gray');
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

  it('softens banded gradients into intermediate tones during cleanup', () => {
    const width = 12;
    const height = 4;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const bandValues = [96, 120, 144, 168];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const band = Math.min(bandValues.length - 1, Math.floor(x / 3));
        const offset = (y * width + x) * 4;
        const value = bandValues[band];
        pixels[offset] = value;
        pixels[offset + 1] = value;
        pixels[offset + 2] = value;
        pixels[offset + 3] = 255;
      }
    }

    const imageData = new ImageData(pixels, width, height);
    applyEditorAdjustments(imageData, {
      scale: 1,
      tx: 0,
      ty: 0,
      rot: 0,
      brightness: 1,
      saturation: 1,
      contrast: 1,
      bw: false,
      dither: false,
      cleanup: {
        enabled: true,
        artifactReduction: 'strong',
        smoothGradients: true,
        preserveDetails: true,
      },
      dithering: {
        enabled: false,
        mode: 'none',
      },
    } as any);

    const uniqueValues = new Set<number>();
    for (let i = 0; i < imageData.data.length; i += 4) {
      uniqueValues.add(imageData.data[i]);
    }

    expect(uniqueValues.size).toBeGreaterThan(bandValues.length);
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
        isDithered: false,
        ditherAlgorithm: null,
        renderKind: 'processed-cleanup',
        processedBy: 'artifact-reduction-spec',
        metadataVersion: '2',
      });
    const metadata = await readSheldrCoverMetadata(updated);

    expect(metadata).toEqual(
      jasmine.objectContaining({
        colorMode: 'color',
        artifactReductionEnabled: true,
        artifactReductionMode: 'adaptive-color',
        isDithered: false,
      }),
    );
  });
});
