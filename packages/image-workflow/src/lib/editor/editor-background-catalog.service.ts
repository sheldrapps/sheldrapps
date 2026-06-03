import { Injectable } from "@angular/core";
import {
  BACKGROUNDS_BASE_PATH,
  BackgroundCatalogItem,
  getBackgroundAssetPath,
} from "../types";

const BACKGROUND_CATALOG_PATH = `${BACKGROUNDS_BASE_PATH}/catalog.json`;

@Injectable({
  providedIn: "root",
})
export class EditorBackgroundCatalogService {
  private catalogPromise: Promise<BackgroundCatalogItem[]> | null = null;

  listEnabled(): Promise<BackgroundCatalogItem[]> {
    if (!this.catalogPromise) {
      this.catalogPromise = this.loadCatalog();
    }
    return this.catalogPromise;
  }

  findEnabledById(id: string): Promise<BackgroundCatalogItem | undefined> {
    const normalizedId = (id || "").trim();
    if (!normalizedId) return Promise.resolve(undefined);
    return this.listEnabled().then((items) =>
      items.find((item) => item.id === normalizedId),
    );
  }

  private async loadCatalog(): Promise<BackgroundCatalogItem[]> {
    try {
      const response = await fetch(BACKGROUND_CATALOG_PATH, {
        cache: "no-cache",
      });
      if (!response.ok) return [];
      const raw = await response.json();
      if (!Array.isArray(raw)) return [];
      return raw
        .map((item) => this.normalizeItem(item))
        .filter((item): item is BackgroundCatalogItem => !!item)
        .filter((item) => item.enabled !== false);
    } catch {
      return [];
    }
  }

  private normalizeItem(raw: unknown): BackgroundCatalogItem | null {
    if (!raw || typeof raw !== "object") return null;
    const candidate = raw as Record<string, unknown>;
    const id =
      typeof candidate["id"] === "string" ? candidate["id"].trim() : "";
    const label =
      typeof candidate["label"] === "string"
        ? candidate["label"].trim()
        : "";
    const file =
      typeof candidate["file"] === "string" ? candidate["file"].trim() : "";
    if (!id || !label || !file) return null;

    const defaultIntensity = Number.isFinite(candidate["defaultIntensity"])
      ? this.clamp(candidate["defaultIntensity"] as number, 0, 1)
      : 0.12;
    const tileSize = Number.isFinite(candidate["tileSize"])
      ? Math.max(1, Math.round(candidate["tileSize"] as number))
      : undefined;
    const enabled =
      candidate["enabled"] === undefined ? true : Boolean(candidate["enabled"]);

    return {
      id,
      label,
      file: this.normalizeBackgroundFile(file),
      defaultIntensity,
      tileSize,
      enabled,
    };
  }

  private normalizeBackgroundFile(file: string): string {
    const assetPath = getBackgroundAssetPath({ file });
    return assetPath.startsWith(`${BACKGROUNDS_BASE_PATH}/`)
      ? assetPath.slice(BACKGROUNDS_BASE_PATH.length + 1)
      : file;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
