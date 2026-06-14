import { Injectable, computed, signal } from "@angular/core";
import { EditorStateService } from "./editor-state.service";
import {
  EditorKindleStateService,
  type KindleSelectionSnapshot,
} from "./editor-kindle-state.service";
import { DEFAULT_EDITOR_ADJUSTMENTS } from "./editor-adjustments";
import type {
  BackgroundMode,
  BackgroundSource,
  CleanupStrength,
  DitheringMode,
  FitBackgroundConfig,
} from "../types";
import {
  isArtifactReductionEnabled,
  isDitheringEnabled,
} from "../core/pipeline";
import { EREADER_OPTIMIZE_PRESET } from "./editor-adjustment-presets";

export type HistoryMode = "local" | "global";
export type PanelScope = "tools" | "adjustments" | "text";

export interface EditorCommand {
  type: string;
  payload: any;
}

type EditorSnapshot = ReturnType<EditorStateService["getState"]>;
type HistoryBlock = { commands: EditorCommand[] };
export type EditorHistorySnapshot = {
  baseState: EditorSnapshot;
  globalStack: HistoryBlock[];
  globalRedoStack: HistoryBlock[];
};

const MAX_LOCAL_COMMANDS = 10;
const SLIDER_STEP = 0.01;
const FLOAT_PRECISION = 3;

type NormalizedAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  eReaderOptimizationEnabled: boolean;
  bw: boolean;
  cleanupEnabled: boolean;
  cleanupStrength: string;
  smoothGradients: boolean;
  preserveDetails: boolean;
  ditheringEnabled: boolean;
  ditheringMode: string;
};

type EReaderOptimizationBaseline = {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
};

type NormalizedTransform = {
  scale: number;
  tx: number;
  ty: number;
  rot: number;
  flipX: boolean;
  flipY: boolean;
  bw: boolean;
  cleanupEnabled: boolean;
  cleanupStrength: string;
  smoothGradients: boolean;
  preserveDetails: boolean;
  ditheringEnabled: boolean;
  ditheringMode: string;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  backgroundSource: BackgroundSource | null;
  backgroundBlur: number;
  backgroundPatternId: string | null;
  backgroundPatternFile: string | null;
  backgroundPatternIntensity: number;
  backgroundPatternScale: number;
  backgroundPatternOffsetX: number;
  backgroundPatternOffsetY: number;
};

type NormalizedTextLayer = {
  id: string;
  content: string;
  x: number;
  y: number;
  fontFamily: string;
  fontSizePx: number;
  manualFontSizePx: number;
  fillColor: string;
  strokeColor: string;
  strokeWidthPx: number;
  maxWidthPx: number | null;
  boxWidthPx: number | null;
  boxHeightPx: number | null;
  userBoxTouched: boolean;
};

type NormalizedTextLayers = NormalizedTextLayer[];

@Injectable({
  providedIn: "root",
})
export class EditorHistoryService {
  readonly mode = signal<HistoryMode>("global");
  private readonly panelScope = signal<PanelScope | null>(null);
  private readonly baselineSnapshot = signal<EditorSnapshot | null>(null);
  private readonly baselineKindleSnapshot =
    signal<KindleSelectionSnapshot | null>(null);

  private readonly localCommands = signal<EditorCommand[]>([]);
  private readonly localPointer = signal(0);
  private readonly globalStack = signal<HistoryBlock[]>([]);
  private readonly globalRedoStack = signal<HistoryBlock[]>([]);

  private initialSnapshot: EditorSnapshot | null = null;
  private isReplaying = false;

  private sliderActive = false;
  private pendingSliderCommand: EditorCommand | null = null;
  private eReaderOptimizationBaseline: EReaderOptimizationBaseline | null = null;
  private eReaderOptimizationMutation = false;

  private gestureActive = false;
  private gestureStart: { scale: number; tx: number; ty: number } | null = null;
  private textDragActiveId: string | null = null;
  private textDragStart: EditorSnapshot["textLayers"] | null = null;

  constructor(
    private readonly editorState: EditorStateService,
    private readonly kindleState: EditorKindleStateService,
  ) {}

  // Pass-through signals (read-only for UI)
  readonly scale = this.editorState.scale;
  readonly tx = this.editorState.tx;
  readonly ty = this.editorState.ty;
  readonly rot = this.editorState.rot;
  readonly flipX = this.editorState.flipX;
  readonly flipY = this.editorState.flipY;
  readonly brightness = this.editorState.brightness;
  readonly saturation = this.editorState.saturation;
  readonly contrast = this.editorState.contrast;
  readonly sharpness = this.editorState.sharpness;
  readonly eReaderOptimizationEnabled = this.editorState.eReaderOptimizationEnabled;
  readonly bw = this.editorState.bw;
  readonly dither = this.editorState.dither;
  readonly artifactReductionEnabled = this.editorState.artifactReductionEnabled;
  readonly cleanupEnabled = this.editorState.cleanupEnabled;
  readonly cleanupArtifactReduction = this.editorState.cleanupArtifactReduction;
  readonly smoothGradients = this.editorState.smoothGradients;
  readonly preserveDetails = this.editorState.preserveDetails;
  readonly ditheringEnabled = this.editorState.ditheringEnabled;
  readonly ditheringMode = this.editorState.ditheringMode;
  readonly backgroundMode = this.editorState.backgroundMode;
  readonly backgroundColor = this.editorState.backgroundColor;
  readonly backgroundSource = this.editorState.backgroundSource;
  readonly backgroundBlur = this.editorState.backgroundBlur;
  readonly backgroundPattern = this.editorState.backgroundPattern;
  readonly adjustments = this.editorState.adjustments;
  readonly isAdjusting = this.editorState.isAdjusting;
  readonly textLayers = this.editorState.textLayers;

  readonly isDirty = computed(() => {
    if (this.mode() !== "local") return false;
    const scope = this.panelScope();
    const baseline = this.baselineSnapshot();
    if (!scope || !baseline) return false;

    const current = this.editorState.getState();
    if (scope === "tools") {
      const a = this.normalizeTransform(baseline);
      const b = this.normalizeTransform(current);
      const transformDirty = !this.shallowEqual(a, b);

      const baselineKindle = this.baselineKindleSnapshot();
      const currentKindle = this.kindleState.captureSnapshot();
      const ka = this.normalizeKindleSnapshot(baselineKindle);
      const kb = this.normalizeKindleSnapshot(currentKindle);
      const kindleDirty = !this.shallowEqual(ka, kb);

      return transformDirty || kindleDirty;
    }

    if (scope === "text") {
      const a = this.normalizeTextLayers(baseline);
      const b = this.normalizeTextLayers(current);
      return !this.textLayersEqual(a, b);
    }

    const a = this.normalizeAdjustments(baseline);
    const b = this.normalizeAdjustments(current);
    return !this.shallowEqual(a, b);
  });

  readonly canUndo = computed(() => {
    if (this.mode() === "local") {
      const min = this.localMinPointer();
      return this.isDirty() && this.localPointer() > min;
    }
    return this.globalStack().length > 0;
  });

  readonly canRedo = computed(() => {
    if (this.mode() === "local") {
      return this.localPointer() < this.localCommands().length;
    }
    return this.globalRedoStack().length > 0;
  });

