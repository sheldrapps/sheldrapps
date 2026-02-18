import { Injectable, computed, signal } from "@angular/core";
import { EditorStateService } from "./editor-state.service";
import {
  EditorKindleStateService,
  type KindleSelectionSnapshot,
} from "./editor-kindle-state.service";
import { DEFAULT_EDITOR_ADJUSTMENTS } from "./editor-adjustments";

export type HistoryMode = "local" | "global";
export type PanelScope = "tools" | "adjustments";

export interface EditorCommand {
  type: string;
  payload: any;
}

type EditorSnapshot = ReturnType<EditorStateService["getState"]>;
type HistoryBlock = { commands: EditorCommand[] };

const MAX_LOCAL_COMMANDS = 10;
const SLIDER_STEP = 0.01;
const FLOAT_PRECISION = 3;

type NormalizedAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  bw: boolean;
  dither: boolean;
};

type NormalizedTransform = {
  scale: number;
  tx: number;
  ty: number;
  rot: number;
  flipX: boolean;
  flipY: boolean;
};

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

  private gestureActive = false;
  private gestureStart: { scale: number; tx: number; ty: number } | null = null;

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
  readonly bw = this.editorState.bw;
  readonly dither = this.editorState.dither;
  readonly adjustments = this.editorState.adjustments;
  readonly isAdjusting = this.editorState.isAdjusting;

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
  }

  applyPanel(): boolean {
    if (this.mode() !== "local") return false;
    if (!this.isDirty()) return false;

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

    this.localCommands.set([]);
    this.localPointer.set(0);
    this.baselineSnapshot.set(null);
    this.baselineKindleSnapshot.set(null);
    this.panelScope.set(null);
    this.mode.set("global");
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
    return true;
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

  setBrightness(value: number): void {
    const prev = this.editorState.brightness();
    this.editorState.setBrightness(value);
    const next = this.editorState.brightness();
    if (prev === next) return;
    const command = { type: "SetBrightness", payload: { value: next } };
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
    const command = { type: "SetSaturation", payload: { value: next } };
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
    const command = { type: "SetContrast", payload: { value: next } };
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

  setDither(value: boolean): void {
    const prev = this.editorState.dither();
    this.editorState.setDither(value);
    const next = this.editorState.dither();
    if (prev === next) return;
    this.recordCommand({ type: "SetDither", payload: { value: next } });
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

  resetBw(): void {
    this.setBw(DEFAULT_EDITOR_ADJUSTMENTS.bw);
    if (DEFAULT_EDITOR_ADJUSTMENTS.bw) {
      this.setDither(DEFAULT_EDITOR_ADJUSTMENTS.dither);
    }
  }

  resetDither(): void {
    this.setDither(DEFAULT_EDITOR_ADJUSTMENTS.dither);
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
        return;
      case "SetSaturation":
        this.editorState.setSaturation(command.payload.value);
        return;
      case "SetContrast":
        this.editorState.setContrast(command.payload.value);
        return;
      case "SetBw":
        this.editorState.setBw(command.payload.value);
        return;
      case "SetDither":
        this.editorState.setDither(command.payload.value);
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
        this.editorState.setScale(command.payload.scale);
        this.editorState.setTranslation(command.payload.tx, command.payload.ty);
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
      default:
        console.warn("[editor-history] Unknown command:", command);
    }
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

  private recordCommand(command: EditorCommand): void {
    if (this.isReplaying || this.mode() !== "local") return;

    const commands = this.localCommands();
    const pointer = this.localPointer();
    const trimmed = pointer < commands.length ? commands.slice(0, pointer) : commands;
    const nextCommands = [...trimmed, command];

    this.localCommands.set(nextCommands);
    this.localPointer.set(nextCommands.length);
  }

  private flushPending(): void {
    if (this.sliderActive) {
      this.onSliderEnd();
    }
    if (this.gestureActive) {
      this.onGestureEnd();
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
      bw: !!state.bw,
      dither: !!state.dither,
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
    };
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

  private normalizeRotation(degrees: number): number {
    const normalized = degrees % 360;
    const positive = normalized < 0 ? normalized + 360 : normalized;
    return (Math.round(positive / 90) * 90) % 360;
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
}
