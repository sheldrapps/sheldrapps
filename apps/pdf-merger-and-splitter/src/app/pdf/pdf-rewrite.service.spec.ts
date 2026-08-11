import { PdfRewriteError } from './pdf-rewrite.service';

describe('PdfRewriteError', () => {
  it('preserves the native error code', () => {
    expect(new PdfRewriteError('PDF_ENCRYPTED').code).toBe('PDF_ENCRYPTED');
  });
});
