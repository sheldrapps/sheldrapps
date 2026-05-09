import type { ExportQualityMode } from '@sheldrapps/image-workflow';

export type ExportQualityTranslationScope = 'CREATE' | 'CHANGE';

export const EXPORT_QUALITY_SELECTOR_MODES: readonly ExportQualityMode[] = [
  'thumbnail',
  'compressed',
  'best',
];
