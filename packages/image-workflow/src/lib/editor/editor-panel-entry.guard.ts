import { Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";
import { EditorHistoryService } from "./editor-history.service";
import { EditorSessionExitService } from "./editor-session-exit.service";

@Injectable({
  providedIn: "root",
})
export class EditorPanelEntryGuard implements CanActivate {
  constructor(
    private readonly router: Router,
    private readonly history: EditorHistoryService,
    private readonly sessionExit: EditorSessionExitService,
  ) {}

  canActivate(): boolean {
    const nav = this.router.getCurrentNavigation();
    const currentUrl = this.router.url;
    const inShell =
      !currentUrl.includes("/editor/tools") &&
      !currentUrl.includes("/editor/adjustments");
    if (
      nav?.trigger === "popstate" &&
      inShell &&
      this.history.mode() === "global"
    ) {
      void this.sessionExit.cancelSession();
      return false;
    }
    return true;
  }
}
