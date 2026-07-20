declare module "node:fs" {
  export const readFileSync: any;
  export const writeFileSync: any;
  export const existsSync: any;
  export const globSync: any;
  export const rmSync: any;
  export const mkdirSync: any;
}

declare module "node:path" {
  export const extname: any;
  export const resolve: any;
  export const sep: any;
  export const basename: any;
  export const dirname: any;
}

declare module "node:child_process" {
  export const execFileSync: any;
  export const spawnSync: any;
}

declare module "node:util" {
  export class TextDecoder {
    constructor(label?: string, options?: { fatal?: boolean });
    decode(input?: Uint8Array): string;
  }
}

declare module "node:test" {
  const test: any;
  export default test;
}

declare module "node:assert/strict" {
  const assert: any;
  export default assert;
}

declare const Buffer: any;
declare const process: any;
declare const console: any;
