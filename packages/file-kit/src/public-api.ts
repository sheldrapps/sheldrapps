/**
 * Public API for @sheldrapps/file-kit
 */

// Types
export * from './lib/types';

// Errors
export * from './lib/errors';

// Utilities
export { guessMimeType } from './lib/mime';
export { makeSafeFilename } from './lib/name';

// Service
export * from './lib/file-kit.service';
export {
  EPUB_FIXER_PORT,
  EpubFixerPortError,
  provideEpubFixerPort,
  type EpubDiagnosticIssue,
  type EpubDiagnosticIssueCode,
  type EpubDiagnosticResult,
  type EpubDiagnosticStatus,
  type EpubExportResult,
  type EpubFixerEnvironment,
  type EpubFixerPort,
  type EpubRepairResult,
  type PrepareEpubInput,
} from './lib/epub-fixer.port';
export * from './lib/epub-fixer-native.service';
export * from "./lib/epub-cover-metadata";
export * from "./lib/epub-cover-generator";
export * from './lib/epub-public-store';
export * from './lib/epub-read.service';
export * from './lib/epub-rewrite.service';
export * from './lib/epub-working-copy.service';

// Providers
export * from './lib/providers';
export * from "./lib/web-epub-cover.service";