  readonly canApplyPanel = computed(() => {
    if (this.mode() !== "local") return false;
    if (this.isDirty()) return true;
    return this.panelScope() === "tools";
  });

  captureProjectSnapshot(): EditorHistorySnapshot {
    return {
      baseState: this.cloneSnapshot(
        this.initialSnapshot ?? this.editorState.getState(),
      ),
      globalStack: this.cloneHistoryBlocks(this.globalStack()),
      globalRedoStack: this.cloneHistoryBlocks(this.globalRedoStack()),
    };
  }

  restoreProjectSnapshot(snapshot: EditorHistorySnapshot): void {
    const baseState = this.cloneSnapshot(snapshot.baseState);
    this.replay(() => {
      this.editorState.setState(baseState);
    });
    this.initialSnapshot = baseState;
    this.globalStack.set(this.cloneHistoryBlocks(snapshot.globalStack));
    this.globalRedoStack.set(this.cloneHistoryBlocks(snapshot.globalRedoStack));
    this.localCommands.set([]);
    this.localPointer.set(0);
    this.baselineSnapshot.set(null);
    this.baselineKindleSnapshot.set(null);
    this.panelScope.set(null);
    this.mode.set("global");
    this.sliderActive = false;
    this.pendingSliderCommand = null;
    this.gestureActive = false;
    this.gestureStart = null;
    this.textDragActiveId = null;
    this.textDragStart = null;
    this.eReaderOptimizationBaseline = null;
    this.eReaderOptimizationMutation = false;
    this.recomposeGlobal();
  }

  startSession(): void {
    this.initialSnapshot = this.editorState.getState();
    this.localCommands.set([]);
    this.localPointer.set(0);
    this.globalStack.set([]);
    this.globalRedoStack.set([]);
    this.baselineSnapshot.set(null);
    this.baselineKindleSnapshot.set(null);
    this.panelScope.set(null);
    this.mode.set("global");
    this.eReaderOptimizationBaseline = null;
    this.eReaderOptimizationMutation = false;
  }

  resetSession(): void {
    if (!this.initialSnapshot) {
      this.initialSnapshot = this.editorState.getState();
    }
    this.replay(() => {
      this.editorState.setState(this.initialSnapshot!);
    });
    this.localCommands.set([]);
    this.localPointer.set(0);
    this.globalStack.set([]);
    this.globalRedoStack.set([]);
    this.baselineSnapshot.set(null);
    this.baselineKindleSnapshot.set(null);
    this.panelScope.set(null);
    this.mode.set("global");
    this.eReaderOptimizationBaseline = null;
    this.eReaderOptimizationMutation = false;
  }

  enterPanel(scope: PanelScope): void {
    if (this.mode() === "local" && this.panelScope() === scope) return;
    if (this.mode() === "local" && this.isDirty()) {
      console.warn("[editor-history] Attempted panel switch while dirty.");
      return;
    }

    this.panelScope.set(scope);
    this.mode.set("local");
    this.localCommands.set([]);
    this.localPointer.set(0);
    this.baselineSnapshot.set(this.editorState.getState());
    this.baselineKindleSnapshot.set(
      scope === "tools" ? this.kindleState.captureSnapshot() : null,
    );
    this.sliderActive = false;
    this.pendingSliderCommand = null;
    this.gestureActive = false;
    this.gestureStart = null;
    this.textDragActiveId = null;
    this.textDragStart = null;
  }

  exitPanel(): void {
    this.mode.set("global");
    this.panelScope.set(null);
    this.localCommands.set([]);
    this.localPointer.set(0);
    this.baselineSnapshot.set(null);
    this.baselineKindleSnapshot.set(null);
    this.sliderActive = false;
    this.pendingSliderCommand = null;
    this.gestureActive = false;
    this.gestureStart = null;
    this.textDragActiveId = null;
    this.textDragStart = null;
  }

  applyPanel(): boolean {
    if (this.mode() !== "local") return false;
    if (!this.canApplyPanel()) return false;

    this.flushPending();

    const commands = this.localCommands().slice(0, this.localPointer());
    const globalCommands = commands.filter(
      (cmd) => cmd.type !== "ChangeKindleModel",
    );

    if (globalCommands.length) {
      const nextBlocks = [...this.globalStack(), { commands: globalCommands }];
      this.globalStack.set(nextBlocks);
      this.globalRedoStack.set([]);
    }

    this.finalizePanelApply();
    return true;
  }

  discardPanel(): boolean {
    if (this.mode() !== "local") return false;

    this.flushPending();

    const baseline = this.baselineSnapshot();
    if (baseline) {
      this.replay(() => {
        this.editorState.setState(baseline);
      });
    }
    const kindleBaseline = this.baselineKindleSnapshot();
    if (kindleBaseline) {
      this.kindleState.restoreSnapshot(kindleBaseline, { silent: false });
    }

    this.localCommands.set([]);
    this.localPointer.set(0);
    this.baselineSnapshot.set(null);
    this.baselineKindleSnapshot.set(null);
    this.panelScope.set(null);
    this.mode.set("global");
    this.textDragActiveId = null;
    this.textDragStart = null;
    this.syncEReaderOptimizationBaselineFromState();
    return true;
  }

  private finalizePanelApply(): void {
    this.localCommands.set([]);
    this.localPointer.set(0);
    this.baselineSnapshot.set(null);
    this.baselineKindleSnapshot.set(null);
    this.panelScope.set(null);
    this.mode.set("global");
    this.textDragActiveId = null;
    this.textDragStart = null;
  }

  undo(): void {
    if (this.mode() === "local") {
      this.undoLocal();
      return;
    }
    this.undoGlobal();
  }

  redo(): void {
    if (this.mode() === "local") {
      this.redoLocal();
      return;
    }
    this.redoGlobal();
  }

  onSliderStart(): void {
    this.sliderActive = true;
    this.pendingSliderCommand = null;
    this.editorState.onSliderStart();
  }

  onSliderEnd(): void {
    this.editorState.onSliderEnd();
    if (!this.sliderActive) return;
    this.sliderActive = false;
    if (this.pendingSliderCommand) {
      this.recordCommand(this.pendingSliderCommand);
    }
    this.pendingSliderCommand = null;
  }

  onGestureStart(): void {
    if (this.gestureActive) return;
    this.gestureActive = true;
    this.gestureStart = this.captureViewport();
    this.editorState.onGestureStart();
  }

  onGestureEnd(): void {
    this.editorState.onGestureEnd();
    if (!this.gestureActive) return;
    this.gestureActive = false;

    const start = this.gestureStart;
    this.gestureStart = null;
    if (!start) return;

    const next = this.captureViewport();
    if (
      start.scale === next.scale &&
      start.tx === next.tx &&
      start.ty === next.ty
    ) {
      return;
    }

    this.recordCommand({
      type: "SetViewport",
      payload: next,
    });
  }

  onTextDragStart(id: string): void {
    if (this.textDragActiveId) return;
    this.textDragActiveId = id;
    const current = this.editorState.textLayers();
    this.textDragStart = current.map((layer) => ({ ...layer }));
  }

  onTextDragEnd(id: string): void {
    if (!this.textDragActiveId || this.textDragActiveId !== id) return;
    this.textDragActiveId = null;

    const start = this.textDragStart;
    this.textDragStart = null;
    if (!start) return;

    const next = this.editorState.textLayers();
    const changed = !this.textLayersEqual(
      this.normalizeTextLayers(start),
      this.normalizeTextLayers(next),
    );
    if (!changed) return;

    this.recordCommand({
      type: "SetTextLayers",
      payload: next.map((layer) => ({ ...layer })),
    });
  }

