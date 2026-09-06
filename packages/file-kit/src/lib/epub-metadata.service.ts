import JSZip, { type JSZipObject } from 'jszip';

const EPUB_MIMETYPE = 'application/epub+zip';
const EPUB_METADATA_MAX_BYTES = 128 * 1024 * 1024;
const DC_NAMESPACE = 'http://purl.org/dc/elements/1.1/';
const OPF_NAMESPACE = 'http://www.idpf.org/2007/opf';
const DCTERMS_MODIFIED = 'dcterms:modified';

export type EpubPackageVersion = 'epub2' | 'epub3';

export interface EpubPackagePerson {
  name: string;
  role?: string;
  fileAs?: string;
}

export interface EpubPackageIdentifier {
  value: string;
  scheme?: string;
}

export interface EpubPackageMetadata {
  title: string;
  creators: EpubPackagePerson[];
  language: string;
  identifier: EpubPackageIdentifier;
  publisher?: string;
  date?: string;
  description?: string;
  subjects: string[];
  contributors: EpubPackagePerson[];
  type?: string;
  format?: string;
  source?: string;
  relation?: string;
  coverage?: string;
  rights?: string;
}

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
export interface EpubMetadataDocument {
  version: EpubPackageVersion;
  detectedVersion: string;
  metadata: EpubPackageMetadata;
}

type EpubXmlContext = {
  zip: JSZip;
  opfPath: string;
  opfDocument: XMLDocument;
  packageElement: Element;
  metadataElement: Element;
};

const DUBLIN_CORE_FIELDS = [
  'title',
  'creator',
  'language',
  'identifier',
  'publisher',
  'date',
  'description',
  'subject',
  'contributor',
  'type',
  'format',
  'source',
  'relation',
  'coverage',
  'rights',
] as const;

export async function readEpubMetadata(
  bytes: Uint8Array,
): Promise<EpubMetadataDocument | null> {
  const context = await readEpubXmlContext(bytes);
  if (!context) return null;

  const detectedVersion = context.packageElement.getAttribute('version')?.trim() || '3.0';
  const version: EpubPackageVersion = detectedVersion.startsWith('2') ? 'epub2' : 'epub3';
  const identifierElement = findIdentifierElement(context);

  return {
    version,
    detectedVersion,
    metadata: {
      title: textOf(findDcElements(context.metadataElement, 'title')[0]),
      creators: findDcElements(context.metadataElement, 'creator').map((element) =>
        readPerson(context.opfDocument, element),
      ),
      language: textOf(findDcElements(context.metadataElement, 'language')[0]),
      identifier: {
        value: textOf(identifierElement),
        scheme: optionalValue(
          identifierElement?.getAttribute('scheme') ??
            findRefinement(context.opfDocument, identifierElement, 'scheme'),
        ),
      },
      publisher: optionalValue(textOf(findDcElements(context.metadataElement, 'publisher')[0])),
      date: optionalValue(textOf(findDcElements(context.metadataElement, 'date')[0])),
      description: optionalValue(textOf(findDcElements(context.metadataElement, 'description')[0])),
      subjects: findDcElements(context.metadataElement, 'subject')
        .map((element) => textOf(element))
        .filter((value) => value.length > 0),
      contributors: findDcElements(context.metadataElement, 'contributor').map((element) =>
        readPerson(context.opfDocument, element),
      ),
      type: optionalValue(textOf(findDcElements(context.metadataElement, 'type')[0])),
      format: optionalValue(textOf(findDcElements(context.metadataElement, 'format')[0])),
      source: optionalValue(textOf(findDcElements(context.metadataElement, 'source')[0])),
      relation: optionalValue(textOf(findDcElements(context.metadataElement, 'relation')[0])),
      coverage: optionalValue(textOf(findDcElements(context.metadataElement, 'coverage')[0])),
      rights: optionalValue(textOf(findDcElements(context.metadataElement, 'rights')[0])),
    },
  };
}

