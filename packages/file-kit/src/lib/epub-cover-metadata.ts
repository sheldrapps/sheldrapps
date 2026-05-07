import JSZip, { type JSZipObject } from 'jszip';

const EPUB_MIMETYPE = 'application/epub+zip';
const SHELDR_META_PREFIX = 'sheldrapps:cover-';
const META_COLOR_MODE = `${SHELDR_META_PREFIX}color-mode`;
const META_ARTIFACT_REDUCTION_ENABLED =
  `${SHELDR_META_PREFIX}artifact-reduction-enabled`;
const META_ARTIFACT_REDUCTION_MODE =
  `${SHELDR_META_PREFIX}artifact-reduction-mode`;
const META_IS_DITHERED = `${SHELDR_META_PREFIX}is-dithered`;
const META_DITHER_ALGORITHM = `${SHELDR_META_PREFIX}dither-algorithm`;
const META_RENDER_KIND = `${SHELDR_META_PREFIX}render-kind`;
const META_PROCESSED_BY = 'sheldrapps:processed-by';
const META_METADATA_VERSION = 'sheldrapps:metadata-version';

export interface SheldrCoverMetadata {
  colorMode?: 'color' | 'black-white' | 'grayscale';
  artifactReductionEnabled?: boolean;
  artifactReductionMode?: 'none' | 'bw-dither' | 'adaptive-color' | 'adaptive-gray' | null;
  isDithered: boolean;
  ditherAlgorithm?: string | null;
  renderKind: string;
  processedBy: string;
  metadataVersion: string;
}

type EpubXmlContext = {
  zip: JSZip;
  opfPath: string;
  opfDocument: XMLDocument;
};

export async function readSheldrCoverMetadata(
  bytes: Uint8Array,
): Promise<SheldrCoverMetadata | null> {
  const context = await readEpubXmlContext(bytes);
  if (!context) {
    return null;
  }

  const storedColorMode = normalizeColorMode(
    findMetaContent(context.opfDocument, META_COLOR_MODE),
  );
  const artifactReductionEnabledValue = findMetaContent(
    context.opfDocument,
    META_ARTIFACT_REDUCTION_ENABLED,
  );
  const storedArtifactReductionMode = normalizeArtifactReductionMode(
    findMetaContent(context.opfDocument, META_ARTIFACT_REDUCTION_MODE),
  );
  const isDitheredValue = findMetaContent(
    context.opfDocument,
    META_IS_DITHERED,
  );
  const hasLegacyDitherFlag =
    isDitheredValue === 'true' || isDitheredValue === 'false';
  const hasArtifactReductionFlag =
    artifactReductionEnabledValue === 'true' ||
    artifactReductionEnabledValue === 'false';

  if (!hasLegacyDitherFlag && !hasArtifactReductionFlag) {
    return null;
  }

  const artifactReductionEnabled = hasArtifactReductionFlag
    ? artifactReductionEnabledValue === 'true'
    : storedArtifactReductionMode !== 'none'
      ? true
      : isDitheredValue === 'true';
  const colorMode =
    storedColorMode ??
    (isDitheredValue === 'true' ? 'black-white' : undefined);
  const artifactReductionMode =
    storedArtifactReductionMode !== 'none'
      ? storedArtifactReductionMode
      : isDitheredValue === 'true'
        ? 'bw-dither'
        : 'none';
  const isDithered = hasLegacyDitherFlag
    ? isDitheredValue === 'true'
    : artifactReductionMode !== 'none';

  return {
    colorMode,
    artifactReductionEnabled,
    artifactReductionMode,
    isDithered,
    ditherAlgorithm:
      findMetaContent(context.opfDocument, META_DITHER_ALGORITHM) ?? null,
    renderKind:
      findMetaContent(context.opfDocument, META_RENDER_KIND) ??
      (isDithered
        ? 'processed-dithered'
        : 'processed-standard'),
    processedBy:
      findMetaContent(context.opfDocument, META_PROCESSED_BY) ??
      'unknown',
    metadataVersion:
      findMetaContent(context.opfDocument, META_METADATA_VERSION) ?? '1',
  };
}

export async function writeSheldrCoverMetadata(
  bytes: Uint8Array,
  metadata: SheldrCoverMetadata,
): Promise<Uint8Array> {
  const context = await readEpubXmlContext(bytes);
  if (!context) {
    return bytes;
  }

  const metadataElement = ensureMetadataElement(context.opfDocument);
  if (!metadataElement) {
    return bytes;
  }

  upsertMeta(
    context.opfDocument,
    metadataElement,
    META_COLOR_MODE,
    normalizeColorMode(metadata.colorMode) ?? 'color',
  );
  upsertMeta(
    context.opfDocument,
    metadataElement,
    META_ARTIFACT_REDUCTION_ENABLED,
    String(!!metadata.artifactReductionEnabled),
  );
  upsertMeta(
    context.opfDocument,
    metadataElement,
    META_ARTIFACT_REDUCTION_MODE,
    normalizeArtifactReductionMode(metadata.artifactReductionMode) ?? 'none',
  );
  upsertMeta(
    context.opfDocument,
    metadataElement,
    META_IS_DITHERED,
    String(metadata.isDithered),
  );
  upsertMeta(
    context.opfDocument,
    metadataElement,
    META_DITHER_ALGORITHM,
    metadata.ditherAlgorithm?.trim() || null,
  );
  upsertMeta(
    context.opfDocument,
    metadataElement,
    META_RENDER_KIND,
    metadata.renderKind,
  );
  upsertMeta(
    context.opfDocument,
    metadataElement,
    META_PROCESSED_BY,
    metadata.processedBy,
  );
  upsertMeta(
    context.opfDocument,
    metadataElement,
    META_METADATA_VERSION,
    metadata.metadataVersion,
  );

  const xml = new XMLSerializer().serializeToString(context.opfDocument);
  context.zip.file(context.opfPath, xml);

  return buildZipBytes(context.zip);
}