  setBrightness(value: number): void {
    const prev = this.editorState.brightness();
    this.editorState.setBrightness(value);
    const next = this.editorState.brightness();
    if (prev === next) return;
    const disabledOptimization =
      this.maybeAutoDisableEReaderOptimizationOnManualAdjustment();
    const command = {
      type: "SetBrightness",
      payload: {
        value: next,
        eReaderOptimizationEnabled: disabledOptimization ? false : undefined,
      },
    };
    if (this.sliderActive) {
      this.pendingSliderCommand = command;
      return;
    }
    this.recordCommand(command);
  }

  setSaturation(value: number): void {
    const prev = this.editorState.saturation();
    this.editorState.setSaturation(value);
    const next = this.editorState.saturation();
    if (prev === next) return;
    const disabledOptimization =
      this.maybeAutoDisableEReaderOptimizationOnManualAdjustment();
    const command = {
      type: "SetSaturation",
      payload: {
        value: next,
        eReaderOptimizationEnabled: disabledOptimization ? false : undefined,
      },
    };
    if (this.sliderActive) {
      this.pendingSliderCommand = command;
      return;
    }
    this.recordCommand(command);
  }

  setContrast(value: number): void {
    const prev = this.editorState.contrast();
    this.editorState.setContrast(value);
    const next = this.editorState.contrast();
    if (prev === next) return;
    const disabledOptimization =
      this.maybeAutoDisableEReaderOptimizationOnManualAdjustment();
    const command = {
      type: "SetContrast",
      payload: {
        value: next,
        eReaderOptimizationEnabled: disabledOptimization ? false : undefined,
      },
    };
    if (this.sliderActive) {
      this.pendingSliderCommand = command;
      return;
    }
    this.recordCommand(command);
  }

  setSharpness(value: number): void {
    const prev = this.editorState.sharpness();
    this.editorState.setSharpness(value);
    const next = this.editorState.sharpness();
    if (prev === next) return;
    const disabledOptimization =
      this.maybeAutoDisableEReaderOptimizationOnManualAdjustment();
    const command = {
      type: "SetSharpness",
      payload: {
        value: next,
        eReaderOptimizationEnabled: disabledOptimization ? false : undefined,
      },
    };
    if (this.sliderActive) {
      this.pendingSliderCommand = command;
      return;
    }
    this.recordCommand(command);
  }

  setBw(value: boolean): void {
    const prev = this.editorState.bw();
    this.editorState.setBw(value);
    const next = this.editorState.bw();
    if (prev === next) return;
    this.recordCommand({ type: "SetBw", payload: { value: next } });
  }

  setEReaderOptimizationEnabled(value: boolean): void {
    const prev = this.editorState.eReaderOptimizationEnabled();
    this.editorState.setEReaderOptimizationEnabled(value);
    const next = this.editorState.eReaderOptimizationEnabled();
    if (prev === next) return;
    this.recordCommand({
      type: "SetEReaderOptimizationEnabled",
      payload: { value: next },
    });
    this.syncEReaderOptimizationBaselineFromState();
  }

  toggleEReaderOptimization(value: boolean): void {
    const current = this.editorState.eReaderOptimizationEnabled();
    if (value) {
      if (current) {
        return;
      }
      this.applyEReaderOptimizationPreset();
      return;
    }
    this.disableEReaderOptimizationAndRestoreBaseline();
  }

  applyEReaderOptimizationPreset(): void {
    this.setEReaderOptimizationState({
      brightness: EREADER_OPTIMIZE_PRESET.brightness,
      contrast: EREADER_OPTIMIZE_PRESET.contrast,
      saturation: EREADER_OPTIMIZE_PRESET.saturation,
      sharpness: EREADER_OPTIMIZE_PRESET.sharpness,
      eReaderOptimizationEnabled: true,
    });
  }

  setEReaderOptimizationState(nextState: {
    brightness: number;
    contrast: number;
    saturation: number;
    sharpness: number;
    eReaderOptimizationEnabled: boolean;
  }): void {
    const before = this.captureEReaderOptimizationState();
    const wasEnabled = before.eReaderOptimizationEnabled;

    if (nextState.eReaderOptimizationEnabled && !wasEnabled) {
      this.eReaderOptimizationBaseline = this.captureCurrentAdjustmentBaseline();
    }

    this.eReaderOptimizationMutation = true;
    try {
      this.editorState.setBrightness(nextState.brightness);
      this.editorState.setContrast(nextState.contrast);
      this.editorState.setSaturation(nextState.saturation);
      this.editorState.setSharpness(nextState.sharpness);
      this.editorState.setEReaderOptimizationEnabled(
        nextState.eReaderOptimizationEnabled,
      );
    } finally {
      this.eReaderOptimizationMutation = false;
    }

    const after = this.captureEReaderOptimizationState();
    if (this.eReaderOptimizationStateEqual(before, after)) return;

    this.recordCommand({
      type: "ApplyEReaderOptimizationPreset",
      payload: { ...after },
    });
    this.syncEReaderOptimizationBaselineFromState();
  }

  setDither(value: boolean): void {
    this.setDitheringEnabled(value);
  }

  setArtifactReductionEnabled(value: boolean): void {
    const prev = this.editorState.cleanupEnabled();
    this.editorState.setArtifactReductionEnabled(value);
    const next = this.editorState.cleanupEnabled();
    if (prev === next) return;
    this.recordCommand({
      type: "SetCleanupEnabled",
      payload: { value: next },
    });
  }

  setCleanupArtifactReduction(value: CleanupStrength): void {
    const prev = this.editorState.cleanupArtifactReduction();
    this.editorState.setCleanupArtifactReduction(value);
    const next = this.editorState.cleanupArtifactReduction();
    if (prev === next) return;
    this.recordCommand({
      type: "SetCleanupArtifactReduction",
      payload: { value: next },
    });
  }

  setSmoothGradients(value: boolean): void {
    const prev = this.editorState.smoothGradients();
    this.editorState.setSmoothGradients(value);
    const next = this.editorState.smoothGradients();
    if (prev === next) return;
    this.recordCommand({
      type: "SetSmoothGradients",
      payload: { value: next },
    });
  }

  setPreserveDetails(value: boolean): void {
    const prev = this.editorState.preserveDetails();
    this.editorState.setPreserveDetails(value);
    const next = this.editorState.preserveDetails();
    if (prev === next) return;
    this.recordCommand({
      type: "SetPreserveDetails",
      payload: { value: next },
    });
  }

  setDitheringEnabled(value: boolean): void {
    const prev = this.editorState.ditheringEnabled();
    this.editorState.setDitheringEnabled(value);
    const next = this.editorState.ditheringEnabled();
    if (prev === next) return;
    this.recordCommand({
      type: "SetDitheringEnabled",
      payload: { value: next },
    });
  }

  setDitheringMode(value: DitheringMode): void {
    const prev = this.editorState.ditheringMode();
    this.editorState.setDitheringMode(value);
    const next = this.editorState.ditheringMode();
    if (prev === next) return;
    this.recordCommand({
      type: "SetDitheringMode",
      payload: { value: next },
    });
  }

