import type { EpubPackageMetadata, EpubPackagePerson } from './epub-metadata.service';

export function areEpubPackageMetadataEqual(
  left: EpubPackageMetadata,
  right: EpubPackageMetadata,
): boolean {
  const normalizePerson = (person: EpubPackagePerson) => ({
    name: person.name.trim(),
    role: person.role?.trim() || '',
    fileAs: person.fileAs?.trim() || '',
  });
  const normalizeOptional = (value?: string) => value?.trim() || '';
  const normalize = (metadata: EpubPackageMetadata) => ({
    title: metadata.title.trim(),
    creators: metadata.creators.map(normalizePerson),
    language: metadata.language.trim(),
    identifier: {
      value: metadata.identifier.value.trim(),
      scheme: normalizeOptional(metadata.identifier.scheme),
    },
    publisher: normalizeOptional(metadata.publisher),
    date: normalizeOptional(metadata.date),
    description: normalizeOptional(metadata.description),
    subjects: metadata.subjects.map((subject) => subject.trim()).filter(Boolean),
    contributors: metadata.contributors.map(normalizePerson),
    type: normalizeOptional(metadata.type),
    format: normalizeOptional(metadata.format),
    source: normalizeOptional(metadata.source),
    relation: normalizeOptional(metadata.relation),
    coverage: normalizeOptional(metadata.coverage),
    rights: normalizeOptional(metadata.rights),
  });

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
