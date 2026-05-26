export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface TourStep {
  id: string;
  target: string | null;
  title: string;
  description: string;
  placement?: TourPlacement;
  advanceOn?: string[];
  showFinish?: boolean;
  progressCurrent?: number;
  progressTotal?: number;
}

export interface TourDefinition {
  id: string;
  version: number;
  steps: TourStep[];
}

export type TourCompletionReason = 'complete' | 'skip';

export interface TourSpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TourTooltipStyle {
  top: string;
  left: string;
  transform: string;
  width: string;
}

export interface TourOverlayState {
  active: boolean;
  currentStep: TourStep | null;
  currentIndex: number;
  totalSteps: number;
  displayCurrent: number;
  displayTotal: number;
  canGoBack: boolean;
  canFinish: boolean;
  isLastStep: boolean;
  spotlightRect: TourSpotlightRect | null;
  tooltipStyle: TourTooltipStyle;
}