  setBackgroundMode(mode: BackgroundMode): void {
    const prev = this.captureBackgroundPolicy();
    this.editorState.setBackgroundMode(mode);
    const nextBackground = this.captureBackground();
    const next = this.applyFillPolicy(nextBackground);
    if (this.backgroundPolicyEqual(prev, next)) return;
    this.recordCommand({
      type: "CHANGE_BACKGROUND",
      payload: next,
    });
  }

  setBackgroundColor(color: string): void {
    const prev = this.captureBackgroundPolicy();
    this.editorState.setBackgroundColor(color);
    const nextBackground = this.captureBackground();
    const next = this.applyFillPolicy(nextBackground);
    if (this.backgroundPolicyEqual(prev, next)) return;
    this.recordCommand({
      type: "CHANGE_BACKGROUND",
      payload: next,
    });
  }

  setBackground(opts: {
    mode?: BackgroundMode;
    color?: string;
    source?: BackgroundSource;
    blur?: number;
    background?: FitBackgroundConfig;
  }): void {
    const prev = this.captureBackgroundPolicy();
    this.editorState.setBackground(opts);
    const nextBackground = this.captureBackground();
    const next = this.applyFillPolicy(nextBackground);
    if (this.backgroundPolicyEqual(prev, next)) return;
    this.recordCommand({
      type: "CHANGE_BACKGROUND",
      payload: next,
    });
  }

  setBackgroundBlur(value: number): void {
    const prev = this.captureBackgroundPolicy();
    this.editorState.setBackground({
      mode: "blur",
      source: "same-image",
      blur: value,
    });
    const nextBackground = this.captureBackground();
    const next = this.applyFillPolicy(nextBackground);
    if (this.backgroundPolicyEqual(prev, next)) return;
    const command = {
      type: "CHANGE_BACKGROUND",
      payload: next,
    };
    if (this.sliderActive) {
      this.pendingSliderCommand = command;
      return;
    }
    this.recordCommand(command);
  }

  setTextLayers(layers: EditorSnapshot["textLayers"]): void {
    const prev = this.editorState.textLayers();
    const next = (layers ?? []).map((layer) => ({ ...layer }));
    if (
      this.textLayersEqual(
        this.normalizeTextLayers(prev),
        this.normalizeTextLayers(next),
      )
    ) {
      return;
    }
    this.editorState.setTextLayers(next);
    this.recordCommand({
      type: "SetTextLayers",
      payload: next,
    });
  }

  addTextLayer(layer: NonNullable<EditorSnapshot["textLayers"]>[number]): void {
    const next = [
      ...this.editorState.textLayers(),
      {
        ...layer,
        manualFontSizePx: layer.manualFontSizePx ?? layer.fontSizePx,
        userBoxTouched: layer.userBoxTouched ?? false,
      },
    ];
    this.setTextLayers(next);
  }

  setTextContent(id: string, value: string): void {
    this.updateTextLayer(id, { content: value ?? "" });
  }

  setTextFontFamily(id: string, value: string): void {
    this.updateTextLayer(id, { fontFamily: value });
  }

  setTextFontSize(
    id: string,
    value: number,
    opts?: { autoFitLocked?: boolean },
  ): void {
    const autoFitLocked = opts?.autoFitLocked ?? true;
    this.updateTextLayer(
      id,
      { fontSizePx: value, manualFontSizePx: value, autoFitLocked },
      { useSlider: true },
    );
  }

  setTextFillColor(id: string, value: string): void {
    this.updateTextLayer(id, { fillColor: this.normalizeHex(value) });
  }

  setTextStrokeColor(id: string, value: string): void {
    this.updateTextLayer(id, { strokeColor: this.normalizeHex(value) });
  }

  setTextStrokeWidth(id: string, value: number): void {
    this.updateTextLayer(id, { strokeWidthPx: value }, { useSlider: true });
  }

  setTextMaxWidth(
    id: string,
    value: number,
    opts?: { autoFitLocked?: boolean; userBoxTouched?: boolean },
  ): void {
    const normalized = Number.isFinite(value) ? value : undefined;
    this.updateTextLayer(
      id,
      {
        maxWidthPx: normalized,
        autoFitLocked: opts?.autoFitLocked,
        ...(opts?.userBoxTouched !== undefined
          ? { userBoxTouched: opts.userBoxTouched }
          : {}),
      },
      { useSlider: true },
    );
  }

  setTextBoxSize(
    id: string,
    width: number,
    height: number,
    opts?: { autoFitLocked?: boolean; userBoxTouched?: boolean },
  ): void {
    const nextW = Number.isFinite(width) ? width : undefined;
    const nextH = Number.isFinite(height) ? height : undefined;
    this.updateTextLayer(
      id,
      {
        maxWidthPx: nextW,
        boxHeightPx: nextH,
        autoFitLocked: opts?.autoFitLocked ?? true,
        ...(opts?.userBoxTouched !== undefined
          ? { userBoxTouched: opts.userBoxTouched }
          : {}),
      },
      { useSlider: true },
    );
  }

  setTextPosition(id: string, x: number, y: number): void {
    this.updateTextLayer(id, { x, y }, { skipRecord: this.textDragActiveId === id });
  }

  resetBrightness(): void {
    this.setBrightness(DEFAULT_EDITOR_ADJUSTMENTS.brightness);
  }

  resetSaturation(): void {
    this.setSaturation(DEFAULT_EDITOR_ADJUSTMENTS.saturation);
  }

  resetContrast(): void {
    this.setContrast(DEFAULT_EDITOR_ADJUSTMENTS.contrast);
  }

  resetSharpness(): void {
    this.setSharpness(DEFAULT_EDITOR_ADJUSTMENTS.sharpness);
  }

  resetBw(): void {
    this.setBw(DEFAULT_EDITOR_ADJUSTMENTS.bw);
  }

  resetEReaderOptimization(): void {
    this.setEReaderOptimizationEnabled(false);
  }

  resetDither(): void {
    this.setDither(DEFAULT_EDITOR_ADJUSTMENTS.dither);
    this.setDitheringMode(DEFAULT_EDITOR_ADJUSTMENTS.dithering.mode);
  }

  resetCleanup(): void {
    this.setArtifactReductionEnabled(DEFAULT_EDITOR_ADJUSTMENTS.cleanup.enabled);
    this.setCleanupArtifactReduction(
      DEFAULT_EDITOR_ADJUSTMENTS.cleanup.artifactReduction,
    );
    this.setSmoothGradients(DEFAULT_EDITOR_ADJUSTMENTS.cleanup.smoothGradients);
    this.setPreserveDetails(DEFAULT_EDITOR_ADJUSTMENTS.cleanup.preserveDetails);
  }

  setRotation(value: number): void {
    const prev = this.editorState.rot();
    this.editorState.setRotation(value);
    const next = this.editorState.rot();
    if (prev === next) return;
    this.recordCommand({ type: "SetRotation", payload: { value: next } });
  }

  rotateLeft(): void {
    const prev = this.editorState.rot();
    this.editorState.rotateLeft();
    const next = this.editorState.rot();
    if (prev === next) return;
    this.recordCommand({ type: "SetRotation", payload: { value: next } });
  }

