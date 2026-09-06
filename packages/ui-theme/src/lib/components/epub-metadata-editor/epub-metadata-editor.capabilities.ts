import type { EpubMetadataFamily } from './epub-metadata-editor.types';

export interface EpubMetadataCapabilities {
  identifierScheme: boolean;
  personRole: boolean;
  personFileAs: boolean;
  dateEvent: boolean;
  epub3Refinements: boolean;
  modifiedDate: boolean;
}

export const EPUB_METADATA_CAPABILITIES: Record<
  EpubMetadataFamily,
  EpubMetadataCapabilities
> = {
  epub2: {
    identifierScheme: true,
    personRole: true,
    personFileAs: true,
    dateEvent: true,
    epub3Refinements: false,
    modifiedDate: false,
  },
  epub3: {
    identifierScheme: false,
    personRole: true,
    personFileAs: true,
    dateEvent: false,
    epub3Refinements: true,
    modifiedDate: true,
  },
};
