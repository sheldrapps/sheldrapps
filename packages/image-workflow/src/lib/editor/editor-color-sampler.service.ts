import { Injectable, signal } from "@angular/core";

export type SamplerPoint = { x: number; y: number };
export type SamplerColor = {
  r: number;
  g: number;
  b: number;
  a: number;
  hex: string;
};

@Injectable({ providedIn: "root" })
export class EditorColorSamplerService {
  readonly active = signal(false);
  readonly confirming = signal(false);
  readonly sampleHex = signal("#000000");
  readonly proposedHex = signal<string | null>(null);
  readonly sampleRgba = signal({ r: 0, g: 0, b: 0, a: 1 });
  readonly samplePos = signal<SamplerPoint | null>(null);

  start(): void {
    this.active.set(true);
    this.confirming.set(false);
    this.proposedHex.set(null);
  }

  stop(): void {
    this.active.set(false);
    this.confirming.set(false);
    this.proposedHex.set(null);
    this.samplePos.set(null);
  }

  setSample(color: Omit<SamplerColor, "hex">, pos?: SamplerPoint): void {
    const hex = this.rgbToHex(color.r, color.g, color.b);
    this.sampleHex.set(hex);
    this.sampleRgba.set({
      r: color.r,
      g: color.g,
      b: color.b,
      a: color.a,
    });
    if (pos) {
      this.samplePos.set(pos);
    }
  }

  propose(): void {
    if (!this.active()) return;
    this.proposedHex.set(this.sampleHex());
    this.confirming.set(true);
  }

  clearProposal(): void {
    this.proposedHex.set(null);
    this.confirming.set(false);
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (v: number) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}
