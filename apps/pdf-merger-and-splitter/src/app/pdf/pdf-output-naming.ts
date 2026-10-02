const PDF_EXTENSION = /\.pdf$/i;

function twoDigits(value: number): string {
  return value.toString().padStart(2, '0');
}

export function pdfOutputTimestamp(date: Date = new Date()): string {
  return [
    date.getFullYear().toString(),
    twoDigits(date.getMonth() + 1),
    twoDigits(date.getDate()),
  ].join('') + `_${twoDigits(date.getHours())}${twoDigits(date.getMinutes())}${twoDigits(date.getSeconds())}`;
}

export function pdfOutputBaseName(sourceName: string | undefined, fallback: string): string {
  const baseName = (sourceName ?? '').replace(PDF_EXTENSION, '').trim();
  return baseName || fallback;
}

export function mergedPdfOutputName(
  sourceName: string | undefined,
  timestamp = pdfOutputTimestamp(),
): string {
  return `${pdfOutputBaseName(sourceName, 'merged')}_${timestamp}_merged.pdf`;
}

export function splitPdfOutputName(
  sourceName: string | undefined,
  partNumber: number,
  timestamp = pdfOutputTimestamp(),
): string {
  return `${pdfOutputBaseName(sourceName, 'split')}_${timestamp} - ${partNumber}.pdf`;
}
