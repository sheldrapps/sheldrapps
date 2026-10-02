export * from './core-public-api';
export { EpubRewriteService } from './lib/epub-rewrite.service';
export { provideNativeFileKit } from './lib/native-providers';
export { areEpubPackageMetadataEqual } from './lib/epub-metadata-equality';
export type {
  EpubMetadataDocument,
  EpubPackageMetadata,
  EpubPackagePerson,
} from './lib/epub-metadata.service';