export async function writeEpubMetadata(
  bytes: Uint8Array,
  metadata: EpubPackageMetadata,
): Promise<Uint8Array> {
  const context = await readEpubXmlContext(bytes);
  if (!context) throw new Error('EPUB metadata package document could not be read');

  const detectedVersion = context.packageElement.getAttribute('version')?.trim() || '3.0';
  const version: EpubPackageVersion = detectedVersion.startsWith('2') ? 'epub2' : 'epub3';
  const existingIdentifier = findIdentifierElement(context);
  const identifierId =
    existingIdentifier?.getAttribute('id')?.trim() ||
    context.packageElement.getAttribute('unique-identifier')?.trim() ||
    'book-id';
  const existingCreatorIds = findDcElements(context.metadataElement, 'creator')
    .map((element) => element.getAttribute('id')?.trim())
    .filter((value): value is string => !!value);
  const existingContributorIds = findDcElements(context.metadataElement, 'contributor')
    .map((element) => element.getAttribute('id')?.trim())
    .filter((value): value is string => !!value);

  removeManagedMetadata(context.metadataElement, context.opfDocument, [
    ...existingCreatorIds,
    ...existingContributorIds,
    identifierId,
  ]);
  context.packageElement.setAttribute('unique-identifier', identifierId);

  appendDc(context, 'title', metadata.title);
  appendPeople(context, version, 'creator', metadata.creators, existingCreatorIds);
  appendDc(context, 'language', metadata.language);
  appendIdentifier(context, metadata.identifier, identifierId);
  appendDc(context, 'publisher', metadata.publisher);
  appendDc(context, 'date', metadata.date);
  appendDc(context, 'description', metadata.description);
  metadata.subjects.forEach((subject) => appendDc(context, 'subject', subject));
  appendPeople(context, version, 'contributor', metadata.contributors, existingContributorIds);
  appendDc(context, 'type', metadata.type);
  appendDc(context, 'format', metadata.format);
  appendDc(context, 'source', metadata.source);
  appendDc(context, 'relation', metadata.relation);
  appendDc(context, 'coverage', metadata.coverage);
  appendDc(context, 'rights', metadata.rights);
  if (version === 'epub3') appendMeta(context, DCTERMS_MODIFIED, new Date().toISOString());

  context.zip.file(
    context.opfPath,
    new XMLSerializer().serializeToString(context.opfDocument),
  );
  return buildZipBytes(context.zip);
}

async function readEpubXmlContext(bytes: Uint8Array): Promise<EpubXmlContext | null> {
  if (bytes.byteLength > EPUB_METADATA_MAX_BYTES) return null;

  try {
    const zip = await JSZip.loadAsync(bytes);
    const containerText = await readZipText(zip, 'META-INF/container.xml');
    const containerDocument = containerText ? parseXml(containerText) : null;
    const rootfile = containerDocument
      ? firstByLocalName(containerDocument, 'rootfile')
      : null;
    const opfPath = normalizePath(rootfile?.getAttribute('full-path')?.trim() || '');
    const opfText = opfPath ? await readZipText(zip, opfPath) : null;
    const opfDocument = opfText ? parseXml(opfText) : null;
    const packageElement = opfDocument ? firstByLocalName(opfDocument, 'package') : null;
    const metadataElement = packageElement
      ? firstByLocalName(packageElement, 'metadata')
      : null;

    if (!opfDocument || !packageElement || !metadataElement) return null;
    return { zip, opfPath, opfDocument, packageElement, metadataElement };
  } catch {
    return null;
  }
}

function findIdentifierElement(context: EpubXmlContext): Element | null {
  const uniqueId = context.packageElement.getAttribute('unique-identifier')?.trim();
  const identifiers = findDcElements(context.metadataElement, 'identifier');
  return identifiers.find((element) => element.getAttribute('id')?.trim() === uniqueId) ?? identifiers[0] ?? null;
}

function readPerson(document: XMLDocument, element: Element): EpubPackagePerson {
  return {
    name: textOf(element),
    role: optionalValue(
      element.getAttribute('role') ?? findRefinement(document, element, 'role'),
    ),
    fileAs: optionalValue(
      element.getAttribute('file-as') ?? findRefinement(document, element, 'file-as'),
    ),
  };
}

function findDcElements(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter(
    (element) => element.localName === localName && element.namespaceURI === DC_NAMESPACE,
  );
}

function removeManagedMetadata(
  metadata: Element,
  document: XMLDocument,
  personIds: readonly string[],
): void {
  const ids = new Set(personIds.map((value) => `#${value}`));
  for (const child of Array.from(metadata.children)) {
    if (
      child.namespaceURI === DC_NAMESPACE &&
      DUBLIN_CORE_FIELDS.includes(child.localName as (typeof DUBLIN_CORE_FIELDS)[number])
    ) {
      child.remove();
      continue;
    }
    if (child.localName !== 'meta') continue;

    const refines = child.getAttribute('refines')?.trim();
    const property = child.getAttribute('property')?.trim();
    if (
      ids.has(refines ?? '') ||
      property === 'role' ||
      property === 'file-as' ||
      property === DCTERMS_MODIFIED
    ) {
      child.remove();
    }
  }

  for (const element of Array.from(document.getElementsByTagName('*'))) {
    const refines = element.getAttribute?.('refines')?.trim();
    if (element.localName === 'meta' && ids.has(refines ?? '')) element.remove();
  }
}