  rotateRight(): void {
    const prev = this.editorState.rot();
    this.editorState.rotateRight();
    const next = this.editorState.rot();
    if (prev === next) return;
    this.recordCommand({ type: "SetRotation", payload: { value: next } });
  }

  toggleFlipX(): void {
    const prev = this.editorState.flipX();
    this.editorState.toggleFlipX();
    const next = this.editorState.flipX();
    if (prev === next) return;
    this.recordCommand({ type: "SetFlipX", payload: { value: next } });
  }

  toggleFlipY(): void {
    const prev = this.editorState.flipY();
    this.editorState.toggleFlipY();
    const next = this.editorState.flipY();
    if (prev === next) return;
    this.recordCommand({ type: "SetFlipY", payload: { value: next } });
  }

  setScale(value: number): void {
    const prev = this.captureViewport();
    this.editorState.setScale(value);
    if (this.gestureActive) return;
    this.recordViewportIfChanged(prev);
  }

  setTranslation(tx: number, ty: number): void {
    const prev = this.captureViewport();
    this.editorState.setTranslation(tx, ty);
    if (this.gestureActive) return;
    this.recordViewportIfChanged(prev);
  }

  zoomIn(step = 0.12): void {
    const prev = this.captureViewport();
    this.editorState.zoomIn(step);
    this.recordViewportIfChanged(prev);
  }

  zoomOut(step = 0.12): void {
    const prev = this.captureViewport();
    this.editorState.zoomOut(step);
    this.recordViewportIfChanged(prev);
  }

  resetViewToCover(): void {
    const prev = this.captureViewport();
    this.editorState.resetViewToCover();
    if (this.gestureActive) return;
    this.recordViewportIfChanged(prev);
  }

  setKindleModel(groupId: string | undefined, modelId: string | undefined): void {
    if (!modelId) return;
    const changed = this.kindleState.selectByIds(groupId, modelId);
    if (!changed) return;

    this.editorState.resetViewToCover();

    const snapshot = this.kindleState.captureSnapshot();
    this.recordCommand({
      type: "ChangeKindleModel",
      payload: snapshot,
    });
  }

  getMinToolsScale(): number {
    return this.editorState.getMinToolsScale();
  }

  private undoLocal(): void {
    const min = this.localMinPointer();
    const pointer = this.localPointer();
    if (pointer <= min) return;

    this.localPointer.set(pointer - 1);
    this.recomposeLocal();
  }

  private redoLocal(): void {
    const pointer = this.localPointer();
    const commands = this.localCommands();
    if (pointer >= commands.length) return;

    this.localPointer.set(pointer + 1);
    this.recomposeLocal();
  }

  private undoGlobal(): void {
    const blocks = this.globalStack();
    if (!blocks.length) return;

    const last = blocks[blocks.length - 1];
    this.globalStack.set(blocks.slice(0, -1));
    this.globalRedoStack.set([...this.globalRedoStack(), last]);
    this.recomposeGlobal();
  }

  private redoGlobal(): void {
    const redoBlocks = this.globalRedoStack();
    if (!redoBlocks.length) return;

    const last = redoBlocks[redoBlocks.length - 1];
    this.globalRedoStack.set(redoBlocks.slice(0, -1));
    this.globalStack.set([...this.globalStack(), last]);
    this.recomposeGlobal();
  }

  private recomposeLocal(): void {
    const baseline = this.baselineSnapshot();
    if (!baseline) return;

    const commands = this.localCommands().slice(0, this.localPointer());
    this.replay(() => {
      this.editorState.setState(baseline);
      const kindleBaseline = this.baselineKindleSnapshot();
      if (this.panelScope() === "tools" && kindleBaseline) {
        this.kindleState.restoreSnapshot(kindleBaseline, { silent: true });
      }
      for (const cmd of commands) {
        this.applyCommand(cmd);
      }
    });
  }

  private recomposeGlobal(): void {
    if (!this.initialSnapshot) {
      this.initialSnapshot = this.editorState.getState();
    }

    const blocks = this.globalStack();
    this.replay(() => {
      this.editorState.setState(this.initialSnapshot!);
      for (const block of blocks) {
        for (const cmd of block.commands) {
          this.applyCommand(cmd);
        }
      }
    });
  }

  private applyCommand(command: EditorCommand): void {
    switch (command.type) {
      case "SetBrightness":
        this.editorState.setBrightness(command.payload.value);
        if (typeof command.payload.eReaderOptimizationEnabled === "boolean") {
          this.editorState.setEReaderOptimizationEnabled(
            command.payload.eReaderOptimizationEnabled,
          );
        }
        return;
      case "SetSaturation":
        this.editorState.setSaturation(command.payload.value);
        if (typeof command.payload.eReaderOptimizationEnabled === "boolean") {
          this.editorState.setEReaderOptimizationEnabled(
            command.payload.eReaderOptimizationEnabled,
          );
        }
        return;
      case "SetContrast":
        this.editorState.setContrast(command.payload.value);
        if (typeof command.payload.eReaderOptimizationEnabled === "boolean") {
          this.editorState.setEReaderOptimizationEnabled(
            command.payload.eReaderOptimizationEnabled,
          );
        }
        return;
      case "SetSharpness":
        this.editorState.setSharpness(command.payload.value);
        if (typeof command.payload.eReaderOptimizationEnabled === "boolean") {
          this.editorState.setEReaderOptimizationEnabled(
            command.payload.eReaderOptimizationEnabled,
          );
        }
        return;
      case "SetBw":
        this.editorState.setBw(command.payload.value);
        return;
      case "SetEReaderOptimizationEnabled":
        this.editorState.setEReaderOptimizationEnabled(command.payload.value);
        return;
      case "ApplyEReaderOptimizationPreset": {
        const payload = command.payload as {
          brightness: number;
          contrast: number;
          saturation: number;
          sharpness: number;
          eReaderOptimizationEnabled: boolean;
        };
        this.editorState.setBrightness(payload.brightness);
        this.editorState.setContrast(payload.contrast);
        this.editorState.setSaturation(payload.saturation);
        this.editorState.setSharpness(payload.sharpness);
        this.editorState.setEReaderOptimizationEnabled(
          payload.eReaderOptimizationEnabled,
        );
        return;
      }
      case "SetDither":
        this.editorState.setDitheringEnabled(command.payload.value);
        return;
      case "SetCleanupEnabled":
        this.editorState.setArtifactReductionEnabled(command.payload.value);
        return;
      case "SetCleanupArtifactReduction":
        this.editorState.setCleanupArtifactReduction(command.payload.value);
        return;
      case "SetSmoothGradients":
        this.editorState.setSmoothGradients(command.payload.value);
        return;
      case "SetPreserveDetails":
        this.editorState.setPreserveDetails(command.payload.value);
        return;
      case "SetDitheringEnabled":
        this.editorState.setDitheringEnabled(command.payload.value);
        return;
      case "SetDitheringMode":
        this.editorState.setDitheringMode(command.payload.value);
        return;
      case "SetRotation":
        this.editorState.setRotation(command.payload.value);
        return;
      case "SetFlipX": {
        const current = this.editorState.flipX();
        if (current !== command.payload.value) {
          this.editorState.toggleFlipX();
        }
        return;
      }
      case "SetFlipY": {
        const current = this.editorState.flipY();
        if (current !== command.payload.value) {
          this.editorState.toggleFlipY();
        }
        return;
      }
      case "SetViewport":
        this.editorState.setViewportRaw(
          command.payload.scale,
          command.payload.tx,
          command.payload.ty,
        );
        return;
      case "ChangeKindleModel": {
        const snapshot = command.payload as KindleSelectionSnapshot;
        const changed = this.kindleState.restoreSnapshot(snapshot, {
          silent: false,
        });
        if (changed) {
          this.editorState.resetViewToCover();
        }
        return;
      }
      case "CHANGE_BACKGROUND": {
        const payload = command.payload as {
          mode?: BackgroundMode;
          color?: string;
          source?: BackgroundSource;
          blur?: number;
          background?: FitBackgroundConfig;
          bw?: boolean;
          cleanupEnabled?: boolean;
          cleanupStrength?: CleanupStrength;
          smoothGradients?: boolean;
          preserveDetails?: boolean;
          ditheringEnabled?: boolean;
          ditheringMode?: DitheringMode;
        };
        this.editorState.setBackground({
          mode: payload.mode,
          color: payload.color,
          source: payload.source,
          blur: payload.blur,
          background: payload.background,
        });
        if (payload.bw !== undefined) {
          this.editorState.setBw(!!payload.bw);
        }
        if (payload.cleanupEnabled !== undefined) {
          this.editorState.setCleanupEnabled(!!payload.cleanupEnabled);
        }
        if (payload.cleanupStrength !== undefined) {
          this.editorState.setCleanupArtifactReduction(payload.cleanupStrength);
        }
        if (payload.smoothGradients !== undefined) {
          this.editorState.setSmoothGradients(!!payload.smoothGradients);
        }
        if (payload.preserveDetails !== undefined) {
          this.editorState.setPreserveDetails(!!payload.preserveDetails);
        }
        if (payload.ditheringEnabled !== undefined) {
          this.editorState.setDitheringEnabled(!!payload.ditheringEnabled);
        }
        if (payload.ditheringMode !== undefined) {
          this.editorState.setDitheringMode(payload.ditheringMode);
        }
        return;
      }
      case "SetTextLayers": {
        const next = (command.payload as EditorSnapshot["textLayers"]) ?? [];
        this.editorState.setTextLayers(next.map((layer) => ({ ...layer })));
        return;
      }
      case "SetTextLayer": {
        const next = command.payload as EditorSnapshot["textLayer"] | null;
        const layers = next ? [{ ...next }] : [];
        this.editorState.setTextLayers(layers);
        return;
      }
      default:
        console.warn("[editor-history] Unknown command:", command);
    }
    this.syncEReaderOptimizationBaselineFromState();
  }

