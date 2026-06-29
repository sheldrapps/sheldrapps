import { Injectable } from '@angular/core';
import JSZip, { type JSZipObject } from 'jszip';

import {
  buildEpubIssueSelectionKey,
  EpubFixerPort,
  EpubFixerPortError,
  classifyEpubDiagnosticRepairMode,
  type EpubDiagnosticIssue,
  type EpubDiagnosticIssueCode,
  type EpubDiagnosticResult,
  type EpubDiagnosticStatus,
  type EpubExportResult,
  type EpubRepairResult,
  type PrepareEpubInput,
  type PrepareEpubResult,
} from '../epub-fixer.port';

type WebSession = {
  id: string;
  file: File;
  zip: JSZip;
  originalName: string;
  originalSize: number;
  exportUrls: Set<string>;
};

type ParsedManifestItem = {
  id: string;
  href: string;
  normalizedHref: string;
  resolvedPath: string;
  exists: boolean;
  mediaType: string;
  mediaOverlay: string;
  mediaOverlayResolvedPath: string;
  mediaOverlayExists: boolean;
  element: Element;
};

type ParsedSpineItem = {
  idref: string;
  valid: boolean;
  element: Element;
};

type EpubAnalysis = {
  status: EpubDiagnosticStatus;
  issues: EpubDiagnosticIssue[];
  opfPath?: string;
  opfDir?: string;
  opfDocument?: XMLDocument;
  manifestItems: ParsedManifestItem[];
  spineItems: ParsedSpineItem[];
};

type InternalLinkInspectionResult = {
  issues: EpubDiagnosticIssue[];
  changed: boolean;
  repairedIssues: string[];
};

type InternalLinkEvaluation = {
  issues: EpubDiagnosticIssue[];
  repairedValue: string;
  changed: boolean;
  repairedIssueCodes: string[];
};

type PathResolution = {
  canonicalPath?: string;
  issueCode?: EpubDiagnosticIssueCode;
  fixable: boolean;
  options?: string[];
};

type FragmentResolution = {
  canonicalFragment?: string;
  issueCode?: EpubDiagnosticIssueCode;
  fixable: boolean;
  options?: string[];
};

const EPUB_MIMETYPE = 'application/epub+zip';
const WEB_SIZE_WARNING_BYTES = 50 * 1024 * 1024;
const BLOCKING_CODES = new Set<EpubDiagnosticIssueCode>([
  'CONTAINER_MISSING',
  'OPF_MISSING',
  'SPINE_EMPTY',
]);

@Injectable({ providedIn: 'root' })
export class WebDevEpubFixerAdapter implements EpubFixerPort {
  readonly environment = 'web-dev' as const;

  private readonly sessions = new Map<string, WebSession>();

  async prepare(input: PrepareEpubInput): Promise<PrepareEpubResult> {
    const file = input.file;
    if (!file) {
      throw new EpubFixerPortError('PREPARE_INPUT_INVALID');
    }

    if (file.size > WEB_SIZE_WARNING_BYTES) {
      // no-op
    }

    try {
      const zip = await JSZip.loadAsync(file);
      const sessionId = this.createSessionId();

      this.sessions.set(sessionId, {
        id: sessionId,
        file,
        zip,
        originalName: input.displayName || file.name,
        originalSize: file.size,
        exportUrls: new Set<string>(),
      });

      return {
        sessionId,
        originalName: input.displayName || file.name,
        originalSize: file.size,
        isZipReadable: true,
      };
    } catch (error) {
      throw new EpubFixerPortError('ZIP_UNREADABLE', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async diagnose(input: { sessionId: string }): Promise<EpubDiagnosticResult> {
    const session = this.requireSession(input.sessionId);
    const analysis = await this.analyze(session.zip);

    return {
      sessionId: input.sessionId,
      status: analysis.status,
      issues: analysis.issues,
    };
  }

  async repair(input: {
    sessionId: string;
    preferredOpfPath?: string;
    guidedSelections?: Record<string, string>;
  }): Promise<EpubRepairResult> {
    const session = this.requireSession(input.sessionId);
    const analysis = await this.analyze(
      session.zip,
      input.preferredOpfPath,
      input.guidedSelections,
    );
    const repairedIssues = new Set<string>();
    const hasMimetypeIssue = this.hasMimetypeIssue(analysis);
    const shouldRewriteContainerDocument =
      this.shouldRewriteContainerDocument(analysis);

    if (analysis.status === 'failed') {
      return {
        success: false,
        repairedIssues: [],
      };
    }

    if (analysis.status === 'unsupported') {
      return {
        success: false,
        repairedIssues: [],
      };
    }

    if (hasMimetypeIssue) {
      session.zip.file('mimetype', EPUB_MIMETYPE);
      repairedIssues.add('MIMETYPE_MISSING');
      repairedIssues.add('MIMETYPE_INVALID');
    }

    if (shouldRewriteContainerDocument && analysis.opfPath) {
      session.zip.file(
        'META-INF/container.xml',
        this.buildContainerXml(analysis.opfPath),
      );
      if (analysis.issues.some((issue) => issue.code === 'CONTAINER_MISSING')) {
        repairedIssues.add('CONTAINER_MISSING');
      }
      if (analysis.issues.some((issue) => issue.code === 'OPF_MISSING')) {
        repairedIssues.add('OPF_MISSING');
      }
    }

    if (!this.shouldRewritePackageDocument(analysis)) {
      return {
        success: repairedIssues.size > 0,
        repairedIssues: [...repairedIssues],
      };
    }

    if (!analysis.opfPath || !analysis.opfDocument) {
      return {
        success: repairedIssues.size > 0,
        repairedIssues: [...repairedIssues],
      };
    }

    await this.normalizeSafeCaseVariantResources(session.zip, analysis);

    const missingManifestItems = analysis.manifestItems.filter(
      (item) => !item.exists,
    );
    const missingMediaOverlayItems = analysis.manifestItems.filter(
      (item) => item.exists && item.mediaOverlay && !item.mediaOverlayExists,
    );
    const validManifestIds = new Set(
      analysis.manifestItems.filter((item) => item.exists).map((item) => item.id),
    );
    const validSpineItems = analysis.spineItems.filter(
      (item) => item.valid && validManifestIds.has(item.idref),
    );

    if (analysis.spineItems.length > 0 && validSpineItems.length === 0) {
      return {
        success: repairedIssues.size > 0,
        repairedIssues: [...repairedIssues],
      };
    }

    for (const item of analysis.manifestItems) {
      if (item.normalizedHref !== item.href) {
        item.element.setAttribute('href', item.normalizedHref);
      }

      if (item.exists && item.mediaOverlay && !item.mediaOverlayExists) {
        item.element.removeAttribute('media-overlay');
      }
    }

    if (missingManifestItems.length > 0) {
      for (const manifestItem of missingManifestItems) {
        manifestItem.element.parentNode?.removeChild(manifestItem.element);
      }
      repairedIssues.add('MANIFEST_ITEM_MISSING');
    }

    if (missingMediaOverlayItems.length > 0) {
      for (const manifestItem of missingMediaOverlayItems) {
        manifestItem.element.removeAttribute('media-overlay');
      }
      repairedIssues.add('SMIL_MISSING');
    }

    const invalidSpineItems = analysis.spineItems.filter(
      (item) => !item.valid || !validManifestIds.has(item.idref),
    );
    if (invalidSpineItems.length > 0) {
      for (const spineItem of invalidSpineItems) {
        spineItem.element.parentNode?.removeChild(spineItem.element);
      }
      repairedIssues.add('SPINE_ITEM_INVALID');
    }

    if (analysis.opfPath) {
      const orphanResources = this.collectOrphanResources(
        session.zip,
        analysis.manifestItems,
        analysis.opfPath,
      );
      if (orphanResources.length > 0) {
        for (const orphanResource of orphanResources) {
          session.zip.remove(orphanResource);
        }
        repairedIssues.add('ORPHAN_RESOURCE_UNUSED');
      }
    }

    for (const item of analysis.manifestItems) {
      const repairedContent = await this.tryRewriteInternalLinkContent(
        session.zip,
        item.resolvedPath,
        analysis,
        input.guidedSelections,
      );
      if (!repairedContent) {
        continue;
      }

      session.zip.file(item.resolvedPath, repairedContent.content);
      for (const issueCode of repairedContent.repairedIssues) {
        repairedIssues.add(issueCode);
      }
    }

    const xml = new XMLSerializer().serializeToString(analysis.opfDocument);
    session.zip.file(analysis.opfPath, xml);

    return {
      success: true,
      repairedIssues: [...repairedIssues],
    };
  }

  async exportFixed(input: {
    sessionId: string;
    outputName?: string;
  }): Promise<EpubExportResult> {
    const session = this.requireSession(input.sessionId);
    const blob = await this.buildExportBlob(session.zip);
    const outputUri = URL.createObjectURL(blob);

    session.exportUrls.add(outputUri);

    return {
      outputUri,
      size: blob.size,
    };
  }

  async cleanup(input: { sessionId: string }): Promise<void> {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      return;
    }

    for (const url of session.exportUrls) {
      URL.revokeObjectURL(url);
    }

    this.sessions.delete(input.sessionId);
  }

  private requireSession(sessionId: string): WebSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new EpubFixerPortError('SESSION_NOT_FOUND', { sessionId });
    }
    return session;
  }

