import { DOCUMENT } from "@angular/common";
import { Injectable, inject } from "@angular/core";

type SystemBarIconTone = "light" | "dark";

export type SystemBarAppearance = {
  statusBarIcons: SystemBarIconTone;
  navBarIcons?: SystemBarIconTone;
};

type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type PluginListenerHandle = {
  remove: () => Promise<void> | void;
};

type CapacitorStatusBarPlugin = {
  getInfo: () => Promise<{ height?: number }>;
  setOverlaysWebView: (options: { overlay: boolean }) => Promise<void>;
  setStyle: (options: { style: "DARK" | "LIGHT" }) => Promise<void>;
  show: () => Promise<void>;
};

type CapacitorKeyboardPlugin = {
  addListener: (
    eventName: string,
    listener: (event: { keyboardHeight?: number }) => void,
  ) => Promise<PluginListenerHandle>;
};

type CapacitorBridge = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  Plugins?: {
    Keyboard?: CapacitorKeyboardPlugin;
    StatusBar?: CapacitorStatusBarPlugin;
  };
};

const ZERO_INSETS: Insets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

@Injectable({ providedIn: "root" })
export class EdgeToEdgeService {
  private readonly document = inject(DOCUMENT);
  private readonly debug =
    typeof window !== "undefined" &&
    Boolean((window as typeof window & { __SH_EDGE_DEBUG__?: boolean }).__SH_EDGE_DEBUG__);

  private initialized = false;
  private listenersAttached = false;
  private keyboardVisible = false;
  private keyboardHeight = 0;
  private pendingFrame = 0;
  private statusBarHeight = 0;
  private stableInsets: Insets = { ...ZERO_INSETS };
  private currentAppearance: SystemBarAppearance = {
    statusBarIcons: this.prefersDarkSystemBars() ? "light" : "dark",
  };
  private keyboardShowListener?: PluginListenerHandle;
  private keyboardHideListener?: PluginListenerHandle;
  private measureElement?: HTMLDivElement;

  async initEdgeToEdge(
    appearance: Partial<SystemBarAppearance> = {},
  ): Promise<void> {
    if (this.initialized) {
      await this.setSystemBarAppearance({
        ...this.currentAppearance,
        ...appearance,
      });
      this.scheduleInsetsUpdate();
      return;
    }

    this.initialized = true;
    this.currentAppearance = {
      ...this.currentAppearance,
      ...appearance,
    };

    this.applySafeAreaToAppShell();
    this.attachListeners();
    await this.enableNativeEdgeToEdge();
    await this.setSystemBarAppearance(this.currentAppearance);
    this.scheduleInsetsUpdate();
  }

  applySafeAreaToAppShell(): void {
    const docEl = this.document.documentElement;
    const body = this.document.body;

    docEl.classList.add("sh-edge-to-edge");
    body?.classList.add("sh-edge-to-edge");

    const ionApp = this.document.querySelector("ion-app");
    ionApp?.classList.add("edge-to-edge-shell");

    this.ensureMeasureElement();
    this.writeInsets(this.stableInsets);
  }

  async setSystemBarAppearance(
    appearance: SystemBarAppearance,
  ): Promise<void> {
    this.currentAppearance = appearance;
    this.document.documentElement.dataset["statusBarIcons"] =
      appearance.statusBarIcons;

    if (appearance.navBarIcons) {
      this.document.documentElement.dataset["navBarIcons"] =
        appearance.navBarIcons;
    }

    if (!this.isNativeAndroid()) {
      return;
    }

    const statusBar = this.getStatusBarPlugin();
    if (!statusBar) {
      return;
    }

    try {
      await statusBar.setStyle({
        style:
          appearance.statusBarIcons === "light" ? "DARK" : "LIGHT",
      });
    } catch (error) {
      this.log("StatusBar.setStyle failed", error);
    }
  }

  private async enableNativeEdgeToEdge(): Promise<void> {
    if (!this.isNativeAndroid()) {
      return;
    }

    const statusBar = this.getStatusBarPlugin();
    const keyboard = this.getKeyboardPlugin();

    if (!statusBar) {
      return;
    }

    try {
      await statusBar.show();
    } catch (error) {
      this.log("StatusBar.show failed", error);
    }

    try {
      await statusBar.setOverlaysWebView({ overlay: true });
    } catch (error) {
      this.log("StatusBar.setOverlaysWebView failed", error);
    }

    try {
      const info = await statusBar.getInfo();
      const height = info.height;
      this.statusBarHeight =
        typeof height === "number" && Number.isFinite(height) ? height : 0;
    } catch (error) {
      this.log("StatusBar.getInfo failed", error);
    }

    if (!keyboard) {
      return;
    }

    try {
      this.keyboardShowListener = await keyboard.addListener(
        "keyboardDidShow",
        (event) => {
          this.keyboardVisible = true;
          this.keyboardHeight = Math.max(0, event.keyboardHeight ?? 0);
          this.writeKeyboardInset(this.keyboardHeight);
          this.scheduleInsetsUpdate();
        },
      );
      this.keyboardHideListener = await keyboard.addListener(
        "keyboardDidHide",
        () => {
          this.keyboardVisible = false;
          this.keyboardHeight = 0;
          this.writeKeyboardInset(0);
          this.scheduleInsetsUpdate();
        },
      );
    } catch (error) {
      this.log("Keyboard listeners unavailable", error);
    }
  }

