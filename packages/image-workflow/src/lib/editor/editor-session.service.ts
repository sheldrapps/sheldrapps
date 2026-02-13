import { Injectable } from '@angular/core';

/** Panel types available in the editor */
export type ToolPanelType = "zoom" | "rotate" | "crop";

/** Crop format with display aspect ratio */
export interface CropFormatOption {
  id: string;
  label: string;
  width: number;
  height: number;
}

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
};

@Injectable({ providedIn: 'root' })
export class EditorSessionService {
  private sessions = new Map<string, EditorSession>();

  createSession(session: EditorSession): string {
    const sid = this.generateSessionId();
    this.sessions.set(sid, session);
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

  private generateSessionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Simple fallback
    return `sid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