async function readEpubXmlContext(
  bytes: Uint8Array,
): Promise<EpubXmlContext | null> {
  try {
    const zip = await JSZip.loadAsync(bytes);
    const containerText = await readZipText(zip, 'META-INF/container.xml');
    if (!containerText) {
      return null;
    }

    const containerDocument = parseXml(containerText);
    if (!containerDocument) {
      return null;
    }

    const rootfileElement = firstByTagName(containerDocument, 'rootfile');
    const opfPath = normalizePath(
      rootfileElement?.getAttribute('full-path')?.trim() ?? '',
    );
    if (!opfPath) {
      return null;
    }

    const opfText = await readZipText(zip, opfPath);
    if (!opfText) {
      return null;
    }

    const opfDocument = parseXml(opfText);
    if (!opfDocument) {
      return null;
    }

    return {
      zip,
      opfPath,
      opfDocument,
    };
  } catch {
    return null;
  }
}

function ensureMetadataElement(document: XMLDocument): Element | null {
  const existing = firstByTagName(document, 'metadata');
  if (existing) {
    return existing;
  }

  const packageElement = firstByTagName(document, 'package');
  if (!packageElement) {
    return null;
  }

  const metadataElement = document.createElementNS(
    packageElement.namespaceURI,
    'metadata',
  );
  const manifestElement = firstByTagName(document, 'manifest');

  if (manifestElement?.parentNode === packageElement) {
    packageElement.insertBefore(metadataElement, manifestElement);
  } else {
    packageElement.appendChild(metadataElement);
  }

  return metadataElement;
}

function upsertMeta(
  document: XMLDocument,
  metadataElement: Element,
  name: string,
  content: string | null,
): void {
  const existing = findMetaElement(document, name);
  if (!content) {
    existing?.remove();
    return;
  }

  const metaElement =
    existing ??
    document.createElementNS(metadataElement.namespaceURI, 'meta');

  metaElement.setAttribute('name', name);
  metaElement.setAttribute('content', content);

  if (!existing) {
    metadataElement.appendChild(metaElement);
  }
}

function findMetaElement(document: XMLDocument, name: string): Element | null {
  const metaElements = document.getElementsByTagNameNS('*', 'meta');
  for (const element of Array.from(metaElements)) {
    if (element.getAttribute('name')?.trim() === name) {
      return element;
    }
  }
  return null;
}

function findMetaContent(document: XMLDocument, name: string): string | null {
  return findMetaElement(document, name)?.getAttribute('content')?.trim() ?? null;
}

async function buildZipBytes(zip: JSZip): Promise<Uint8Array> {
  const outputZip = new JSZip();
  const mimetypeValue =
    (await zip.file('mimetype')?.async('string'))?.trim() || EPUB_MIMETYPE;

  outputZip.file('mimetype', mimetypeValue, { compression: 'STORE' });

  const entryNames = Object.keys(zip.files)
    .filter((name) => name !== 'mimetype' && !zip.files[name]?.dir)
    .sort((left, right) => left.localeCompare(right));

  for (const entryName of entryNames) {
    const entry = zip.files[entryName];
    if (!entry) {
      continue;
    }

    const data = await entry.async('uint8array');
    outputZip.file(entryName, data, { compression: 'DEFLATE' });
  }

  return outputZip.generateAsync({
    type: 'uint8array',
    mimeType: EPUB_MIMETYPE,
    compression: 'DEFLATE',
    platform: 'UNIX',
  });
}

function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const entry = findZipEntry(zip, path);
  return entry ? entry.async('string') : Promise.resolve(null);
}

function findZipEntry(zip: JSZip, path: string): JSZipObject | null {
  const normalized = normalizePath(path);
  return zip.file(normalized) ?? null;
}

function parseXml(text: string): XMLDocument | null {
  try {
    const document = new DOMParser().parseFromString(text, 'application/xml');
    return document.querySelector('parsererror') ? null : document;
  } catch {
    return null;
  }
}

function firstByTagName(document: XMLDocument, tagName: string): Element | null {
  return document.getElementsByTagNameNS('*', tagName).item(0);
}

function normalizePath(path: string): string {
  const cleaned = (path || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = cleaned.split('/');
  const normalized: string[] = [];

  for (const part of parts) {
    if (!part || part === '.') {
      continue;
    }

    if (part === '..') {
      normalized.pop();
      continue;
    }

    normalized.push(part);
  }

  return normalized.join('/');
}

function normalizeColorMode(
  value: string | null | undefined,
): SheldrCoverMetadata['colorMode'] {
  if (
    value === 'color' ||
    value === 'black-white' ||
    value === 'grayscale'
  ) {
    return value;
  }
  return undefined;
}

function normalizeArtifactReductionMode(
  value: string | null | undefined,
): NonNullable<SheldrCoverMetadata['artifactReductionMode']> {
  if (
    value === 'none' ||
    value === 'bw-dither' ||
    value === 'adaptive-color' ||
    value === 'adaptive-gray'
  ) {
    return value;
  }
  return 'none';
}