  private attachListeners(): void {
    if (this.listenersAttached || typeof window === "undefined") {
      return;
    }

    this.listenersAttached = true;
    window.addEventListener("resize", this.handleViewportChange, {
      passive: true,
    });
    window.addEventListener("orientationchange", this.handleViewportChange, {
      passive: true,
    });
    window.visualViewport?.addEventListener(
      "resize",
      this.handleViewportChange,
      { passive: true },
    );
    window.visualViewport?.addEventListener(
      "scroll",
      this.handleViewportChange,
      { passive: true },
    );
  }

  private readonly handleViewportChange = () => {
    this.scheduleInsetsUpdate();
  };

  private scheduleInsetsUpdate(): void {
    if (typeof window === "undefined") {
      return;
    }

    if (this.pendingFrame) {
      window.cancelAnimationFrame(this.pendingFrame);
    }

    this.pendingFrame = window.requestAnimationFrame(() => {
      this.pendingFrame = 0;
      this.updateInsets();
    });
  }

  private updateInsets(): void {
    const cssInsets = this.measureCssEnvInsets();
    const viewportInsets = this.measureViewportInsets();

    const measured: Insets = {
      top: Math.max(cssInsets.top, viewportInsets.top, this.statusBarHeight),
      right: Math.max(cssInsets.right, viewportInsets.right),
      bottom: Math.max(cssInsets.bottom, viewportInsets.bottom),
      left: Math.max(cssInsets.left, viewportInsets.left),
    };

    if (!this.keyboardVisible) {
      this.stableInsets = measured;
    }

    this.writeInsets(this.keyboardVisible ? this.stableInsets : measured);
  }

  private measureViewportInsets(): Insets {
    if (typeof window === "undefined") {
      return ZERO_INSETS;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return ZERO_INSETS;
    }

    const right = Math.max(
      0,
      window.innerWidth - viewport.width - viewport.offsetLeft,
    );
    const bottom = Math.max(
      0,
      window.innerHeight - viewport.height - viewport.offsetTop,
    );

    return {
      top: Math.max(0, viewport.offsetTop),
      right,
      bottom,
      left: Math.max(0, viewport.offsetLeft),
    };
  }

  private measureCssEnvInsets(): Insets {
    const element = this.ensureMeasureElement();
    if (!element || typeof window === "undefined") {
      return ZERO_INSETS;
    }

    const styles = window.getComputedStyle(element);
    return {
      top: this.readPx(styles.paddingTop),
      right: this.readPx(styles.paddingRight),
      bottom: this.readPx(styles.paddingBottom),
      left: this.readPx(styles.paddingLeft),
    };
  }

  private ensureMeasureElement(): HTMLDivElement | undefined {
    if (this.measureElement?.isConnected) {
      return this.measureElement;
    }

    const body = this.document.body;
    if (!body) {
      return undefined;
    }

    const element = this.document.createElement("div");
    element.className = "sh-safe-area-probe";
    body.appendChild(element);
    this.measureElement = element;
    return element;
  }

  private writeInsets(insets: Insets): void {
    const rootStyle = this.document.documentElement.style;

    rootStyle.setProperty("--safe-top", `${insets.top}px`);
    rootStyle.setProperty("--safe-right", `${insets.right}px`);
    rootStyle.setProperty("--safe-bottom", `${insets.bottom}px`);
    rootStyle.setProperty("--safe-left", `${insets.left}px`);

    rootStyle.setProperty("--ion-safe-area-top", `${insets.top}px`);
    rootStyle.setProperty("--ion-safe-area-right", `${insets.right}px`);
    rootStyle.setProperty("--ion-safe-area-bottom", `${insets.bottom}px`);
    rootStyle.setProperty("--ion-safe-area-left", `${insets.left}px`);
  }

  private writeKeyboardInset(height: number): void {
    this.document.documentElement.style.setProperty(
      "--keyboard-inset-bottom",
      `${Math.max(0, height)}px`,
    );
  }

  private readPx(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private prefersDarkSystemBars(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  private isNativeAndroid(): boolean {
    const capacitor = this.getCapacitor();
    return Boolean(
      capacitor?.isNativePlatform?.() && capacitor.getPlatform?.() === "android",
    );
  }

  private getCapacitor(): CapacitorBridge | undefined {
    if (typeof window === "undefined") {
      return undefined;
    }

    return (window as typeof window & { Capacitor?: CapacitorBridge }).Capacitor;
  }

  private getKeyboardPlugin(): CapacitorKeyboardPlugin | undefined {
    return this.getCapacitor()?.Plugins?.Keyboard;
  }

  private getStatusBarPlugin(): CapacitorStatusBarPlugin | undefined {
    return this.getCapacitor()?.Plugins?.StatusBar;
  }

  private log(message: string, error: unknown): void {
    if (!this.debug) {
      return;
    }

    console.info("[EdgeToEdge]", message, error);
  }
}
