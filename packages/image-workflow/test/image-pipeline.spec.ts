import { buildDefaultCoverCropState } from '../src/lib/core/pipeline/default-crop-state';
import { buildCompositionInputForPurpose } from '../src/lib/core/pipeline/composition-input';
import { DEFAULT_WORKING_OPTIONS } from '../src/lib/core/pipeline/image-pipeline';
import { getCoverExportOptions } from '../src/lib/core/pipeline/export-quality-mode';
import type { CropTarget } from '../src/lib/types';

describe('image workflow contracts', () => {
  it('keeps working images capped for memory safety', () => {
    expect(DEFAULT_WORKING_OPTIONS.maxSide).toBe(2048);
  });

  it('only caps thumbnail exports', () => {
    expect(getCoverExportOptions('thumbnail')?.maxDimension).toBe(800);
    expect(getCoverExportOptions('compressed')?.maxDimension).toBeUndefined();
    expect(getCoverExportOptions('best')?.maxDimension).toBeUndefined();
  });

  it('uses working source for preview and original source for export', () => {
    const working = new File(['working'], 'working.jpg', {
      type: 'image/jpeg',
    });
    const original = new File(['original'], 'original.jpg', {
      type: 'image/jpeg',
    });
    const state = buildDefaultCoverCropState();
    const target: CropTarget = {
      width: 1200,
      height: 1600,
      output: 'target',
    };

    const preview = buildCompositionInputForPurpose({
      purpose: 'preview',
      sources: {
        working: {
          file: working,
          naturalWidth: 1200,
          naturalHeight: 1600,
        },
        original: {
          file: original,
          naturalWidth: 2400,
          naturalHeight: 3200,
        },
      },
      target,
      state,
    });

    const exportInput = buildCompositionInputForPurpose({
      purpose: 'export',
      sources: {
        working: {
          file: working,
          naturalWidth: 1200,
          naturalHeight: 1600,
        },
        original: {
          file: original,
          naturalWidth: 2400,
          naturalHeight: 3200,
        },
      },
      target,
      state,
    });

    const fallbackExport = buildCompositionInputForPurpose({
      purpose: 'export',
      sources: {
        working: {
          file: working,
          naturalWidth: 1200,
          naturalHeight: 1600,
        },
      },
      target,
      state,
    });

    expect(preview?.file).toBe(working);
    expect(exportInput?.file).toBe(original);
    expect(fallbackExport?.file).toBe(working);
  });
});
