import {
  getCoverExportOptions,
  normalizeExportQualityMode,
} from '../../public-api';

describe('cover export mode helpers', () => {
  it('maps best mode to PNG without quality override', () => {
    expect(getCoverExportOptions('best')).toEqual({
      mode: 'best',
      mimeType: 'image/png',
      extension: 'png',
    });
  });

  it('maps compressed mode to JPEG with quality override', () => {
    expect(getCoverExportOptions('compressed')).toEqual({
      mode: 'compressed',
      mimeType: 'image/jpeg',
      extension: 'jpg',
      quality: 0.88,
    });
  });

  it('normalizes best mode to compressed for non-pro users', () => {
    expect(normalizeExportQualityMode('best', false)).toBe('compressed');
  });

  it('keeps best mode for pro users', () => {
    expect(normalizeExportQualityMode('best', true)).toBe('best');
  });
});