  private disableEReaderOptimizationAndRestoreBaseline(): void {
    const baseline =
      this.eReaderOptimizationBaseline ?? {
        brightness: DEFAULT_EDITOR_ADJUSTMENTS.brightness,
        contrast: DEFAULT_EDITOR_ADJUSTMENTS.contrast,
        saturation: DEFAULT_EDITOR_ADJUSTMENTS.saturation,
        sharpness: DEFAULT_EDITOR_ADJUSTMENTS.sharpness,
      };

    this.setEReaderOptimizationState({
      brightness: baseline.brightness,
      contrast: baseline.contrast,
      saturation: baseline.saturation,
      sharpness: baseline.sharpness,
      eReaderOptimizationEnabled: false,
    });
  }

  private captureCurrentAdjustmentBaseline(): EReaderOptimizationBaseline {
    return {
      brightness: this.roundToStep(this.editorState.brightness(), SLIDER_STEP),
      contrast: this.roundToStep(this.editorState.contrast(), SLIDER_STEP),
      saturation: this.roundToStep(this.editorState.saturation(), SLIDER_STEP),
      sharpness: this.roundToStep(this.editorState.sharpness(), SLIDER_STEP),
    };
  }

  private maybeAutoDisableEReaderOptimizationOnManualAdjustment(): boolean {
    if (this.eReaderOptimizationMutation) {
      return false;
    }
    if (!this.editorState.eReaderOptimizationEnabled()) {
      return false;
    }
    this.editorState.setEReaderOptimizationEnabled(false);
    this.eReaderOptimizationBaseline = null;
    return true;
  }

  private syncEReaderOptimizationBaselineFromState(): void {
    // Intentionally keep the last baseline even when the optimization flag is false.
    // This makes repeated ON/OFF cycles deterministic in the same editor session.
  }

  private recordViewportIfChanged(prev: {
    scale: number;
    tx: number;
    ty: number;
  }): void {
    const next = this.captureViewport();
    if (
      prev.scale === next.scale &&
      prev.tx === next.tx &&
      prev.ty === next.ty
    ) {
      return;
    }

    this.recordCommand({
      type: "SetViewport",
      payload: next,
    });
  }

  private updateTextLayer(
    id: string,
    patch: Partial<NonNullable<EditorSnapshot["textLayers"]>[number]>,
    opts?: { useSlider?: boolean; skipRecord?: boolean },
  ): void {
    const current = this.editorState.textLayers();
    const idx = current.findIndex((layer) => layer.id === id);
    if (idx < 0) return;

    const next = [...current];
    next[idx] = { ...next[idx], ...patch, id };
    if (
      this.textLayersEqual(
        this.normalizeTextLayers(current),
        this.normalizeTextLayers(next),
      )
    ) {
      return;
    }

    this.editorState.setTextLayers(next);

    if (opts?.skipRecord) return;

    const command = {
      type: "SetTextLayers",
      payload: next.map((layer) => ({ ...layer })),
    };

    if (opts?.useSlider && this.sliderActive) {
      this.pendingSliderCommand = command;
      return;
    }

    this.recordCommand(command);
  }

  private recordCommand(command: EditorCommand): void {
    if (this.isReplaying || this.mode() !== "local") return;

    const commands = this.localCommands();
    const pointer = this.localPointer();
    const trimmed = pointer < commands.length ? commands.slice(0, pointer) : commands;
    const nextCommands = [...trimmed, command];

    this.localCommands.set(nextCommands);
    this.localPointer.set(nextCommands.length);
  }

  private captureEReaderOptimizationState(): {
    brightness: number;
    contrast: number;
    saturation: number;
    sharpness: number;
    eReaderOptimizationEnabled: boolean;
  } {
    return {
      brightness: this.roundToStep(this.editorState.brightness(), SLIDER_STEP),
      contrast: this.roundToStep(this.editorState.contrast(), SLIDER_STEP),
      saturation: this.roundToStep(this.editorState.saturation(), SLIDER_STEP),
      sharpness: this.roundToStep(this.editorState.sharpness(), SLIDER_STEP),
      eReaderOptimizationEnabled: !!this.editorState.eReaderOptimizationEnabled(),
    };
  }

  private eReaderOptimizationStateEqual(
    a: {
      brightness: number;
      contrast: number;
      saturation: number;
      sharpness: number;
      eReaderOptimizationEnabled: boolean;
    },
    b: {
      brightness: number;
      contrast: number;
      saturation: number;
      sharpness: number;
      eReaderOptimizationEnabled: boolean;
    },
  ): boolean {
    return (
      a.brightness === b.brightness &&
      a.contrast === b.contrast &&
      a.saturation === b.saturation &&
      a.sharpness === b.sharpness &&
      a.eReaderOptimizationEnabled === b.eReaderOptimizationEnabled
    );
  }

