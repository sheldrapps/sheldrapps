import { Injectable, signal, computed } from "@angular/core";
import { EditorHistoryService } from "./editor-history.service";

type KeyboardMode = "none" | "native";

@Injectable({ providedIn: "root" })
export class EditorTextEditService {
  readonly selectedTextId = signal<string | null>(null);
  readonly editingTextId = signal<string | null>(null);
  readonly draftContentById = signal<Record<string, string>>({});
  readonly isEditing = computed(() => this.editingTextId() !== null);
  private restoreKeyboardMode: KeyboardMode | null = null;
  private lastExitAt = 0;

  constructor(
    private readonly history: EditorHistoryService,
  ) {}

  selectText(id: string | null): void {
    const editingId = this.editingTextId();
    if (editingId && editingId !== id) {
      this.apply();
    }
    this.selectedTextId.set(id);
  }

  enterEdit(id: string, content: string): void {
    if (!id) return;
    if (this.editingTextId() && this.editingTextId() !== id) {
      this.apply();
    }
    const value = content ?? "";
    this.selectedTextId.set(id);
    this.editingTextId.set(id);
    this.draftContentById.set({
      ...this.draftContentById(),
      [id]: value,
    });
    void this.setKeyboardResizeMode("none");
  }

  updateDraft(id: string, value: string): void {
    if (!id) return;
    this.draftContentById.set({
      ...this.draftContentById(),
      [id]: value ?? "",
    });
  }

  getDraft(id: string): string {
    if (!id) return "";
    return this.draftContentById()[id] ?? "";
  }

  apply(): void {
    const id = this.editingTextId();
    if (!id) return;
    const value = this.draftContentById()[id] ?? "";
    this.history.setTextContent(id, value);
    this.exitEdit(id);
  }

  discard(): void {
    const id = this.editingTextId();
    if (!id) return;
    this.exitEdit(id);
  }

  private exitEdit(id: string): void {
    this.editingTextId.set(null);
    const next = { ...this.draftContentById() };
    delete next[id];
    this.draftContentById.set(next);
    this.lastExitAt = Date.now();
    void this.setKeyboardResizeMode("native");
  }

  justExited(withinMs = 400): boolean {
    return Date.now() - this.lastExitAt <= withinMs;
  }

  private async setKeyboardResizeMode(mode: KeyboardMode): Promise<void> {
    try {
      const cap = (globalThis as any).Capacitor;
      const Keyboard = cap?.Plugins?.Keyboard;
      const KeyboardResize = cap?.KeyboardResize;
      if (!Keyboard || !Keyboard.setResizeMode) return;

      if (this.restoreKeyboardMode === null && Keyboard.getResizeMode) {
        try {
          const current = await Keyboard.getResizeMode();
          const existing = (current?.mode ?? "native") as string;
          this.restoreKeyboardMode =
            existing === "none" ? "none" : "native";
        } catch {
          this.restoreKeyboardMode = "native";
        }
      }

      if (mode === "native" && this.restoreKeyboardMode) {
        const target =
          this.restoreKeyboardMode === "none"
            ? KeyboardResize?.None ?? "none"
            : KeyboardResize?.Native ?? "native";
        await Keyboard.setResizeMode({ mode: target });
        return;
      }

      const next =
        mode === "none"
          ? KeyboardResize?.None ?? "none"
          : KeyboardResize?.Native ?? "native";
      await Keyboard.setResizeMode({ mode: next });
    } catch {
      // Optional: ignore when running on web or plugin not available.
    }
  }
}