  private async analyze(
    zip: JSZip,
    preferredOpfPath?: string,
    _guidedSelections?: Record<string, string>,
  ): Promise<EpubAnalysis> {
    const issues: EpubDiagnosticIssue[] = [];
    const mimetypeEntry = zip.file('mimetype');

    if (!mimetypeEntry) {
      issues.push(this.issue('MIMETYPE_MISSING', 'error', true));
    } else {
      const mimetypeValue = (await mimetypeEntry.async('string')).trim();
      if (mimetypeValue !== EPUB_MIMETYPE) {
        issues.push(
          this.issue('MIMETYPE_INVALID', 'error', true, mimetypeValue),
        );
      }
    }

    const containerText = await this.readZipText(zip, 'META-INF/container.xml');
    let containerIssue: EpubDiagnosticIssue | undefined;
    let declaredOpfPath: string | undefined;

    if (!containerText) {
      containerIssue = this.issue(
        'CONTAINER_MISSING',
        'error',
        false,
        'container.xml is missing',
      );
    } else {
      const containerDocument = this.parseXml(containerText);
      if (!containerDocument) {
        containerIssue = this.issue(
          'CONTAINER_MISSING',
          'error',
          false,
          'container.xml is not parseable',
        );
        declaredOpfPath = this.extractDeclaredOpfPath(containerText);
      } else {
        const rootfileElement = this.firstByTagName(containerDocument, 'rootfile');
        const opfPath = rootfileElement?.getAttribute('full-path')?.trim();
        if (!opfPath) {
          containerIssue = this.issue(
            'CONTAINER_MISSING',
            'error',
            false,
            'container.xml does not declare a rootfile',
          );
          declaredOpfPath = this.extractDeclaredOpfPath(containerText);
        } else {
          declaredOpfPath = this.normalizePath(opfPath);
        }
      }
    }

    const validOpfCandidates = await this.collectValidOpfCandidates(
      zip,
      preferredOpfPath ?? declaredOpfPath,
    );
    const opfPath = validOpfCandidates[0];
    if (!opfPath) {
      return this.finishAnalysis(issues, {
        manifestItems: [],
        spineItems: [],
        addBlocking: declaredOpfPath
          ? this.issue('OPF_MISSING', 'error', false, declaredOpfPath)
          : (containerIssue ??
              this.issue('CONTAINER_MISSING', 'error', false)),
      });
    }

    const opfText = await this.readZipText(zip, opfPath);
    if (!opfText) {
      return this.finishAnalysis(issues, {
        manifestItems: [],
        spineItems: [],
        addBlocking: this.issue('OPF_MISSING', 'error', false, opfPath),
        opfPath,
      });
    }

    const opfDocument = this.parseXml(opfText);
    if (!opfDocument) {
      return this.finishAnalysis(issues, {
        manifestItems: [],
        spineItems: [],
        addBlocking: this.issue(
          'OPF_MISSING',
          'error',
          false,
          `${opfPath} is not parseable`,
        ),
        opfPath,
      });
    }

    if (containerIssue) {
      issues.push(
        this.issue(
          containerIssue.code,
          containerIssue.severity,
          true,
          containerIssue.details,
        ),
      );
    }

    if (declaredOpfPath && declaredOpfPath !== opfPath) {
      issues.push(
        this.issue('OPF_MISSING', 'error', true, declaredOpfPath),
      );
    }

    if (validOpfCandidates.length > 1) {
      const preferredCandidate = preferredOpfPath
        ? this.normalizePath(preferredOpfPath)
        : undefined;
      if (
        !(await this.hasClearOpfWinner(zip, validOpfCandidates, preferredCandidate))
      ) {
        issues.push(
          this.issue(
            'OPF_AMBIGUOUS',
            'warning',
            true,
            'Multiple package documents were found',
            validOpfCandidates,
          ),
        );
      }
    }

    const opfDir = this.dirname(opfPath);
    const manifestElement = this.firstByTagName(opfDocument, 'manifest');
    const spineElement = this.firstByTagName(opfDocument, 'spine');
    const manifestItems = manifestElement
      ? this.parseManifestItems(zip, manifestElement, opfDir)
      : [];
    const manifestById = new Map(
      manifestItems.map((item) => [item.id, item] as const),
    );
    const spineItems = spineElement
      ? this.parseSpineItems(spineElement, manifestById)
      : [];

    for (const item of manifestItems) {
      if (!item.exists) {
        issues.push(
          this.issue(
            'MANIFEST_ITEM_MISSING',
            'warning',
            true,
            `${item.id}: ${item.resolvedPath}`,
          ),
        );
      }

      if (item.exists && item.mediaOverlay && !item.mediaOverlayExists) {
        issues.push(
          this.issue(
            'SMIL_MISSING',
            'warning',
            true,
            `${item.id}: ${item.mediaOverlayResolvedPath}`,
          ),
        );
      }
    }

    if (spineItems.length === 0) {
      issues.push(this.issue('SPINE_EMPTY', 'error', false));
    }

    for (const spineItem of spineItems) {
      if (!spineItem.valid) {
        issues.push(
          this.issue(
            'SPINE_ITEM_INVALID',
            'warning',
            true,
            spineItem.idref || 'missing idref',
          ),
        );
      }
    }

    if (
      spineItems.length > 0 &&
      spineItems.every((spineItem) => !spineItem.valid)
    ) {
      issues.push(
        this.issue(
          'SPINE_EMPTY',
          'error',
          false,
          'No valid spine entries remain',
        ),
      );
    }

    const orphanResources = this.collectOrphanResources(
      zip,
      manifestItems,
      opfPath,
    );
    for (const orphanResource of orphanResources) {
      issues.push(
        this.issue(
          'ORPHAN_RESOURCE_UNUSED',
          'warning',
          true,
          orphanResource,
        ),
      );
    }

    const internalLinkIssues = await this.collectInternalLinkIssues(
      zip,
      manifestItems,
    );
    issues.push(...internalLinkIssues);

    const status = this.resolveStatus(issues);
    return {
      status,
      issues,
      opfPath,
      opfDir,
      opfDocument,
      manifestItems,
      spineItems,
    };
  }

