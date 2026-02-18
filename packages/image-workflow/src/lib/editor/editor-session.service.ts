import { Injectable, Optional } from '@angular/core';
import { Router } from '@angular/router';
import type { CropFormatOption, CropperResult } from '../types';

/** Panel types available in the editor */
export type ToolPanelType = "zoom" | "rotate" | "crop";
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
}

/** Editor session - passed from app to editor */
export type EditorSession = {
  file: File;

  /** Initial target dimensions */
  target: { width: number; height: number };

  /** Tools configuration (controls available panels) */
  tools?: EditorToolsConfig;

  /** Optional return url for exiting the editor */
  returnUrl?: string;

  /** Last export result (matches CropperResult shape) */
  result?: CropperResult;
};

@Injectable({ providedIn: 'root' })
export class EditorSessionService {
  private sessions = new Map<string, EditorSession>();
  private results = new Map<string, CropperResult>();
  private lastResultId: string | null = null;

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
  }

  getResult(id: string): CropperResult | null {
    return this.results.get(id) ?? null;
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