function appendPeople(
  context: EpubXmlContext,
  version: EpubPackageVersion,
  field: 'creator' | 'contributor',
  people: readonly EpubPackagePerson[],
  existingIds: readonly string[],
): void {
  people.forEach((person, index) => {
    const id = existingIds[index] || `${field}-${index + 1}`;
    const element = appendDc(context, field, person.name, id);
    if (!element) return;

    if (version === 'epub2') {
      setOptionalAttribute(element, 'role', person.role);
      setOptionalAttribute(element, 'file-as', person.fileAs);
      return;
    }
    appendRefinement(context, element, 'role', person.role);
    appendRefinement(context, element, 'file-as', person.fileAs);
  });
}

function appendIdentifier(
  context: EpubXmlContext,
  identifier: EpubPackageIdentifier,
  id: string,
): void {
  const element = appendDc(context, 'identifier', identifier.value, id);
  if (element) setOptionalAttribute(element, 'scheme', identifier.scheme);
}

function appendDc(
  context: EpubXmlContext,
  localName: string,
  value: string | undefined,
  id?: string,
): Element | null {
  const normalized = value?.trim() || '';
  if (!normalized) return null;

  const element = context.opfDocument.createElementNS(DC_NAMESPACE, `dc:${localName}`);
  if (id) element.setAttribute('id', id);
  element.textContent = normalized;
  context.metadataElement.appendChild(element);
  return element;
}

function appendRefinement(
  context: EpubXmlContext,
  element: Element,
  property: string,
  value: string | undefined,
): void {
  if (!value?.trim() || !element.getAttribute('id')) return;

  const refinement = context.opfDocument.createElementNS(OPF_NAMESPACE, 'meta');
  refinement.setAttribute('refines', `#${element.getAttribute('id')}`);
  refinement.setAttribute('property', property);
  refinement.textContent = value.trim();
  context.metadataElement.appendChild(refinement);
}

function appendMeta(context: EpubXmlContext, property: string, value: string): void {
  const meta = context.opfDocument.createElementNS(OPF_NAMESPACE, 'meta');
  meta.setAttribute('property', property);
  meta.textContent = value;
  context.metadataElement.appendChild(meta);
}

function setOptionalAttribute(element: Element, name: string, value: string | undefined): void {
  if (value?.trim()) element.setAttribute(name, value.trim());
}

function findRefinement(
  document: XMLDocument,
  target: Element | null | undefined,
  property: string,
): string | undefined {
  const id = target?.getAttribute('id')?.trim();
  if (!id) return undefined;

  const refinement = Array.from(document.getElementsByTagName('*')).find(
    (element) =>
      element.localName === 'meta' &&
      element.getAttribute('refines')?.trim() === `#${id}` &&
      element.getAttribute('property')?.trim() === property,
  );
  return optionalValue(refinement?.textContent);
}

function textOf(element: Element | null | undefined): string {
  return element?.textContent?.trim() || '';
}

function optionalValue(value: string | null | undefined): string | undefined {
  const normalized = value?.trim() || '';
  return normalized || undefined;
}

async function buildZipBytes(zip: JSZip): Promise<Uint8Array> {
  const outputZip = new JSZip();
  const mimetypeValue = (await zip.file('mimetype')?.async('string'))?.trim() || EPUB_MIMETYPE;
  outputZip.file('mimetype', mimetypeValue, { compression: 'STORE' });

  const entryNames = Object.keys(zip.files)
    .filter((name) => name !== 'mimetype' && !zip.files[name]?.dir)
    .sort((left, right) => left.localeCompare(right));

  for (const entryName of entryNames) {
    const entry = zip.files[entryName];
    if (!entry) continue;
    outputZip.file(entryName, await entry.async('uint8array'), { compression: 'DEFLATE' });
  }

  return outputZip.generateAsync({
    type: 'uint8array',
    mimeType: EPUB_MIMETYPE,
    compression: 'DEFLATE',
    platform: 'UNIX',
  });
}

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(normalizePath(path)) as JSZipObject | null;
  return entry ? entry.async('string') : null;
}

function parseXml(text: string): XMLDocument | null {
  const document = new DOMParser().parseFromString(text, 'application/xml');
  return document.querySelector('parsererror') ? null : document;
}

function firstByLocalName(parent: Document | Element, localName: string): Element | null {
  return Array.from(parent.getElementsByTagName('*')).find(
    (element) => element.localName === localName,
  ) ?? null;
}

function normalizePath(path: string): string {
  const normalized: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  return normalized.join('/');
}