  private flushPending(): void {
    if (this.sliderActive) {
      this.onSliderEnd();
    }
    if (this.gestureActive) {
      this.onGestureEnd();
    }
    if (this.textDragActiveId) {
      this.onTextDragEnd(this.textDragActiveId);
    }
  }

  private captureViewport(): { scale: number; tx: number; ty: number } {
    return {
      scale: this.editorState.scale(),
      tx: this.editorState.tx(),
      ty: this.editorState.ty(),
    };
  }

  private localMinPointer(): number {
    const commandsLength = this.localCommands().length;
    return Math.max(0, commandsLength - MAX_LOCAL_COMMANDS);
  }

  private normalizeAdjustments(state: EditorSnapshot): NormalizedAdjustments {
    return {
      brightness: this.roundToStep(state.brightness, SLIDER_STEP),
      contrast: this.roundToStep(state.contrast, SLIDER_STEP),
      saturation: this.roundToStep(state.saturation, SLIDER_STEP),
      sharpness: this.roundToStep(state.sharpness ?? 0, SLIDER_STEP),
      eReaderOptimizationEnabled: !!state.eReaderOptimizationEnabled,
      bw: !!state.bw,
      cleanupEnabled: isArtifactReductionEnabled(state),
      cleanupStrength: state.cleanup?.artifactReduction ?? "off",
      smoothGradients: !!state.cleanup?.smoothGradients,
      preserveDetails:
        state.cleanup?.preserveDetails ??
        DEFAULT_EDITOR_ADJUSTMENTS.cleanup.preserveDetails,
      ditheringEnabled: isDitheringEnabled(state),
      ditheringMode:
        state.dithering?.mode ?? DEFAULT_EDITOR_ADJUSTMENTS.dithering.mode,
    };
  }

  private normalizeTransform(state: EditorSnapshot): NormalizedTransform {
    return {
      scale: this.roundTo(state.scale, FLOAT_PRECISION),
      tx: this.roundTo(state.tx, FLOAT_PRECISION),
      ty: this.roundTo(state.ty, FLOAT_PRECISION),
      rot: this.normalizeRotation(state.rot),
      flipX: !!state.flipX,
      flipY: !!state.flipY,
      bw: !!state.bw,
      cleanupEnabled: isArtifactReductionEnabled(state),
      cleanupStrength: state.cleanup?.artifactReduction ?? "off",
      smoothGradients: !!state.cleanup?.smoothGradients,
      preserveDetails:
        state.cleanup?.preserveDetails ??
        DEFAULT_EDITOR_ADJUSTMENTS.cleanup.preserveDetails,
      ditheringEnabled: isDitheringEnabled(state),
      ditheringMode:
        state.dithering?.mode ?? DEFAULT_EDITOR_ADJUSTMENTS.dithering.mode,
      backgroundMode: (state.backgroundMode ?? "transparent") as BackgroundMode,
      backgroundColor: this.normalizeHex(state.backgroundColor),
      backgroundSource:
        (state.backgroundSource as BackgroundSource | undefined) ?? null,
      backgroundBlur: this.normalizeBlur(state.backgroundBlur),
      backgroundPatternId: state.backgroundPattern?.textureId ?? null,
      backgroundPatternFile: state.backgroundPattern?.file ?? null,
      backgroundPatternIntensity: this.normalizeBackgroundIntensity(
        state.backgroundPattern?.intensity,
      ),
      backgroundPatternScale: this.normalizeBackgroundScale(
        state.backgroundPattern?.scale,
      ),
      backgroundPatternOffsetX: this.normalizeBackgroundOffset(
        state.backgroundPattern?.offsetX,
      ),
      backgroundPatternOffsetY: this.normalizeBackgroundOffset(
        state.backgroundPattern?.offsetY,
      ),
    };
  }

  private normalizeTextLayers(
    input:
      | EditorSnapshot
      | EditorSnapshot["textLayers"]
      | EditorSnapshot["textLayer"]
      | null
      | undefined,
  ): NormalizedTextLayers {
    const layers = this.extractTextLayers(input);
    return layers.map((layer) => ({
      id: layer.id ?? "",
      content: layer.content ?? "",
      x: this.roundTo(layer.x ?? 0, FLOAT_PRECISION),
      y: this.roundTo(layer.y ?? 0, FLOAT_PRECISION),
      fontFamily: layer.fontFamily ?? "",
      fontSizePx: this.roundTo(layer.fontSizePx ?? 0, FLOAT_PRECISION),
      manualFontSizePx: this.roundTo(
        layer.manualFontSizePx ?? layer.fontSizePx ?? 0,
        FLOAT_PRECISION,
      ),
      fillColor: this.normalizeHex(layer.fillColor),
      strokeColor: this.normalizeHex(layer.strokeColor),
      strokeWidthPx: this.roundTo(layer.strokeWidthPx ?? 0, FLOAT_PRECISION),
      maxWidthPx: Number.isFinite(layer.maxWidthPx)
        ? this.roundTo(layer.maxWidthPx as number, FLOAT_PRECISION)
        : null,
      boxWidthPx:
        !!layer.autoFitLocked &&
        Number.isFinite(layer.maxWidthPx) &&
        Number.isFinite(layer.boxHeightPx) &&
        Number.isFinite(layer.boxWidthPx)
          ? this.roundTo(layer.boxWidthPx as number, FLOAT_PRECISION)
          : null,
      boxHeightPx:
        !!layer.autoFitLocked &&
        Number.isFinite(layer.maxWidthPx) &&
        Number.isFinite(layer.boxHeightPx)
          ? this.roundTo(layer.boxHeightPx as number, FLOAT_PRECISION)
          : null,
      userBoxTouched: !!layer.userBoxTouched,
    }));
  }

  private extractTextLayers(
    input:
      | EditorSnapshot
      | EditorSnapshot["textLayers"]
      | EditorSnapshot["textLayer"]
      | null
      | undefined,
  ): NonNullable<EditorSnapshot["textLayers"]> {
    if (!input) return [];
    if (Array.isArray(input)) return input as NonNullable<EditorSnapshot["textLayers"]>;
    if (typeof (input as EditorSnapshot).scale === "number") {
      const state = input as EditorSnapshot;
      if (Array.isArray(state.textLayers)) return state.textLayers;
      if (state.textLayer) return [state.textLayer];
      return [];
    }
    return [input as NonNullable<EditorSnapshot["textLayers"]>[number]];
  }