  private finishAnalysis(
    issues: EpubDiagnosticIssue[],
    options: {
      manifestItems: ParsedManifestItem[];
      spineItems: ParsedSpineItem[];
      addBlocking?: EpubDiagnosticIssue;
      opfPath?: string;
    },
  ): EpubAnalysis {
    if (options.addBlocking) {
      issues.push(options.addBlocking);
    }

    return {
      status: this.resolveStatus(issues),
      issues,
      opfPath: options.opfPath,
      manifestItems: options.manifestItems,
      spineItems: options.spineItems,
    };
  }

  private parseManifestItems(
    zip: JSZip,
    manifestElement: Element,
    opfDir: string,
  ): ParsedManifestItem[] {
    return Array.from(manifestElement.children)
      .filter((child) => child.localName === 'item')
      .map((element) => {
        const id = element.getAttribute('id')?.trim() ?? '';
        const href = element.getAttribute('href')?.trim() ?? '';
        const mediaType = element.getAttribute('media-type')?.trim() ?? '';
        const mediaOverlay = element.getAttribute('media-overlay')?.trim() ?? '';
        const normalizedHref = this.normalizeRelativePath(href);
        const resolvedPath = this.resolvePath(opfDir, href);
        const mediaOverlayResolvedPath = mediaOverlay
          ? this.resolvePath(opfDir, mediaOverlay)
          : '';

        return {
          id,
          href,
          normalizedHref,
          resolvedPath,
          exists: this.hasZipEntry(zip, resolvedPath),
          mediaType,
          mediaOverlay,
          mediaOverlayResolvedPath,
          mediaOverlayExists:
            !mediaOverlay || this.hasZipEntry(zip, mediaOverlayResolvedPath),
          element,
        };
      });
  }

  private parseSpineItems(
    spineElement: Element,
    manifestById: Map<string, ParsedManifestItem>,
  ): ParsedSpineItem[] {
    return Array.from(spineElement.children)
      .filter((child) => child.localName === 'itemref')
      .map((element) => {
        const idref = element.getAttribute('idref')?.trim() ?? '';
        const manifestItem = idref ? manifestById.get(idref) : undefined;
        const valid = !!manifestItem?.exists;

        return {
          idref,
          valid,
          element,
        };
      });
  }

