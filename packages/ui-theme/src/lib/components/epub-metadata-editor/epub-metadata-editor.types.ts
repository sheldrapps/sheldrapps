export type EpubMetadataFamily = 'epub2' | 'epub3';

export interface EpubMetadataPerson {
  name: string;
  role?: string;
  fileAs?: string;
}

export interface EpubMetadataIdentifier {
  value: string;
  scheme?: string;
}

export interface EpubMetadataFormValue {
  title: string;
  creators: EpubMetadataPerson[];
  language: string;
  identifier: EpubMetadataIdentifier;
  publisher?: string;
  date?: string;
  description?: string;
  subjects: string[];
  contributors: EpubMetadataPerson[];
  type?: string;
  format?: string;
  source?: string;
  relation?: string;
  coverage?: string;
  rights?: string;
}

export interface EpubMetadataEditorInput {
  version: EpubMetadataFamily;
  detectedVersion?: string;
  fileName?: string;
  metadata: EpubMetadataFormValue;
}
export function createEpubMetadataEditorDraft(
  fileName?: string,
): EpubMetadataEditorInput {
  const normalizedFileName = fileName?.trim() || 'untitled.epub';
  const title = normalizedFileName.replace(/\.epub$/i, '') || 'Untitled';

  return {
    version: 'epub3',
    fileName: normalizedFileName,
    metadata: {
      title,
      creators: [],
      language: 'en',
      identifier: { value: `urn:filename:${title}` },
      subjects: [],
      contributors: [],
    },
  };
}

