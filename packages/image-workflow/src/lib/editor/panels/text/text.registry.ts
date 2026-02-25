import { Type } from "@angular/core";
import type { EditorHistoryService } from "../../editor-history.service";
import { TextKey } from "../../editor-ui-state.service";
import { TextPanelComponent } from "./widgets/text-panel.component";

export interface TextPanelConfig {
  title?: string;
  titleKey?: string;
  component: Type<any>;
  canReset: boolean;
  showGrabber: boolean;
  reset?: (history: EditorHistoryService) => void;
}

export const TEXT_REGISTRY: Record<TextKey, TextPanelConfig> = {
  text: {
    titleKey: "EDITOR.PANELS.TEXT.TEXT.REGISTRY.TITLE.TEXT",
    component: TextPanelComponent,
    canReset: false,
    showGrabber: true,
  },
};
