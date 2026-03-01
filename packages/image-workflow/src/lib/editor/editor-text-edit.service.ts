import { Injectable, OnDestroy, signal, computed } from "@angular/core";
import { EditorHistoryService } from "./editor-history.service";

type KeyboardMode = "none" | "native";
const DEBUG_EDIT_DIAGNOSTICS = false;

@Injectable({ providedIn: "root" })
export class EditorTextEditService implements OnDestroy {
  readonly selectedTextId = signal<string | null>(null);
  readonly editingTextId = signal<string | null>(null);
  readonly draftContentById = signal<Record<string, string>>({});
  readonly isEditing = computed(() => this.editingTextId() !== null);
  readonly keyboardHeightPx = signal(0);
  private restoreKeyboardMode: KeyboardMode | null = null;
  private lastExitAt = 0;
  private keyboardListenerHandles: Array<{ remove: () => Promise<void> | void }> = [];

  constructor(
    private readonly history: EditorHistoryService,
  ) {
    void this.initKeyboardListeners();
  }

  ngOnDestroy(): void {
    for (const handle of this.keyboardListenerHandles) {
      try {
        void handle.remove();
      } catch {
        // ignore listener cleanup failures
      }
    }
    this.keyboardListenerHandles = [];
  }

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
    if (DEBUG_EDIT_DIAGNOSTICS) {
      console.warn("[EDIT_APPLY]", {
        id,
        selectedId: this.selectedTextId(),
        valueLength: value.length,
      });
    }
    this.history.setTextContent(id, value);
    this.exitEdit(id);
  }

  discard(): void {
    const id = this.editingTextId();
    if (!id) return;
    this.exitEdit(id);
  }

  private exitEdit(id: string): void {
    if (DEBUG_EDIT_DIAGNOSTICS) {
      console.warn("[EDIT_EXIT]", {
        id,
        selectedId: this.selectedTextId(),
      });
    }
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

  private async initKeyboardListeners(): Promise<void> {
    try {
      const cap = (globalThis as any).Capacitor;
      const platform =
        typeof cap?.getPlatform === "function" ? cap.getPlatform() : null;
      if (
        (platform !== "android" && platform !== "ios") ||
        typeof window === "undefined"
      ) {
        return;
      }
      const onShow = (event: Event) => {
        const detail = (event as CustomEvent<{ keyboardHeight?: number }>).detail;
        const nextHeight = Number(detail?.keyboardHeight);
        this.keyboardHeightPx.set(
          Number.isFinite(nextHeight) && nextHeight > 0 ? nextHeight : 0,
        );
      };
      const onHide = () => this.keyboardHeightPx.set(0);
      const addWindowListener = (
        eventName: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        window.addEventListener(eventName, listener);
        this.keyboardListenerHandles.push({
          remove: () => window.removeEventListener(eventName, listener),
        });
      };

      addWindowListener("keyboardWillShow", onShow as EventListener);
      addWindowListener("keyboardDidShow", onShow as EventListener);
      addWindowListener("keyboardWillHide", onHide as EventListener);
      addWindowListener("keyboardDidHide", onHide as EventListener);
    } catch {
      // Ignore when the optional plugin is unavailable.
    }
  }

  private async setKeyboardResizeMode(mode: KeyboardMode): Promise<void> {
    try {
      const cap = (globalThis as any).Capacitor;
      const platform =
        typeof cap?.getPlatform === "function" ? cap.getPlatform() : null;
      if (platform === "android") return;
      const Keyboard = cap?.Plugins?.Keyboard;
      const KeyboardResize = cap?.KeyboardResize;
      if (!Keyboard?.setResizeMode) return;

      if (this.restoreKeyboardMode === null) {
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
