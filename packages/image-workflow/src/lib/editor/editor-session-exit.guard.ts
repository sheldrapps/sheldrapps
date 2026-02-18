import { Injectable } from "@angular/core";
import { CanDeactivate } from "@angular/router";
import { EditorSessionExitService } from "./editor-session-exit.service";

@Injectable({
  providedIn: "root",
})
export class EditorSessionExitGuard implements CanDeactivate<unknown> {
  constructor(private readonly sessionExit: EditorSessionExitService) {}

  canDeactivate(): boolean | Promise<boolean> {
    return this.sessionExit.canExitEditor();
  }
}
