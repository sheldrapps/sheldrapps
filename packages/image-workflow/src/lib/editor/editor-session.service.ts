import { Injectable, Optional } from '@angular/core';
import { Router } from '@angular/router';

/** Panel types available in the editor */
export type ToolPanelType = "zoom" | "rotate" | "crop";


// Use CropFormatOption from types barrel
import type { CropFormatOption } from '../types';

/** Kindle device model */
export interface KindleDeviceModel {
  id: string;
  name: string;
  width: number;
  height: number;
}

/** Kindle group (e.g., "Paperwhite", "Voyage") */
export interface KindleGroup {
  id: string;
  label: string;
  models: KindleDeviceModel[];
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
    groups: KindleGroup[];
    selectedGroupId?: string;
    selectedModel?: KindleDeviceModel;
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
};

@Injectable({ providedIn: 'root' })
export class EditorSessionService {
  private sessions = new Map<string, EditorSession>();

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
