import {
  Injectable,
  signal,
  computed,
  Type,
  Injector,
  inject,
} from "@angular/core";
import { ADJUSTMENTS_REGISTRY } from "./panels/adjustments/adjustments.registry";
import { TOOLS_REGISTRY } from "./panels/tools/tools.registry";
import {
  EDITOR_PANEL_ID,
  EDITOR_PANEL_MODE,
  EDITOR_SESSION_ID,
} from "./editor-panel.tokens";
import {
  EditorSessionService,
  EditorToolsConfig,
} from "./editor-session.service";
import { EditorStateService } from "./editor-state.service";

export type EditorMode = "none" | "tools" | "adjustments";
export type PanelMode = "tools" | "adjustments" | null;
export type GestureMode = "none" | "pan" | "pinch" | "pan+pinch";
export type ToolKey = "crop" | "rotate" | "zoom";
export type AdjustmentKey =
  | "brightness"
  | "contrast"
  | "saturation"
  | "bw"
  | "dither";

export interface PanelState {
  mode: PanelMode;
  panelId: string | null;
}

export interface PanelConfig {
  title: string;
  canReset: boolean;
  showGrabber: boolean;
  component: Type<any> | null;
  reset?: (state: EditorStateService) => void;
}

@Injectable({
  providedIn: "root",
})
export class EditorUiStateService {
  private readonly injector = inject(Injector);
  private readonly editorSession = inject(EditorSessionService, {
    optional: true,
  });

  readonly activeMode = signal<EditorMode>("none");
  readonly gestureMode = signal<GestureMode>("none");
  readonly activeTool = signal<ToolKey>("crop");
  readonly activeAdjustment = signal<AdjustmentKey>("brightness");
  readonly toolsConfig = signal<EditorToolsConfig | null>(null);
  readonly sessionId = signal<string>("");

  // Panel state
  private readonly panelState = signal<PanelState>({
    mode: null,
    panelId: null,
  });

  // Public readonly signals
  readonly panelMode = computed(() => this.panelState().mode);
  readonly panelId = computed(() => this.panelState().panelId);
  readonly isPanelOpen = computed(() => this.panelState().mode !== null);

  // Panel config computed
  private readonly panelConfig = computed((): PanelConfig => {
    const state = this.panelState();
    const id = state.panelId;
    const mode = state.mode;

    if (!id || !mode) {
      return {
        title: "",
        canReset: false,
        showGrabber: true,
        component: null,
      };
    }

    // Look up config from registries based on mode
    let registryConfig:
      | {
          title: string;
          canReset: boolean;
          showGrabber: boolean;
          component: Type<any>;
          reset?: (state: EditorStateService) => void;
        }
      | undefined;

    if (mode === "adjustments") {
      registryConfig = ADJUSTMENTS_REGISTRY[id as AdjustmentKey];
    } else if (mode === "tools") {
      registryConfig = TOOLS_REGISTRY[id as ToolKey];
    }

    if (registryConfig) {
      return {
        title: registryConfig.title,
        canReset: registryConfig.canReset,
        showGrabber: registryConfig.showGrabber,
        component: registryConfig.component,
        reset: registryConfig.reset,
      };
    }

    // Fallback if not found in registries
    return {
      title: id,
      canReset: false,
      showGrabber: true,
      component: null,
      reset: undefined,
    };
  });

  readonly panelTitle = computed(() => this.panelConfig().title);
  readonly canReset = computed(() => this.panelConfig().canReset);
  readonly showGrabber = computed(() => this.panelConfig().showGrabber);
  readonly activePanelComponent = computed(() => this.panelConfig().component);
  readonly activePanelReset = computed(() => this.panelConfig().reset);

  readonly activePanelInjector = computed<Injector | undefined>(() => {
    const state = this.panelState();
    const panelId = state.panelId;
    const mode = state.mode;
    const sid = this.sessionId();

    if (!panelId || !mode) {
      return undefined;
    }

    const providers = [
      { provide: EDITOR_PANEL_ID, useValue: panelId },
      { provide: EDITOR_PANEL_MODE, useValue: mode },
      ...(sid ? [{ provide: EDITOR_SESSION_ID, useValue: sid }] : []),
      ...(this.editorSession
        ? [{ provide: EditorSessionService, useValue: this.editorSession }]
        : []),
    ];

    return Injector.create({
      providers,
      parent: this.injector,
    });
  });

  setMode(mode: EditorMode): void {
    this.activeMode.set(mode);

    // Set sensible default gestureMode based on mode
    switch (mode) {
      case "tools":
        this.gestureMode.set("pan+pinch");
        break;
      case "adjustments":
        this.gestureMode.set("none");
        break;
      default:
        this.gestureMode.set("none");
    }
  }

  setTool(key: ToolKey): void {
    this.activeTool.set(key);
  }

  setAdjustment(key: AdjustmentKey): void {
    this.activeAdjustment.set(key);
  }

  // Panel helpers
  openPanel(mode: PanelMode, panelId: string): void {
    if (!mode) return;
    this.panelState.set({ mode, panelId });
  }

  closePanel(): void {
    this.panelState.set({ mode: null, panelId: null });
  }

  setPanel(panelId: string): void {
    const current = this.panelState();
    if (current.mode) {
      this.panelState.set({ ...current, panelId });
    }
  }

  togglePanel(mode: PanelMode, panelId: string): void {
    const current = this.panelState();

    // If clicking the same mode and panel, close it
    if (current.mode === mode && current.panelId === panelId) {
      this.closePanel();
      return;
    }

    // Otherwise, open/switch to the new panel
    if (mode) {
      this.openPanel(mode, panelId);
    }
  }

  setToolsConfig(config: EditorToolsConfig | null): void {
    this.toolsConfig.set(config);
  }

  setSessionId(id: string): void {
    this.sessionId.set(id);
  }
}
