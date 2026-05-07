import {
  getCoverExportOptions,
  normalizeCoverExportMode,
} from './cover-export-mode';

describe('cover export mode helpers', () => {
  it('maps lossless mode to PNG without quality override', () => {
    expect(getCoverExportOptions('lossless')).toEqual({
      mode: 'lossless',
      mimeType: 'image/png',
      extension: 'png',
    });
  });

  it('maps compressed mode to JPEG with quality override', () => {
    expect(getCoverExportOptions('compressed')).toEqual({
      mode: 'compressed',
      mimeType: 'image/jpeg',
      extension: 'jpg',
      quality: 0.92,
    });
  });

  it('normalizes legacy optimized mode to compressed', () => {
    expect(normalizeCoverExportMode('optimized')).toBe('compressed');
  });

  it('normalizes unknown values to lossless', () => {
    expect(normalizeCoverExportMode('unexpected')).toBe('lossless');
  });
});
