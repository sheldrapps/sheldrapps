import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostBinding,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from "@angular/core";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonTitle,
  IonToolbar,
  ModalController,
} from "@ionic/angular/standalone";

@Component({
  standalone: true,
  selector: "app-save-cover-modal-shared",
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonButtons,
    IonButton,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="rename-content ion-padding">
      <div class="rename-form">
        <label class="rename-label" for="rename-filename-input">{{ message }}</label>
        <input
          #filenameInput
          id="rename-filename-input"
          type="text"
          class="rename-input"
          [value]="filenameValue"
          [placeholder]="placeholder"
          (input)="onFilenameInput($event)"
          (focus)="onInputFocus()"
          (keyup.enter)="save()"
          autofocus
        />
      </div>
    </ion-content>

    <ion-footer class="rename-footer">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="cancel()">{{ cancelText }}</ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button
            color="primary"
            (click)="save()"
            [disabled]="!filenameValue.trim()"
          >
            {{ confirmText }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: `
    :host {
      --rename-keyboard-inset: 0px;
      display: block;
      height: 100%;
    }

    ion-content.rename-content {
      --padding-top: 16px;
      --padding-bottom: calc(16px + var(--rename-keyboard-inset));
      --padding-start: 16px;
      --padding-end: 16px;
    }

    .rename-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 140px;
      padding-bottom: calc(16px + var(--rename-keyboard-inset));
    }

    .rename-label {
      font-weight: 600;
      font-size: 14px;
      color: var(--ion-color-dark);
    }

    .rename-input {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--ion-color-medium);
      border-radius: 8px;
      font-size: 16px;
      font-family: inherit;
      background: var(--ion-color-light, #fff);
      color: var(--ion-text-color, #111);
    }

    .rename-input:focus {
      outline: none;
      border-color: var(--ion-color-primary);
      box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.16);
    }

    ion-footer.rename-footer {
      padding-bottom: calc(env(safe-area-inset-bottom) + var(--rename-keyboard-inset));
    }
  `,
})
export class SaveCoverModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly modalController = inject(ModalController);

  @Input() initialFilename = "";
  @Input() title = "Save";
  @Input() message = "Enter a name";
  @Input() placeholder = "File name";
  @Input() cancelText = "Cancel";
  @Input() confirmText = "Done";

  @ViewChild("filenameInput")
  filenameInput?: ElementRef<HTMLInputElement>;

  filenameValue = "";

  @HostBinding("style.--rename-keyboard-inset")
  get keyboardInsetCss(): string {
    return `${this.keyboardInset}px`;
  }

  private keyboardInset = 0;
  private baselineViewportHeight = 0;
  private cleanupFns: Array<() => void> = [];

  ngOnInit(): void {
    this.filenameValue = this.initialFilename;
    this.baselineViewportHeight = this.getViewportHeight();
  }

  ngAfterViewInit(): void {
    this.bindKeyboardObservers();
    setTimeout(() => {
      const input = this.filenameInput?.nativeElement;
      if (!input) return;
      input.focus();
      input.select();
      this.scrollInputIntoView();
    }, 120);
  }

  ngOnDestroy(): void {
    for (const cleanup of this.cleanupFns) cleanup();
    this.cleanupFns = [];
  }

  async onInputFocus() {
    await this.expandSheetToFullHeight();
    this.updateKeyboardInset();
    this.scrollInputIntoView();
  }

  cancel(): void {
    void this.modalController.dismiss(null, "cancel");
  }

  save(): void {
    const trimmed = this.filenameValue.trim();
    if (!trimmed) return;
    void this.modalController.dismiss(trimmed, "confirm");
  }

  onFilenameInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.filenameValue = target?.value ?? "";
  }

  private bindKeyboardObservers() {
    const viewport = window.visualViewport;
    const handleResize = () => {
      this.updateKeyboardInset();
      if (document.activeElement === this.filenameInput?.nativeElement) {
        this.scrollInputIntoView();
      }
    };

    window.addEventListener("resize", handleResize, { passive: true });
    this.cleanupFns.push(() =>
      window.removeEventListener("resize", handleResize),
    );

    if (viewport) {
      viewport.addEventListener("resize", handleResize);
      viewport.addEventListener("scroll", handleResize);
      this.cleanupFns.push(() => viewport.removeEventListener("resize", handleResize));
      this.cleanupFns.push(() => viewport.removeEventListener("scroll", handleResize));
    }
  }

  private async expandSheetToFullHeight(): Promise<void> {
    try {
      const top = (await this.modalController.getTop()) as any;
      if (typeof top?.setCurrentBreakpoint === "function") {
        await top.setCurrentBreakpoint(1);
      }
    } catch {
      // Best effort only.
    }
  }

  private getViewportHeight(): number {
    const viewport = window.visualViewport;
    if (viewport) {
      return Math.round(viewport.height + viewport.offsetTop);
    }
    return window.innerHeight;
  }

  private updateKeyboardInset() {
    const viewport = window.visualViewport;
    let inset = 0;
    if (viewport) {
      inset = Math.max(
        0,
        Math.round(window.innerHeight - (viewport.height + viewport.offsetTop)),
      );
    } else {
      const current = window.innerHeight;
      const delta = this.baselineViewportHeight - current;
      inset = delta > 110 ? delta : 0;
    }
    this.keyboardInset = Math.max(0, inset);
  }

  private scrollInputIntoView() {
    const input = this.filenameInput?.nativeElement;
    if (!input) return;
    requestAnimationFrame(() => {
      input.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }
}
