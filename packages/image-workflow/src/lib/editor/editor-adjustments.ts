export interface EditorAdjustmentsState {
  brightness: number;
  contrast: number;
  saturation: number;
  bw: boolean;
  dither: boolean;
}

export const DEFAULT_EDITOR_ADJUSTMENTS: EditorAdjustmentsState = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  bw: false,
  dither: false,
};

const coerceNumber = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function buildCssFilter(state: EditorAdjustmentsState): string {
  const brightness = coerceNumber(
    state.brightness,
    DEFAULT_EDITOR_ADJUSTMENTS.brightness,
  );
  const contrast = coerceNumber(
    state.contrast,
    DEFAULT_EDITOR_ADJUSTMENTS.contrast,
  );
  const saturation = coerceNumber(
    state.saturation,
    DEFAULT_EDITOR_ADJUSTMENTS.saturation,
  );
  const bw = !!state.bw;

  const sat = bw ? 1 : saturation;
  const gray = bw ? 1 : 0;

  // Dither is not represented by CSS filters (state is kept for export).
  return `brightness(${brightness}) contrast(${contrast}) saturate(${sat}) grayscale(${gray})`;
}