  private textLayersEqual(a: NormalizedTextLayers, b: NormalizedTextLayers): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!this.shallowEqual(a[i], b[i])) return false;
    }
    return true;
  }

  private normalizeKindleSnapshot(
    snapshot: KindleSelectionSnapshot | null,
  ): {
    groupId: string | null;
    modelId: string | null;
    width: number | null;
    height: number | null;
  } {
    return {
      groupId: snapshot?.groupId ?? null,
      modelId: snapshot?.modelId ?? null,
      width: snapshot?.width ?? null,
      height: snapshot?.height ?? null,
    };
  }

  private roundToStep(value: number, step: number): number {
    const scaled = Math.round(value / step) * step;
    return Number.isFinite(scaled) ? scaled : value;
  }

  private roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private normalizeRotation(degrees: number): number {
    const normalized = degrees % 360;
    const positive = normalized < 0 ? normalized + 360 : normalized;
    return (Math.round(positive / 90) * 90) % 360;
  }

  private normalizeHex(value: string | undefined): string {
    const trimmed = (value || "").trim();
    if (!trimmed) return "#000000";
    if (!trimmed.startsWith("#")) return `#${trimmed}`;
    return trimmed.toLowerCase();
  }

  private captureBackground(): {
    mode: BackgroundMode;
    color: string;
    source?: BackgroundSource;
    blur?: number;
    background?: FitBackgroundConfig;
  } {
    return {
      mode: (this.editorState.backgroundMode() ?? "transparent") as BackgroundMode,
      color: this.normalizeHex(this.editorState.backgroundColor()),
      source: this.editorState.backgroundSource() ?? undefined,
      blur: this.normalizeBlur(this.editorState.backgroundBlur()),
      background: this.normalizeBackground(this.editorState.backgroundPattern()),
    };
  }

  private captureBackgroundPolicy(): {
    mode: BackgroundMode;
    color: string;
    source?: BackgroundSource;
    blur?: number;
    background?: FitBackgroundConfig;
    bw: boolean;
    cleanupEnabled: boolean;
    cleanupStrength: string;
    smoothGradients: boolean;
    preserveDetails: boolean;
    ditheringEnabled: boolean;
    ditheringMode: string;
  } {
    const background = this.captureBackground();
    return {
      ...background,
      bw: !!this.editorState.bw(),
      cleanupEnabled: !!this.editorState.cleanupEnabled(),
      cleanupStrength: this.editorState.cleanupArtifactReduction(),
      smoothGradients: !!this.editorState.smoothGradients(),
      preserveDetails: !!this.editorState.preserveDetails(),
      ditheringEnabled: !!this.editorState.ditheringEnabled(),
      ditheringMode: this.editorState.ditheringMode(),
    };
  }

  private applyFillPolicy(nextBackground: {
    mode: BackgroundMode;
    color: string;
    source?: BackgroundSource;
    blur?: number;
    background?: FitBackgroundConfig;
  }): {
    mode: BackgroundMode;
    color: string;
    source?: BackgroundSource;
    blur?: number;
    background?: FitBackgroundConfig;
    bw: boolean;
    cleanupEnabled: boolean;
    cleanupStrength: string;
    smoothGradients: boolean;
    preserveDetails: boolean;
    ditheringEnabled: boolean;
    ditheringMode: string;
  } {
    if (nextBackground.mode !== "transparent" && this.editorState.bw()) {
      this.editorState.setBw(false);
    }

    return {
      ...nextBackground,
      bw: !!this.editorState.bw(),
      cleanupEnabled: !!this.editorState.cleanupEnabled(),
      cleanupStrength: this.editorState.cleanupArtifactReduction(),
      smoothGradients: !!this.editorState.smoothGradients(),
      preserveDetails: !!this.editorState.preserveDetails(),
      ditheringEnabled: !!this.editorState.ditheringEnabled(),
      ditheringMode: this.editorState.ditheringMode(),
    };
  }

  private backgroundPolicyEqual(
    a: {
      mode: BackgroundMode;
      color: string;
      source?: BackgroundSource;
      blur?: number;
      background?: FitBackgroundConfig;
      bw: boolean;
      cleanupEnabled: boolean;
      cleanupStrength: string;
      smoothGradients: boolean;
      preserveDetails: boolean;
      ditheringEnabled: boolean;
      ditheringMode: string;
    },
    b: {
      mode: BackgroundMode;
      color: string;
      source?: BackgroundSource;
      blur?: number;
      background?: FitBackgroundConfig;
      bw: boolean;
      cleanupEnabled: boolean;
      cleanupStrength: string;
      smoothGradients: boolean;
      preserveDetails: boolean;
      ditheringEnabled: boolean;
      ditheringMode: string;
    },
  ): boolean {
    return (
      a.mode === b.mode &&
      a.color === b.color &&
      a.source === b.source &&
      this.normalizeBlur(a.blur) === this.normalizeBlur(b.blur) &&
      this.textureEqual(a.background, b.background) &&
      a.bw === b.bw &&
      a.cleanupEnabled === b.cleanupEnabled &&
      a.cleanupStrength === b.cleanupStrength &&
      a.smoothGradients === b.smoothGradients &&
      a.preserveDetails === b.preserveDetails &&
      a.ditheringEnabled === b.ditheringEnabled &&
      a.ditheringMode === b.ditheringMode
    );
  }

  private normalizeBlur(value: number | undefined): number {
    if (!Number.isFinite(value)) return 80;
    const clamped = Math.max(0, Math.min(100, value as number));
    return Math.round(clamped);
  }

  private normalizeBackground(
    value?: FitBackgroundConfig,
  ): FitBackgroundConfig | undefined {
    if (!value) return undefined;
    const textureId = (value.textureId || "").trim();
    const file = (value.file || "").trim();
    if (!textureId || !file) return undefined;
    return {
      textureId,
      file,
      intensity: this.normalizeBackgroundIntensity(value.intensity),
      scale: this.normalizeBackgroundScale(value.scale),
      offsetX: this.normalizeBackgroundOffset(value.offsetX),
      offsetY: this.normalizeBackgroundOffset(value.offsetY),
    };
  }

  private normalizeBackgroundIntensity(value: number | undefined): number {
    if (!Number.isFinite(value)) return 1;
    return this.roundTo(this.clamp(value as number, 0, 1), FLOAT_PRECISION);
  }

  private normalizeBackgroundScale(value: number | undefined): number {
    if (!Number.isFinite(value)) return 1;
    return this.roundTo(this.clamp(value as number, 0.25, 4), FLOAT_PRECISION);
  }

  private normalizeBackgroundOffset(value: number | undefined): number {
    if (!Number.isFinite(value)) return 0;
    return this.roundTo(value as number, FLOAT_PRECISION);
  }

  private textureEqual(
    a?: FitBackgroundConfig,
    b?: FitBackgroundConfig,
  ): boolean {
    const na = this.normalizeBackground(a);
    const nb = this.normalizeBackground(b);
    if (!na && !nb) return true;
    if (!na || !nb) return false;
    return (
      na.textureId === nb.textureId &&
      na.file === nb.file &&
      na.intensity === nb.intensity &&
      na.scale === nb.scale &&
      this.normalizeBackgroundOffset(na.offsetX) ===
        this.normalizeBackgroundOffset(nb.offsetX) &&
      this.normalizeBackgroundOffset(na.offsetY) ===
        this.normalizeBackgroundOffset(nb.offsetY)
    );
  }

  private shallowEqual<T extends Record<string, any>>(a: T, b: T): boolean {
    for (const key of Object.keys(a)) {
      if (a[key] !== b[key]) return false;
    }
    return true;
  }

  private replay(fn: () => void): void {
    this.isReplaying = true;
    try {
      fn();
    } finally {
      this.isReplaying = false;
    }
  }

  private cloneHistoryBlocks(blocks: HistoryBlock[]): HistoryBlock[] {
    return blocks.map((block) => ({
      commands: block.commands.map((command) => ({
        type: command.type,
        payload: this.cloneValue(command.payload),
      })),
    }));
  }

  private cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
    return this.cloneValue(snapshot);
  }

  private cloneValue<T>(value: T): T {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
