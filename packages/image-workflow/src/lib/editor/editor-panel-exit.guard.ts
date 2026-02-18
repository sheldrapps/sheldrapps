import { Injectable } from "@angular/core";
import { CanDeactivate } from "@angular/router";
import { EditorPanelExitService } from "./editor-panel-exit.service";

@Injectable({
  providedIn: "root",
})
export class EditorPanelExitGuard implements CanDeactivate<unknown> {
  constructor(private readonly panelExit: EditorPanelExitService) {}

  canDeactivate(): boolean | Promise<boolean> {
    return this.panelExit.discardPanelIfNeeded();
  }
}
