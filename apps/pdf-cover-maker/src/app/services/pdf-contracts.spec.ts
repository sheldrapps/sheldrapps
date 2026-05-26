import { mapNativePdfErrorToValidation } from './pdf-contracts';

describe('pdf-contracts', () => {
  it('maps native size/storage/corrupt errors', () => {
    expect(mapNativePdfErrorToValidation('PDF_TOO_LARGE')).toBe('PDF_ERROR_SIZE');
    expect(mapNativePdfErrorToValidation('NO_SPACE')).toBe('PDF_ERROR_STORAGE');
    expect(mapNativePdfErrorToValidation('PDF_CORRUPT')).toBe('PDF_ERROR_CORRUPT');
  });

  it('maps encrypted/password/unsupported errors', () => {
    expect(mapNativePdfErrorToValidation('PDF_ENCRYPTED')).toBe('PDF_ERROR_ENCRYPTED');
    expect(mapNativePdfErrorToValidation('PDF_PASSWORD_REQUIRED')).toBe(
      'PDF_ERROR_PASSWORD_PROTECTED',
    );
    expect(mapNativePdfErrorToValidation('UNSUPPORTED_PDF')).toBe(
      'PDF_ERROR_UNSUPPORTED',
    );
  });

  it('maps cancellation and fallback', () => {
    expect(mapNativePdfErrorToValidation('CANCELLED')).toBe('PDF_ERROR_CANCELLED');
    expect(mapNativePdfErrorToValidation('PICK_CANCELLED')).toBe(
      'PDF_ERROR_CANCELLED',
    );
    expect(mapNativePdfErrorToValidation('UNKNOWN')).toBe('PDF_ERROR_CORRUPT');
  });
});

