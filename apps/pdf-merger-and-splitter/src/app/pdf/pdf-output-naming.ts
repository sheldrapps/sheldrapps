const PDF_EXTENSION = /\.pdf$/i;

export function pdfOutputBaseName(sourceName: string | undefined, fallback: string): string {
  const baseName = (sourceName ?? '').replace(PDF_EXTENSION, '').trim();
  return baseName || fallback;
}

export function mergedPdfOutputName(sourceName: string | undefined): string {
  return `${pdfOutputBaseName(sourceName, 'merged')}_merged.pdf`;
}

export function splitPdfOutputName(sourceName: string | undefined, partNumber: number): string {
  return `${pdfOutputBaseName(sourceName, 'split')} - ${partNumber}.pdf`;
}
