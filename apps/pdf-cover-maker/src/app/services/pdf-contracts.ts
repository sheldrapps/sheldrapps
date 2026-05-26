export type PdfValidationErrorCode =
  | 'PDF_ERROR_NO_FILE'
  | 'PDF_ERROR_TYPE'
  | 'PDF_ERROR_SIZE'
  | 'PDF_ERROR_EMPTY'
  | 'PDF_ERROR_CORRUPT'
  | 'PDF_ERROR_ENCRYPTED'
  | 'PDF_ERROR_PASSWORD_PROTECTED'
  | 'PDF_ERROR_UNSUPPORTED'
  | 'PDF_ERROR_STORAGE'
  | 'PDF_ERROR_REWRITE'
  | 'PDF_ERROR_CANCELLED';

export type PdfRewriteNativeErrorCode =
  | 'PDF_TOO_LARGE'
  | 'NO_SPACE'
  | 'PDF_CORRUPT'
  | 'PDF_ENCRYPTED'
  | 'PDF_PASSWORD_REQUIRED'
  | 'UNSUPPORTED_PDF'
  | 'REWRITE_FAILED'
  | 'CANCELLED'
  | 'PICK_CANCELLED';

export interface PdfInspectionResult {
  valid: boolean;
  encrypted?: boolean;
  passwordProtected?: boolean;
  pageCount?: number;
  fileSizeBytes?: number;
  title?: string;
  author?: string;
  errorCode?: PdfRewriteNativeErrorCode;
}

export const PDF_MIME = 'application/pdf';
export const PDF_EXT = '.pdf';
export const PDF_FOLDER = 'pdfcovermaker';

export function mapNativePdfErrorToValidation(
  code: string | undefined | null,
): PdfValidationErrorCode {
  switch (code) {
    case 'PDF_TOO_LARGE':
      return 'PDF_ERROR_SIZE';
    case 'NO_SPACE':
      return 'PDF_ERROR_STORAGE';
    case 'PDF_CORRUPT':
      return 'PDF_ERROR_CORRUPT';
    case 'PDF_ENCRYPTED':
      return 'PDF_ERROR_ENCRYPTED';
    case 'PDF_PASSWORD_REQUIRED':
      return 'PDF_ERROR_PASSWORD_PROTECTED';
    case 'UNSUPPORTED_PDF':
      return 'PDF_ERROR_UNSUPPORTED';
    case 'REWRITE_FAILED':
      return 'PDF_ERROR_REWRITE';
    case 'CANCELLED':
    case 'PICK_CANCELLED':
      return 'PDF_ERROR_CANCELLED';
    default:
      return 'PDF_ERROR_CORRUPT';
  }
}