  private async buildExportBlob(zip: JSZip): Promise<Blob> {
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
      type: 'blob',
      mimeType: EPUB_MIMETYPE,
      compression: 'DEFLATE',
      platform: 'UNIX',
    });
  }

  private shouldRewritePackageDocument(analysis: EpubAnalysis): boolean {
    return analysis.issues.some(
      (issue) =>
        issue.code !== 'MIMETYPE_MISSING' &&
        issue.code !== 'MIMETYPE_INVALID',
    );
  }

  private shouldRewriteContainerDocument(analysis: EpubAnalysis): boolean {
    return (
      !!analysis.opfPath &&
      analysis.issues.some(
        (issue) =>
          issue.code === 'CONTAINER_MISSING' || issue.code === 'OPF_MISSING',
      )
    );
  }

  private hasMimetypeIssue(analysis: EpubAnalysis): boolean {
    return analysis.issues.some(
      (issue) =>
        issue.code === 'MIMETYPE_MISSING' || issue.code === 'MIMETYPE_INVALID',
    );
  }

  private readZipText(zip: JSZip, path: string): Promise<string | null> {
    const entry = this.findZipEntry(zip, path);
    return entry ? entry.async('string') : Promise.resolve(null);
  }

  private hasZipEntry(zip: JSZip, path: string): boolean {
    return !!this.findZipEntry(zip, path);
  }

  private findZipEntry(zip: JSZip, path: string): JSZipObject | null {
    const normalized = this.normalizePath(path);
    return zip.file(normalized) ?? null;
  }

  private parseXml(text: string): XMLDocument | null {
    try {
      const document = new DOMParser().parseFromString(text, 'application/xml');
      return document.querySelector('parsererror') ? null : document;
    } catch {
      return null;
    }
  }

  private extractDeclaredOpfPath(containerText: string): string | undefined {
    const match = containerText.match(
      /<rootfile\b[^>]*\bfull-path\s*=\s*(['"])(.*?)\1/i,
    );
    const opfPath = match?.[2]?.trim();
    return opfPath ? this.normalizePath(opfPath) : undefined;
  }

  private firstByTagName(document: XMLDocument, tagName: string): Element | null {
    return document.getElementsByTagNameNS('*', tagName).item(0);
  }

  private resolveStatus(issues: EpubDiagnosticIssue[]): EpubDiagnosticStatus {
    if (issues.some((issue) => issue.code === 'ZIP_UNREADABLE')) {
      return 'failed';
    }

    if (
      issues.some(
        (issue) => BLOCKING_CODES.has(issue.code) && !issue.fixable,
      )
    ) {
      return 'unsupported';
    }

    return issues.length > 0 ? 'repairable' : 'valid';
  }

  private collectOrphanResources(
    zip: JSZip,
    manifestItems: ParsedManifestItem[],
    opfPath: string,
  ): string[] {
    const referenced = new Set(
      manifestItems.map((item) => this.normalizePath(item.resolvedPath)),
    );
    referenced.add(this.normalizePath(opfPath));
    referenced.add('mimetype');
    referenced.add('META-INF/container.xml');

    return Object.entries(zip.files)
      .filter(([, entry]) => !!entry && !entry.dir)
      .map(([name]) => this.normalizePath(name))
      .filter((name) => !!name)
      .filter((name) => !referenced.has(name))
      .filter((name) => !name.startsWith('META-INF/'))
      .sort((left, right) => left.localeCompare(right));
  }

  private async findPrimaryOpfPath(
    zip: JSZip,
    preferredPath?: string,
  ): Promise<string | null> {
    const candidates = await this.collectValidOpfCandidates(zip, preferredPath);
    return candidates[0] ?? null;
  }

  private async collectValidOpfCandidates(
    zip: JSZip,
    preferredPath?: string,
  ): Promise<string[]> {
    const candidates = this.collectOpfCandidates(zip, preferredPath);
    const validCandidates: Array<{ path: string; score: number }> = [];
    for (const candidate of candidates) {
      const opfText = await this.readZipText(zip, candidate);
      if (!opfText) {
        continue;
      }

      const opfDocument = this.parseXml(opfText);
      if (opfDocument) {
        validCandidates.push({
          path: candidate,
          score: this.scoreValidOpfCandidate(candidate, opfDocument, preferredPath),
        });
      }
    }

    validCandidates.sort(
      (left, right) => right.score - left.score || left.path.localeCompare(right.path),
    );

    return validCandidates.map((candidate) => candidate.path);
  }

  private collectOpfCandidates(zip: JSZip, preferredPath?: string): string[] {
    const candidates = new Map<string, number>();
    const addCandidate = (path?: string, score = 0): void => {
      const normalized = this.normalizePath(path || '');
      if (!normalized || candidates.has(normalized)) {
        return;
      }
      candidates.set(normalized, score);
    };

    addCandidate(preferredPath, -1);

    for (const [name, entry] of Object.entries(zip.files)) {
      if (!entry || entry.dir || !name.toLowerCase().endsWith('.opf')) {
        continue;
      }
      addCandidate(name, this.scoreOpfCandidate(name));
    }

    return [...candidates.entries()]
      .sort(
        ([leftPath, leftScore], [rightPath, rightScore]) =>
          leftScore - rightScore || leftPath.localeCompare(rightPath),
      )
      .map(([path]) => path);
  }

  private scoreOpfCandidate(path: string): number {
    const normalized = this.normalizePath(path).toLowerCase();
    if (normalized === 'oebps/content.opf' || normalized === 'ops/content.opf') {
      return 0;
    }
    if (normalized === 'content.opf') {
      return 1;
    }
    if (normalized.endsWith('/content.opf')) {
      return 2;
    }
    if (normalized.endsWith('.opf')) {
      return 3;
    }
    return 4;
  }

  private async hasClearOpfWinner(
    zip: JSZip,
    validCandidates: string[],
    preferredPath?: string,
  ): Promise<boolean> {
    if (validCandidates.length < 2) {
      return true;
    }

    const scoredCandidates: Array<{ path: string; score: number }> = [];
    for (const candidate of validCandidates) {
      const opfText = await this.readZipText(zip, candidate);
      if (!opfText) {
        continue;
      }
      const opfDocument = this.parseXml(opfText);
      if (!opfDocument) {
        continue;
      }

      scoredCandidates.push({
        path: candidate,
        score: this.scoreValidOpfCandidate(candidate, opfDocument, preferredPath),
      });
    }

    if (scoredCandidates.length < 2) {
      return true;
    }

    scoredCandidates.sort(
      (left, right) => right.score - left.score || left.path.localeCompare(right.path),
    );

    return scoredCandidates[0].score - scoredCandidates[1].score >= 3;
  }

  private scoreValidOpfCandidate(
    candidatePath: string,
    opfDocument: Document,
    preferredPath?: string,
  ): number {
    let score = (10 - this.scoreOpfCandidate(candidatePath)) * 10;
    score += this.scoreOpfDocument(opfDocument);
    if (preferredPath && this.normalizePath(preferredPath) === candidatePath) {
      score += 25;
    }
    return score;
  }

  private scoreOpfDocument(opfDocument: Document): number {
    let score = 0;
    const manifestElement = this.firstByTagName(opfDocument, 'manifest');
    const spineElement = this.firstByTagName(opfDocument, 'spine');
    const metadataElement = this.firstByTagName(opfDocument, 'metadata');

    if (manifestElement) {
      score += 2;
      if (manifestElement.getElementsByTagNameNS('*', 'item').length > 0) {
        score += 2;
      }
    }

    if (spineElement) {
      score += 2;
      if (spineElement.getElementsByTagNameNS('*', 'itemref').length > 0) {
        score += 2;
      }
    }

    if (metadataElement) {
      if (metadataElement.getElementsByTagNameNS('*', 'title').length > 0) {
        score += 1;
      }
      if (metadataElement.getElementsByTagNameNS('*', 'language').length > 0) {
        score += 1;
      }
      if (metadataElement.getElementsByTagNameNS('*', 'identifier').length > 0) {
        score += 1;
      }
    }

    if (opfDocument.documentElement) {
      score += 1;
    }

    return score;
  }

  private buildContainerXml(opfPath: string): string {
    const safeOpfPath = this.normalizePath(opfPath);
    return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${safeOpfPath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  }

  private async collectInternalLinkIssues(
    zip: JSZip,
    manifestItems: ParsedManifestItem[],
  ): Promise<EpubDiagnosticIssue[]> {
    const issues: EpubDiagnosticIssue[] = [];
    const documentIdCache = new Map<string, Set<string>>();

    for (const manifestItem of manifestItems) {
      if (!this.shouldInspectContentDocument(manifestItem)) {
        continue;
      }

      const sourceText = await this.readZipText(zip, manifestItem.resolvedPath);
      if (!sourceText) {
        continue;
      }

      const document = this.parseXml(sourceText);
      if (!document) {
        continue;
      }

      const sourceDocumentIds = await this.collectDocumentIds(
        zip,
        manifestItem.resolvedPath,
        document,
        documentIdCache,
      );
      const inspection = await this.inspectInternalLinksInDocument(
        zip,
        document,
        manifestItem.resolvedPath,
        manifestItems,
        sourceDocumentIds,
        false,
        documentIdCache,
        undefined,
      );
      issues.push(...inspection.issues);
    }

    return issues;
  }

  private async tryRewriteInternalLinkContent(
    zip: JSZip,
    entryPath: string,
    analysis: EpubAnalysis,
    guidedSelections?: Record<string, string>,
  ): Promise<{ content: string; repairedIssues: string[] } | null> {
    const manifestItem = this.findManifestItemByResolvedPath(
      analysis.manifestItems,
      entryPath,
    );
    if (manifestItem == null || !this.shouldInspectContentDocument(manifestItem)) {
      return null;
    }

    const sourceText = await this.readZipText(zip, entryPath);
    if (!sourceText) {
      return null;
    }

    const document = this.parseXml(sourceText);
    if (!document) {
      return null;
    }

    const documentIdCache = new Map<string, Set<string>>();
    const sourceDocumentIds = await this.collectDocumentIds(
      zip,
      entryPath,
      document,
      documentIdCache,
    );
    const inspection = await this.inspectInternalLinksInDocument(
      zip,
      document,
      entryPath,
      analysis.manifestItems,
      sourceDocumentIds,
      true,
      documentIdCache,
      guidedSelections,
    );

    if (!inspection.changed) {
      return null;
    }

    return {
      content: new XMLSerializer().serializeToString(document),
      repairedIssues: inspection.repairedIssues,
    };
  }

  private async inspectInternalLinksInDocument(
    zip: JSZip,
    document: XMLDocument,
    sourcePath: string,
    manifestItems: ParsedManifestItem[],
    sourceDocumentIds: Set<string>,
    applyFix: boolean,
    documentIdCache: Map<string, Set<string>>,
    guidedSelections?: Record<string, string>,
  ): Promise<InternalLinkInspectionResult> {
    const issues: EpubDiagnosticIssue[] = [];
    const repairedIssues = new Set<string>();
    if (!document || !document.documentElement) {
      return { issues, changed: false, repairedIssues: [] };
    }

    for (const element of this.collectElements(document)) {
      const attributes = element.attributes;
      for (let index = 0; index < attributes.length; index += 1) {
        const attributeNode = attributes.item(index);
        if (!attributeNode) {
          continue;
        }

        const attributeName = attributeNode.nodeName;
        const rawValue = attributeNode.nodeValue ?? '';
        if (!this.isInternalLinkAttribute(attributeName) || !rawValue.trim()) {
          continue;
        }

        const evaluation = await this.evaluateInternalLinkReference(
          zip,
          sourcePath,
          manifestItems,
          sourceDocumentIds,
          rawValue,
          documentIdCache,
          applyFix,
          guidedSelections,
        );

        if (evaluation.issues.length > 0) {
          issues.push(...evaluation.issues);
        }

        if (applyFix && evaluation.changed) {
          attributeNode.nodeValue = evaluation.repairedValue;
          for (const issueCode of evaluation.repairedIssueCodes) {
            repairedIssues.add(issueCode);
          }
        }
      }
    }

    return {
      issues,
      changed: repairedIssues.size > 0,
      repairedIssues: [...repairedIssues],
    };
  }

  private async evaluateInternalLinkReference(
    zip: JSZip,
    sourcePath: string,
    manifestItems: ParsedManifestItem[],
    sourceDocumentIds: Set<string>,
    rawValue: string,
    documentIdCache: Map<string, Set<string>>,
    applyFix: boolean,
    guidedSelections?: Record<string, string>,
  ): Promise<InternalLinkEvaluation> {
    const evaluation: InternalLinkEvaluation = {
      issues: [],
      repairedValue: rawValue,
      changed: false,
      repairedIssueCodes: [],
    };
    const parts = this.splitInternalLink(rawValue);
    if (!parts || this.looksExternalLink(parts.pathPart)) {
      return evaluation;
    }

    const sourceDir = this.dirname(sourcePath);
    let targetPath = !parts.pathPart
      ? sourcePath
      : this.resolvePath(sourceDir, parts.pathPart);
    const pathResolution = await this.resolveCanonicalInternalPath(
      zip,
      targetPath,
      manifestItems,
    );

    if (pathResolution.canonicalPath) {
      targetPath = pathResolution.canonicalPath;
      if (pathResolution.issueCode) {
        const details = this.buildLinkIssueDetails(
          sourcePath,
          rawValue,
          targetPath,
        );
        evaluation.issues.push(
          this.issue(
            pathResolution.issueCode,
            'warning',
            pathResolution.fixable,
            details,
          ),
        );
        evaluation.repairedIssueCodes.push(pathResolution.issueCode);
      }
    } else if (pathResolution.issueCode) {
      const details = pathResolution.options && pathResolution.options.length > 1
        ? this.buildAmbiguousLinkIssueDetails(sourcePath, rawValue)
        : this.buildLinkIssueDetails(sourcePath, rawValue, targetPath);
      evaluation.issues.push(
        this.issue(
          pathResolution.issueCode,
          'warning',
          pathResolution.fixable,
          details,
          pathResolution.options,
        ),
      );

      if (applyFix && pathResolution.options && pathResolution.options.length > 0) {
        const selected = this.resolveGuidedSelection(
          guidedSelections,
          pathResolution.issueCode,
          details,
          pathResolution.options,
        );
        if (selected) {
          targetPath = selected;
          evaluation.repairedIssueCodes.push(pathResolution.issueCode);
        }
      }
    }

    let canonicalFragment = parts.fragmentPart;
    if (parts.fragmentPart.trim()) {
      let targetIds = await this.collectDocumentIds(
        zip,
        targetPath,
        null,
        documentIdCache,
      );
      if (targetIds.size === 0) {
        targetIds = sourceDocumentIds;
      }

      const fragmentResolution = this.resolveCanonicalFragment(
        parts.fragmentPart,
        targetIds,
      );

      if (fragmentResolution.canonicalFragment) {
        canonicalFragment = fragmentResolution.canonicalFragment;
        if (fragmentResolution.issueCode) {
          const details = this.buildLinkIssueDetails(
            sourcePath,
            rawValue,
            `${targetPath}#${canonicalFragment}`,
          );
          evaluation.issues.push(
            this.issue(
              fragmentResolution.issueCode,
              'warning',
              fragmentResolution.fixable,
              details,
            ),
          );
          evaluation.repairedIssueCodes.push(fragmentResolution.issueCode);
        }
      } else if (fragmentResolution.issueCode) {
        const details = fragmentResolution.options && fragmentResolution.options.length > 1
          ? this.buildAmbiguousLinkIssueDetails(sourcePath, rawValue)
          : this.buildLinkIssueDetails(sourcePath, rawValue, targetPath);
        evaluation.issues.push(
          this.issue(
            fragmentResolution.issueCode,
            'warning',
            fragmentResolution.fixable,
            details,
            fragmentResolution.options,
          ),
        );

        if (
          applyFix &&
          fragmentResolution.options &&
          fragmentResolution.options.length > 0
        ) {
          const selected = this.resolveGuidedSelection(
            guidedSelections,
            fragmentResolution.issueCode,
            details,
            fragmentResolution.options,
          );
          if (selected) {
            canonicalFragment = selected;
            evaluation.repairedIssueCodes.push(fragmentResolution.issueCode);
          }
        }
      }
    }

    const repairedValue = this.buildInternalLinkValue(
      targetPath,
      parts.queryPart,
      canonicalFragment,
    );
    evaluation.repairedValue = repairedValue;
    evaluation.changed =
      applyFix &&
      this.normalizeInternalLinkValue(rawValue) !==
        this.normalizeInternalLinkValue(repairedValue);
    return evaluation;
  }

  private async collectDocumentIds(
    zip: JSZip,
    documentPath: string,
    parsedDocument: XMLDocument | null,
    documentIdCache: Map<string, Set<string>>,
  ): Promise<Set<string>> {
    const normalizedPath = this.normalizePath(documentPath);
    if (!normalizedPath) {
      return new Set<string>();
    }

    const cached = documentIdCache.get(normalizedPath);
    if (cached) {
      return cached;
    }

    let document = parsedDocument;
    if (!document) {
      const documentText = await this.readZipText(zip, normalizedPath);
      if (!documentText) {
        const empty = new Set<string>();
        documentIdCache.set(normalizedPath, empty);
        return empty;
      }

      document = this.parseXml(documentText);
      if (!document) {
        const empty = new Set<string>();
        documentIdCache.set(normalizedPath, empty);
        return empty;
      }
    }

    const ids = new Set<string>();
    const nodes = document.getElementsByTagNameNS('*', '*');
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes.item(index);
      if (!(node instanceof Element)) {
        continue;
      }

      const id = node.getAttribute('id')?.trim();
      if (id) {
        ids.add(id);
      }

      const xmlId = node.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'id')?.trim();
      if (xmlId) {
        ids.add(xmlId);
      }
    }

    documentIdCache.set(normalizedPath, ids);
    return ids;
  }

  private collectElements(document: XMLDocument): Element[] {
    const elements: Element[] = [];
    const allElements = document.getElementsByTagNameNS('*', '*');
    for (let index = 0; index < allElements.length; index += 1) {
      const node = allElements.item(index);
      if (node instanceof Element) {
        elements.push(node);
      }
    }
    return elements;
  }

  private findManifestItemByResolvedPath(
    manifestItems: ParsedManifestItem[],
    resolvedPath: string,
  ): ParsedManifestItem | null {
    const normalized = this.normalizePath(resolvedPath);
    return (
      manifestItems.find(
        (manifestItem) =>
          manifestItem != null &&
          normalized === this.normalizePath(manifestItem.resolvedPath),
      ) ?? null
    );
  }

  private shouldInspectContentDocument(manifestItem: ParsedManifestItem): boolean {
    if (manifestItem == null || !manifestItem.exists) {
      return false;
    }

    if (this.isInspectableDocumentMediaType(manifestItem.mediaType)) {
      return true;
    }

    const normalizedHref = (manifestItem.normalizedHref ?? '').toLowerCase();
    return (
      normalizedHref.endsWith('.xhtml') ||
      normalizedHref.endsWith('.html') ||
      normalizedHref.endsWith('.htm') ||
      normalizedHref.endsWith('.svg')
    );
  }

  private isInspectableDocumentMediaType(mediaType: string): boolean {
    if (!mediaType?.trim()) {
      return false;
    }

    const normalized = mediaType.trim().toLowerCase();
    return (
      normalized === 'application/xhtml+xml' ||
      normalized === 'image/svg+xml' ||
      normalized === 'text/html'
    );
  }

  private isInternalLinkAttribute(attributeName: string): boolean {
    if (!attributeName?.trim()) {
      return false;
    }

    const normalized = attributeName.trim().toLowerCase();
    return (
      normalized === 'href' ||
      normalized === 'src' ||
      normalized.endsWith(':href')
    );
  }

  private looksExternalLink(pathPart: string): boolean {
    if (!pathPart?.trim()) {
      return false;
    }

    return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(pathPart.trim());
  }

  private splitInternalLink(rawValue: string): {
    pathPart: string;
    queryPart: string;
    fragmentPart: string;
  } | null {
    const normalized = (rawValue ?? '').trim();
    if (!normalized) {
      return null;
    }

    const fragmentIndex = normalized.indexOf('#');
    const beforeFragment =
      fragmentIndex >= 0 ? normalized.slice(0, fragmentIndex) : normalized;
    const fragmentPart =
      fragmentIndex >= 0 ? normalized.slice(fragmentIndex + 1) : '';
    const queryIndex = beforeFragment.indexOf('?');
    const pathPart =
      queryIndex >= 0 ? beforeFragment.slice(0, queryIndex) : beforeFragment;
    const queryPart = queryIndex >= 0 ? beforeFragment.slice(queryIndex) : '';

    return { pathPart, queryPart, fragmentPart };
  }

  private async resolveCanonicalInternalPath(
    zip: JSZip,
    resolvedPath: string,
    manifestItems: ParsedManifestItem[],
  ): Promise<PathResolution> {
    const normalizedResolvedPath = this.normalizePath(resolvedPath);
    if (!normalizedResolvedPath) {
      return { fixable: false };
    }

    let exactMatch: string | undefined;
    const caseMatches: string[] = [];
    const unicodeMatches: string[] = [];
    const basenameMatches: string[] = [];
    const caseKey = normalizedResolvedPath.toLowerCase();
    const unicodeKey = this.normalizeUnicodeKey(normalizedResolvedPath);
    const basenameKey = this.basenameKey(normalizedResolvedPath);

    for (const manifestItem of manifestItems) {
      if (manifestItem == null || !manifestItem.exists) {
        continue;
      }

      const candidatePath = this.normalizePath(manifestItem.resolvedPath);
      if (candidatePath === normalizedResolvedPath) {
        exactMatch = candidatePath;
        break;
      }

      if (candidatePath.toLowerCase() === caseKey) {
        caseMatches.push(candidatePath);
      }

      if (this.normalizeUnicodeKey(candidatePath) === unicodeKey) {
        unicodeMatches.push(candidatePath);
      }

      if (this.basenameKey(candidatePath) === basenameKey) {
        basenameMatches.push(candidatePath);
      }
    }

    if (exactMatch) {
      return { canonicalPath: exactMatch, fixable: true };
    }

    if (caseMatches.length === 1) {
      return {
        canonicalPath: caseMatches[0],
        issueCode: 'LINK_PATH_CASE_MISMATCH',
        fixable: true,
      };
    }
    if (caseMatches.length > 1) {
      if (await this.canCanonicalizeCaseVariants(zip, caseMatches)) {
        return {
          canonicalPath: this.normalizePath(caseMatches[0]).toLowerCase(),
          issueCode: 'LINK_PATH_CASE_MISMATCH',
          fixable: true,
        };
      }

      return {
        issueCode: 'LINK_PATH_CASE_MISMATCH',
        fixable: true,
        options: this.uniqueSorted(caseMatches),
      };
    }

    if (unicodeMatches.length === 1) {
      return {
        canonicalPath: unicodeMatches[0],
        issueCode: 'LINK_PATH_UNICODE_MISMATCH',
        fixable: true,
      };
    }
    if (unicodeMatches.length > 1) {
      return {
        issueCode: 'LINK_PATH_UNICODE_MISMATCH',
        fixable: true,
        options: this.uniqueSorted(unicodeMatches),
      };
    }

    if (basenameMatches.length === 1) {
      return {
        canonicalPath: basenameMatches[0],
        issueCode: 'LINK_TARGET_MISSING',
        fixable: true,
      };
    }
    if (basenameMatches.length > 1) {
      return {
        issueCode: 'LINK_TARGET_MISSING',
        fixable: true,
        options: this.uniqueSorted(basenameMatches),
      };
    }

    return {
      issueCode: 'LINK_TARGET_MISSING',
      fixable: false,
    };
  }

  private resolveCanonicalFragment(
    fragment: string,
    ids: Set<string>,
  ): FragmentResolution {
    if (!fragment?.trim() || !ids || ids.size === 0) {
      return { fixable: false };
    }

    const trimmedFragment = fragment.trim();
    if (ids.has(trimmedFragment)) {
      return { canonicalFragment: trimmedFragment, fixable: true };
    }

    const caseKey = trimmedFragment.toLowerCase();
    const unicodeKey = this.normalizeUnicodeKey(trimmedFragment);
    const caseMatches: string[] = [];
    const unicodeMatches: string[] = [];

    for (const candidate of ids) {
      if (!candidate) {
        continue;
      }

      if (candidate.toLowerCase() === caseKey) {
        caseMatches.push(candidate);
      }

      if (this.normalizeUnicodeKey(candidate) === unicodeKey) {
        unicodeMatches.push(candidate);
      }
    }

    if (caseMatches.length === 1) {
      return {
        canonicalFragment: caseMatches[0],
        issueCode: 'LINK_FRAGMENT_MISSING',
        fixable: true,
      };
    }
    if (caseMatches.length > 1) {
      return {
        issueCode: 'LINK_FRAGMENT_MISSING',
        fixable: true,
        options: this.uniqueSorted(caseMatches),
      };
    }

    if (unicodeMatches.length === 1) {
      return {
        canonicalFragment: unicodeMatches[0],
        issueCode: 'LINK_FRAGMENT_MISSING',
        fixable: true,
      };
    }
    if (unicodeMatches.length > 1) {
      return {
        issueCode: 'LINK_FRAGMENT_MISSING',
        fixable: true,
        options: this.uniqueSorted(unicodeMatches),
      };
    }

    return {
      issueCode: 'LINK_FRAGMENT_MISSING',
      fixable: false,
    };
  }

  private buildInternalLinkValue(
    targetPath: string,
    queryPart: string,
    fragmentPart: string,
  ): string {
    const parts: string[] = [];
    if (targetPath?.trim()) {
      parts.push(this.normalizePath(targetPath));
    }
    if (queryPart?.trim()) {
      parts.push(queryPart);
    }
    if (fragmentPart?.trim()) {
      parts.push(`#${fragmentPart}`);
    }
    return parts.join('');
  }

  private normalizeInternalLinkValue(rawValue: string): string {
    const parts = this.splitInternalLink(rawValue);
    if (!parts) {
      return this.normalizePath(rawValue);
    }
    return this.buildInternalLinkValue(
      parts.pathPart,
      parts.queryPart,
      parts.fragmentPart,
    );
  }

  private buildLinkIssueDetails(
    sourcePath: string,
    rawValue: string,
    repairedValue: string,
  ): string {
    return `${this.normalizePath(sourcePath)}: ${rawValue} -> ${repairedValue}`;
  }

  private buildAmbiguousLinkIssueDetails(
    sourcePath: string,
    rawValue: string,
  ): string {
    return `${this.normalizePath(sourcePath)}: ${rawValue}`;
  }

  private resolveGuidedSelection(
    guidedSelections: Record<string, string> | undefined,
    code: EpubDiagnosticIssueCode,
    details: string,
    options: string[],
  ): string | undefined {
    if (!guidedSelections || options.length === 0) {
      return undefined;
    }

    const normalizedOptions = options.map((option) => option.trim()).filter(Boolean);
    const key = buildEpubIssueSelectionKey({
      code,
      details,
      options: normalizedOptions,
    });
    const selected = guidedSelections[key]?.trim();
    if (!selected || !normalizedOptions.includes(selected)) {
      return undefined;
    }
    return selected;
  }

  private normalizeUnicodeKey(value: string): string {
    return this.normalizePath(value)
      .normalize('NFC')
      .toLowerCase();
  }

  private basenameKey(value: string): string {
    const normalized = this.normalizePath(value).toLowerCase();
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
      (left, right) => left.localeCompare(right),
    );
  }

  private issue(
    code: EpubDiagnosticIssueCode,
    severity: 'info' | 'warning' | 'error',
    fixable: boolean,
    details?: string,
    options?: string[],
  ): EpubDiagnosticIssue {
    return {
      code,
      severity,
      fixable,
      messageKey: `FIX.ISSUE_${code}`,
      repairMode: classifyEpubDiagnosticRepairMode({
        code,
        fixable,
        options,
      }),
      details,
      options,
    };
  }

  private resolvePath(baseDir: string, relativePath: string): string {
    const [pathOnly] = relativePath.split(/[?#]/, 1);
    if (!pathOnly) {
      return this.normalizePath(baseDir);
    }

    const joined = baseDir ? `${baseDir}/${pathOnly}` : pathOnly;
    return this.normalizePath(joined);
  }

  private normalizeRelativePath(path: string): string {
    const [pathOnly] = path.split(/[?#]/, 1);
    return this.normalizePath(pathOnly);
  }

  private normalizePath(path: string): string {
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

  private async normalizeSafeCaseVariantResources(
    zip: JSZip,
    analysis: EpubAnalysis,
  ): Promise<void> {
    const groups = new Map<string, ParsedManifestItem[]>();
    for (const item of analysis.manifestItems) {
      if (!item.exists) {
        continue;
      }

      const key = this.normalizePath(item.resolvedPath).toLowerCase();
      if (!key) {
        continue;
      }

      const group = groups.get(key);
      if (group) {
        group.push(item);
      } else {
        groups.set(key, [item]);
      }
    }

    for (const group of groups.values()) {
      if (group.length < 2) {
        continue;
      }

      const candidatePaths = group.map((item) => this.normalizePath(item.resolvedPath));
      if (!(await this.canCanonicalizeCaseVariants(zip, candidatePaths))) {
        continue;
      }

      const canonicalPath = candidatePaths[0].toLowerCase();
      const canonicalEntry = await this.readZipEntryBytes(zip, candidatePaths[0]);
      if (!canonicalEntry) {
        continue;
      }

      if (!this.hasZipEntry(zip, canonicalPath)) {
        zip.file(canonicalPath, canonicalEntry);
      }

      const keeper = group[0];
      keeper.resolvedPath = canonicalPath;
      keeper.normalizedHref = canonicalPath;
      keeper.href = canonicalPath;
      keeper.element.setAttribute('href', canonicalPath);

      for (const duplicate of group.slice(1)) {
        duplicate.exists = false;
        duplicate.element.parentNode?.removeChild(duplicate.element);
        if (duplicate.resolvedPath !== canonicalPath) {
          zip.remove(duplicate.resolvedPath);
        }
      }

      if (candidatePaths[0] !== canonicalPath) {
        zip.remove(candidatePaths[0]);
      }
    }
  }

  private async canCanonicalizeCaseVariants(
    zip: JSZip,
    paths: string[],
  ): Promise<boolean> {
    if (paths.length < 2) {
      return false;
    }

    const reference = await this.readZipEntryBytes(zip, paths[0]);
    if (!reference) {
      return false;
    }

    for (let index = 1; index < paths.length; index += 1) {
      const candidate = await this.readZipEntryBytes(zip, paths[index]);
      if (!candidate || candidate.length !== reference.length) {
        return false;
      }

      for (let offset = 0; offset < reference.length; offset += 1) {
        if (candidate[offset] !== reference[offset]) {
          return false;
        }
      }
    }

    return true;
  }

  private async readZipEntryBytes(
    zip: JSZip,
    path: string,
  ): Promise<Uint8Array | null> {
    const entry = this.findZipEntry(zip, path);
    return entry ? entry.async('uint8array') : Promise.resolve(null);
  }

  private dirname(path: string): string {
    const normalized = this.normalizePath(path);
    const index = normalized.lastIndexOf('/');
    return index === -1 ? '' : normalized.slice(0, index);
  }

  private buildOutputName(originalName: string, outputName?: string): string {
    if (outputName?.trim()) {
      return this.ensureEpubExtension(outputName.trim());
    }

    const baseName = (originalName || 'book').replace(/\.epub$/i, '');
    return this.ensureEpubExtension(`${baseName}_fixed`);
  }

  private ensureEpubExtension(name: string): string {
    return /\.epub$/i.test(name) ? name : `${name}.epub`;
  }

  private createSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
