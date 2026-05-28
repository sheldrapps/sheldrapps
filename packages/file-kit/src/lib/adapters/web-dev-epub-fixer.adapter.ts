import { Injectable } from '@angular/core';
import JSZip, { type JSZipObject } from 'jszip';

import {
  EpubFixerPort,
  EpubFixerPortError,
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

  async repair(input: { sessionId: string }): Promise<EpubRepairResult> {
    const session = this.requireSession(input.sessionId);
    const analysis = await this.analyze(session.zip);
    const repairedIssues = new Set<string>();

    if (analysis.status === 'failed' || analysis.status === 'unsupported') {
      return {
        success: false,
        repairedIssues: [],
      };
    }

    const needsMimetypeRepair = analysis.issues.some(
      (issue) =>
        issue.code === 'MIMETYPE_MISSING' || issue.code === 'MIMETYPE_INVALID',
    );
    if (needsMimetypeRepair) {
      session.zip.file('mimetype', EPUB_MIMETYPE);
      repairedIssues.add('MIMETYPE_MISSING');
      repairedIssues.add('MIMETYPE_INVALID');
    }

    if (!analysis.opfPath || !analysis.opfDocument) {
      return {
        success: repairedIssues.size > 0,
        repairedIssues: [...repairedIssues],
      };
    }

    const missingManifestItems = analysis.manifestItems.filter(
      (item) => !item.exists,
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
    }

    if (missingManifestItems.length > 0) {
      for (const manifestItem of missingManifestItems) {
        manifestItem.element.parentNode?.removeChild(manifestItem.element);
      }
      repairedIssues.add('MANIFEST_ITEM_MISSING');
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
    const outputName = this.buildOutputName(
      session.originalName,
      input.outputName,
    );

    session.exportUrls.add(outputUri);
    this.triggerDownload(outputUri, outputName);

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

  private async analyze(zip: JSZip): Promise<EpubAnalysis> {
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
    if (!containerText) {
      return this.finishAnalysis(issues, {
        manifestItems: [],
        spineItems: [],
        addBlocking: this.issue('CONTAINER_MISSING', 'error', false),
      });
    }

    const containerDocument = this.parseXml(containerText);
    if (!containerDocument) {
      return this.finishAnalysis(issues, {
        manifestItems: [],
        spineItems: [],
        addBlocking: this.issue(
          'CONTAINER_MISSING',
          'error',
          false,
          'container.xml is not parseable',
        ),
      });
    }

    const rootfileElement = this.firstByTagName(containerDocument, 'rootfile');
    const opfPath = rootfileElement?.getAttribute('full-path')?.trim();
    if (!opfPath) {
      return this.finishAnalysis(issues, {
        manifestItems: [],
        spineItems: [],
        addBlocking: this.issue(
          'OPF_MISSING',
          'error',
          false,
          'container.xml does not declare a rootfile',
        ),
      });
    }

    const normalizedOpfPath = this.normalizePath(opfPath);
    const opfText = await this.readZipText(zip, normalizedOpfPath);
    if (!opfText) {
      return this.finishAnalysis(issues, {
        manifestItems: [],
        spineItems: [],
        addBlocking: this.issue('OPF_MISSING', 'error', false, normalizedOpfPath),
        opfPath: normalizedOpfPath,
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
          `${normalizedOpfPath} is not parseable`,
        ),
        opfPath: normalizedOpfPath,
      });
    }

    const opfDir = this.dirname(normalizedOpfPath);
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

    const status = this.resolveStatus(issues);
    return {
      status,
      issues,
      opfPath: normalizedOpfPath,
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
        const normalizedHref = this.normalizeRelativePath(href);
        const resolvedPath = this.resolvePath(opfDir, href);

        return {
          id,
          href,
          normalizedHref,
          resolvedPath,
          exists: this.hasZipEntry(zip, resolvedPath),
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

  private firstByTagName(document: XMLDocument, tagName: string): Element | null {
    return document.getElementsByTagNameNS('*', tagName).item(0);
  }

  private resolveStatus(issues: EpubDiagnosticIssue[]): EpubDiagnosticStatus {
    if (issues.some((issue) => issue.code === 'ZIP_UNREADABLE')) {
      return 'failed';
    }

    if (issues.some((issue) => BLOCKING_CODES.has(issue.code))) {
      return 'unsupported';
    }

    return issues.length > 0 ? 'repairable' : 'valid';
  }

  private issue(
    code: EpubDiagnosticIssueCode,
    severity: 'info' | 'warning' | 'error',
    fixable: boolean,
    details?: string,
  ): EpubDiagnosticIssue {
    return {
      code,
      severity,
      fixable,
      messageKey: `FIX.ISSUE_${code}`,
      details,
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

  private triggerDownload(objectUrl: string, fileName: string): void {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  private createSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
