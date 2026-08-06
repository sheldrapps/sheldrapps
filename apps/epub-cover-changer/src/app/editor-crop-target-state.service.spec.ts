import { EditorCropTargetStateService } from '@sheldrapps/image-workflow/editor';
import type { CropTargetsConfig } from '@sheldrapps/image-workflow/editor';

const config: CropTargetsConfig = {
  activeCategory: 'paper',
  paper: {
    catalog: [
      {
        parentId: 'iso-216',
        id: 'a-series',
        i18nKey: 'PAPER_GROUPS.ISO_A_SERIES',
        items: [
          {
            id: 'a4',
            i18nKey: 'PAPER_PRESETS.A4',
            width: 210,
            height: 297,
            unit: 'mm',
            outputMode: 'aspect-only',
          },
        ],
      },
    ],
    supportsOrientation: true,
    defaultOrientation: 'portrait',
  },
  publishing: {
    catalog: [
      {
        parentId: 'ridi',
        id: 'ebook-cover',
        i18nKey: 'PUBLISHING_GROUPS.RIDI.EBOOK_COVER',
        items: [
          {
            id: 'ridi-1600x2560',
            i18nKey: 'PUBLISHING_PRESETS.RIDI_1600X2560',
            width: 1600,
            height: 2560,
            unit: 'px',
            outputMode: 'fixed-size',
          },
        ],
      },
    ],
  },
  ratio: {
    catalog: [
      {
        parentId: 'common',
        id: 'common-ratios',
        i18nKey: 'RATIO_GROUPS.COMMON',
        items: [
          {
            id: 'one-one',
            i18nKey: 'RATIO_PRESETS.1_1',
            width: 1,
            height: 1,
            unit: 'ratio',
            outputMode: 'aspect-only',
          },
          {
            id: 'sixteen_nine',
            i18nKey: 'RATIO_PRESETS.16_9',
            width: 16,
            height: 9,
            unit: 'ratio',
            outputMode: 'aspect-only',
          },
          {
            id: 'custom_ratio',
            i18nKey: 'RATIO_PRESETS.CUSTOM',
            width: 1,
            height: 1,
            unit: 'ratio',
            outputMode: 'aspect-only',
          },
        ],
      },
    ],
    supportsOrientation: true,
  },
};

describe('EditorCropTargetStateService', () => {
  it('uses aspect-only for paper and swaps A4 in landscape', () => {
    const service = new EditorCropTargetStateService();
    service.initFromTools({ cropTargets: config });

    expect(service.activeCategory()).toBe('paper');
    expect(service.effectiveTarget()?.width).toBe(210);
    expect(service.effectiveTarget()?.height).toBe(297);
    expect(service.effectiveTarget()?.output).toBe('source');

    service.setOrientation('landscape');

    expect(service.effectiveTarget()?.width).toBe(297);
    expect(service.effectiveTarget()?.height).toBe(210);
    expect(service.effectiveTarget()?.outputMode).toBe('aspect-only');
  });

  it('keeps fixed-size publishing dimensions exact', () => {
    const service = new EditorCropTargetStateService();
    service.initFromTools({ cropTargets: config });
    service.setActiveCategory('publishing');

    expect(service.selection()?.presetId).toBe('ridi-1600x2560');
    expect(service.effectiveTarget()).toEqual(
      jasmine.objectContaining({
        width: 1600,
        height: 2560,
        output: 'target',
        outputMode: 'fixed-size',
      }),
    );
  });

  it('does not rotate a square ratio', () => {
    const service = new EditorCropTargetStateService();
    service.initFromTools({ cropTargets: config });
    service.setActiveCategory('ratio');
    service.setOrientation('landscape');

    expect(service.effectiveTarget()?.width).toBe(1);
    expect(service.effectiveTarget()?.height).toBe(1);
    expect(service.orientation()).toBe('portrait');
  });

  it('supports the 16:9 ratio preset', () => {
    const service = new EditorCropTargetStateService();
    service.initFromTools({ cropTargets: config });
    service.setActiveCategory('ratio');
    service.selectPreset('sixteen_nine');

    expect(service.effectiveTarget()).toEqual(
      jasmine.objectContaining({
        width: 16,
        height: 9,
        output: 'source',
        outputMode: 'aspect-only',
      }),
    );
  });

  it('updates the custom ratio dimensions', () => {
    const service = new EditorCropTargetStateService();
    service.initFromTools({ cropTargets: config });
    service.setActiveCategory('ratio');
    service.selectPreset('custom_ratio');
    service.updateCustomPresetDimensions('custom_ratio', 5, 8);

    expect(service.effectiveTarget()).toEqual(
      jasmine.objectContaining({ width: 5, height: 8, output: 'source' }),
    );
    expect(service.selectedPreset()?.presetId).toBe('custom_ratio');
  });

  it('reapplies the current selection when the same option is confirmed', () => {
    const service = new EditorCropTargetStateService();
    service.initFromTools({ cropTargets: config });
    service.setActiveCategory('ratio');

    const previousSelection = service.selection();
    service.reapplySelection();

    expect(service.selection()?.presetId).toBe('one-one');
    expect(service.selection()).not.toBe(previousSelection);
  });
});
