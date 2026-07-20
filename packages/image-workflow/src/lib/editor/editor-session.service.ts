import { Injectable, Optional } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import type { EditorHistorySnapshot } from './editor-history.service';
import type { CoverCropState, CropFormatOption, CropperResult } from '../types';

/** Panel types available in the editor */
export type ToolPanelType = "zoom" | "rotate" | "crop";
export type EditorPreviewMaskShape = "rect" | "circle";
export type EditorSessionSourceMode = "image" | "scratch";
// Use CropFormatOption from types barrel

/** Kindle device model (catalog-driven) */
export interface KindleDeviceModel {
  id: string;
  i18nKey?: string;
  name?: string;
  labelKey?: string;
  width: number;
  height: number;
}

/** Kindle group (matches app catalog JSON) */
export interface KindleGroup {
  brandId?: string;
  id: string;
  i18nKey?: string;
  label?: string;
  labelKey?: string;
  items?: KindleDeviceModel[];
  models?: KindleDeviceModel[];
}

/** Tools configuration - controls which panels/tabs appear */
export interface EditorToolsConfig {
  /** Allow zoom panel */
  zoom?: boolean;

  /** Allow rotate panel */
  rotate?: boolean;

  /** Allow fill/background panel */
  fill?: boolean;

  /** Allow adjustments mode */
  adjustments?: boolean;

  /** Allow text mode */
  text?: boolean;

  /** Crop/Format selection options */
  formats?: {
    options: CropFormatOption[];
    selectedId?: string;
  };

  /** Kindle model selection (ccfk only) */
  kindle?: {
    /** Full catalog JSON (preferred) */
    modelCatalog?: KindleGroup[];
    /** Legacy alias for catalog */
    groups?: KindleGroup[];
    selectedBrandId?: string;
    selectedGroupId?: string;
    selectedModel?: KindleDeviceModel;
    onKindleModelChange?: (model: KindleDeviceModel) => void;
  };

  labels?: {
    zoomLabel?: string;
    rotateLabel?: string;
    cropLabel?: string;
    modelLabel?: string;
  };

  /** Optional one-tap optimizer for eReader exports */
  eReaderOptimization?: {
    /** Shows the optimizer control inside Adjustments */
    enabled?: boolean;
    /** Applies the eReader preset as initial state when opening editor */
    initialActive?: boolean;
  };
}

/** Editor session - passed from app to editor */
export interface ArtifactReductionInfoPreferencePort {
  hasSeen(): Promise<boolean>;
  markSeen(): Promise<void>;
}

export type EditorSession = {
  file?: File;
  sourceMode?: EditorSessionSourceMode;

  /** Initial target dimensions */
  target: { width: number; height: number };

  /** Tools configuration (controls available panels) */
  tools?: EditorToolsConfig;

  /** Optional initial editor state */
  initialState?: CoverCropState;

  /** Optional preview configuration for app-specific framing */
  preview?: {
    maskShape?: EditorPreviewMaskShape;
  };

  /** Optional output behavior for the apply action */
  output?: {
    includeRenderedBlob?: boolean;
  };

  /** Optional persisted project data for project-edit sessions. */
  project?: {
    filename?: string;
    mode?: 'overwrite' | 'copy';
    history?: EditorHistorySnapshot;
    sourceInfo?: {
      name?: string;
      width?: number;
      height?: number;
      originalName?: string;
      originalWidth?: number;
      originalHeight?: number;
    };
    returnUrl?: string;
    persist?: (result: CropperResult) => Promise<void> | void;
  };

  /** Optional return url for exiting the editor */
  returnUrl?: string;

  /** Optional editor-only preference ports provided by host apps. */
  preferences?: {
    artifactReductionInfo?: ArtifactReductionInfoPreferencePort;
  };

  /** Last export result (matches CropperResult shape) */
  result?: CropperResult;

  /** Applies the rendered result in the host before Done navigates away. */
  onResultApplied?: (result: CropperResult) => Promise<void> | void;
};

@Injectable({ providedIn: 'root' })
export class EditorSessionService {
  private sessions = new Map<string, EditorSession>();
  private results = new Map<string, CropperResult>();
  private lastResultId: string | null = null;
  private readonly resultReadySubject = new Subject<string>();
  readonly resultReady$ = this.resultReadySubject.asObservable();

  constructor(@Optional() private router?: Router) {}

  createSession(session: EditorSession): string {
    const sid = this.generateSessionId();
    const returnUrl =
      session.returnUrl ?? this.router?.url ?? this.getLocationUrl();
    this.sessions.set(sid, {
      ...session,
      returnUrl: returnUrl ?? session.returnUrl,
    });
    return sid;
  }

  getSession(id: string): EditorSession | null {
    return this.sessions.get(id) ?? null;
  }

  setResult(id: string, result: CropperResult): void {
    this.results.set(id, result);
    this.lastResultId = id;
    const session = this.sessions.get(id);
    if (session) {
      session.file = result.file;
      session.result = result;
    }
    this.resultReadySubject.next(id);
  }

  getResult(id: string): CropperResult | null {
    return this.results.get(id) ?? null;
  }

  getSessionForLatestResult(): EditorSession | null {
    if (!this.lastResultId) return null;
    return this.sessions.get(this.lastResultId) ?? null;
  }

  consumeResult(id: string): CropperResult | null {
    const result = this.results.get(id) ?? null;
    if (result) {
      this.results.delete(id);
      if (this.lastResultId === id) {
        this.lastResultId = null;
      }
      const session = this.sessions.get(id);
      if (session) {
        session.result = undefined;
      }
    }
    return result;
  }

  consumeLatestResult(): CropperResult | null {
    if (!this.lastResultId) return null;
    return this.consumeResult(this.lastResultId);
  }

  consumeSession(id: string): EditorSession | null {
    const session = this.sessions.get(id) ?? null;
    if (session) {
      this.sessions.delete(id);
    }
    return session;
  }

  clearSessions(): void {
    this.sessions.clear();
    this.results.clear();
    this.lastResultId = null;
  }

  private getLocationUrl(): string | null {
    if (typeof window === 'undefined') return null;
    const { pathname, search, hash } = window.location;
    return `${pathname}${search}${hash}`;
  }

  private generateSessionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Simple fallback
    return `sid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
